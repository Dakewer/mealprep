import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, isObservable } from 'rxjs';
import { ApiError, toApiError } from '../../../../core/errors/api-error';
import { NutritionPlan, PlanAttachment } from '../../../../core/models/app.models';
import { AuthService } from '../../../../core/services/auth.service';
import { FilesApiService } from '../../../../core/services/files-api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { NutritionService } from '../../../../core/services/nutrition.service';
import {
  PlanService,
  extractRealtimeAttachment,
  extractRealtimeFileId,
  extractRealtimePlan,
  extractRealtimePlanId,
} from '../../../../core/services/plan.service';
import { PlansApiService } from '../../../../core/services/plans-api.service';
import {
  ConnectionStatus,
  RealtimeEvent,
  RealtimeService,
} from '../../../../core/services/realtime.service';
import { ConfirmModalComponent } from '../../../../shared/components/confirm-modal/confirm-modal.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/components/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { MacroBarsComponent } from '../../../../shared/components/macro-bars/macro-bars.component';
import { CanManageDirective, HasRoleDirective } from '../../../../shared/directives/has-role.directive';
import { RippleDirective } from '../../../../shared/directives/ripple.directive';

@Component({
  selector: 'app-plan-detail',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    RippleDirective,
    HasRoleDirective,
    CanManageDirective,
    MacroBarsComponent,
    ConfirmModalComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingStateComponent,
  ],
  templateUrl: './plan-detail.component.html',
  styleUrl: './plan-detail.component.css',
})
export class PlanDetailComponent {
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private notif      = inject(NotificationService);
  private nutrition  = inject(NutritionService);
  private plansApi   = inject(PlansApiService);
  private filesApi   = inject(FilesApiService);
  private realtime   = inject(RealtimeService);
  private destroyRef = inject(DestroyRef);
  plans = inject(PlanService);
  authService = inject(AuthService);

  // Puede venir directamente por input binding o por route snapshot
  id = input<string>();

  confirmModal = viewChild<ConfirmModalComponent>('confirmModal');
  deleteAttachmentModal = viewChild<ConfirmModalComponent>('deleteAttachmentModal');

  /** Plan cargado directamente por ID cuando no estaba en la caché de PlanService. */
  private readonly fetchedPlan = signal<NutritionPlan | null>(null);
  readonly isLoadingDetail = signal<boolean>(false);
  readonly detailError = signal<ApiError | null>(null);
  readonly isForbidden = computed(() => this.detailError()?.status === 403);

  // ── B3 & B4: Estado de la galería de archivos adjuntos ──
  readonly isLoadingAttachments = signal<boolean>(false);
  readonly attachmentsError = signal<ApiError | null>(null);
  readonly attachmentActionError = signal<string | null>(null);
  readonly offlineActionWarning = signal<string | null>(null);
  readonly attachmentPendingDeletion = signal<PlanAttachment | null>(null);

  readonly isOffline = computed(() => this.realtime.connectionStatus() === 'disconnected');

  readonly planId = computed(() => {
    return this.id() || this.route.snapshot.paramMap.get('id') || '';
  });

  readonly plan = computed(() => {
    const id = this.planId();
    const fromStore = this.plans.plans().find(p => p.id === id);
    if (fromStore) return fromStore;
    const fetched = this.fetchedPlan();
    return fetched?.id === id ? fetched : undefined;
  });

  /** Lista reactiva de archivos adjuntos del plan actual. */
  readonly attachments = computed<PlanAttachment[]>(() => {
    return this.plans.getPlanAttachments(this.plan());
  });

  private lastFetchedId = '';
  private previousConnectionStatus: ConnectionStatus = this.realtime.connectionStatus();

  constructor() {
    effect(() => {
      const id = this.planId();
      const inStore = this.plans.plans().some(p => p.id === id);
      if (!id || inStore) {
        if (inStore) {
          untracked(() => {
            this.detailError.set(null);
            this.isLoadingDetail.set(false);
          });
        }
        return;
      }
      if (this.lastFetchedId === id) return;
      this.lastFetchedId = id;
      untracked(() => {
        void this.fetchPlanById(id);
      });
    });

    // B2: Al pasar de 'reconnecting' a 'connected', limpiar avisos de desconexión y resincronizar
    effect(() => {
      const status = this.realtime.connectionStatus();
      const wasReconnecting = this.previousConnectionStatus === 'reconnecting';
      this.previousConnectionStatus = status;

      if (status === 'connected') {
        untracked(() => {
          this.offlineActionWarning.set(null);
        });
      }

      if (wasReconnecting && status === 'connected') {
        untracked(() => {
          const id = this.planId();
          if (id && !this.plans.plans().some(p => p.id === id)) {
            void this.fetchPlanById(id);
          }
        });
      }
    });

    // B2: Suscripción a eventos de RealtimeService con limpieza obligatoria takeUntilDestroyed
    this.realtime.events$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        this.onRealtimeEvent(event);
      });
  }

  private onRealtimeEvent(event: RealtimeEvent): void {
    const currentId = this.planId();
    if (!currentId) return;

    switch (event.type) {
      case 'plan:updated': {
        const updated = extractRealtimePlan(event);
        if (updated && updated.id === currentId) {
          this.fetchedPlan.update(prev => (prev ? { ...prev, ...updated } : updated));
          this.notif.info(`El plan "${updated.name}" se actualizó en tiempo real.`);
        }
        break;
      }

      case 'plan:deleted': {
        const deletedId = extractRealtimePlanId(event);
        if (deletedId === currentId) {
          this.fetchedPlan.set(null);
          this.confirmModal()?.close();
          this.deleteAttachmentModal()?.close();
          this.notif.warning('Este plan fue eliminado en otra sesión.');
          void this.router.navigate(['/dashboard']);
        }
        break;
      }

      case 'plan:file-added': {
        const updatedPlan = extractRealtimePlan(event);
        if (updatedPlan && updatedPlan.id === currentId) {
          this.fetchedPlan.update(prev => (prev ? { ...prev, ...updatedPlan } : updatedPlan));
          this.notif.info('Se agregó un nuevo archivo adjunto al plan.');
          return;
        }
        const attachment = extractRealtimeAttachment(event);
        const targetPlanId = extractRealtimePlanId(event) || attachment?.planId;
        if (attachment && targetPlanId === currentId) {
          this.addAttachmentToLocalFetchedPlan(attachment);
          this.notif.info(`Archivo "${attachment.name}" agregado en tiempo real.`);
        }
        break;
      }

      case 'plan:file-removed': {
        const updatedPlan = extractRealtimePlan(event);
        if (updatedPlan && updatedPlan.id === currentId) {
          this.fetchedPlan.update(prev => (prev ? { ...prev, ...updatedPlan } : updatedPlan));
          return;
        }
        const targetPlanId = extractRealtimePlanId(event);
        const fileId = extractRealtimeFileId(event);
        if (targetPlanId === currentId && fileId) {
          this.removeAttachmentFromLocalFetchedPlan(fileId);
          if (this.attachmentPendingDeletion()?.id === fileId) {
            this.deleteAttachmentModal()?.close();
            this.attachmentPendingDeletion.set(null);
          }
          this.notif.info('Un archivo adjunto fue eliminado en tiempo real.');
        }
        break;
      }
    }
  }

  private addAttachmentToLocalFetchedPlan(attachment: PlanAttachment): void {
    this.fetchedPlan.update(prev => {
      if (!prev) return prev;
      const current = this.plans.getPlanAttachments(prev);
      const next = current.some(f => f.id === attachment.id)
        ? current.map(f => (f.id === attachment.id ? attachment : f))
        : [...current, attachment];
      return {
        ...prev,
        files: next,
        ...(prev.attachments !== undefined ? { attachments: next } : {}),
      };
    });
  }

  private removeAttachmentFromLocalFetchedPlan(fileId: string): void {
    this.fetchedPlan.update(prev => {
      if (!prev) return prev;
      const current = this.plans.getPlanAttachments(prev);
      const next = current.filter(f => f.id !== fileId);
      return {
        ...prev,
        files: next,
        ...(prev.attachments !== undefined ? { attachments: next } : {}),
      };
    });
  }

  async fetchPlanById(id: string): Promise<void> {
    if (!id) return;
    this.isLoadingDetail.set(true);
    this.detailError.set(null);
    try {
      const plan = await firstValueFrom(this.plansApi.get(id));
      this.fetchedPlan.set(plan);
    } catch (error) {
      this.detailError.set(toApiError(error));
    } finally {
      this.isLoadingDetail.set(false);
    }
  }

  /** Recarga la lista de archivos adjuntos del plan desde la API (B4). */
  async retryLoadAttachments(): Promise<void> {
    if (this.checkOfflineAndNotify('No hay conexión con el servidor. Conéctate para cargar los archivos adjuntos.')) {
      return;
    }
    const currentPlan = this.plan();
    if (!currentPlan) return;

    this.isLoadingAttachments.set(true);
    this.attachmentsError.set(null);
    try {
      const files = await firstValueFrom(this.filesApi.list(currentPlan.id));
      for (const file of files) {
        this.plans.addAttachmentToPlan(currentPlan.id, file);
        this.addAttachmentToLocalFetchedPlan(file);
      }
    } catch (error) {
      this.attachmentsError.set(toApiError(error));
    } finally {
      this.isLoadingAttachments.set(false);
    }
  }

  // ── B3: Helpers de visualización, descarga y eliminación de archivos ──

  isImageAttachment(attachment: PlanAttachment): boolean {
    return Boolean(attachment.mimeType?.toLowerCase().startsWith('image/'));
  }

  isPdfAttachment(attachment: PlanAttachment): boolean {
    return (
      attachment.mimeType?.toLowerCase() === 'application/pdf' ||
      attachment.name?.toLowerCase().endsWith('.pdf')
    );
  }

  formatFileType(attachment: PlanAttachment): string {
    const mime = (attachment.mimeType ?? '').toLowerCase();
    if (mime === 'application/pdf' || attachment.name?.toLowerCase().endsWith('.pdf')) {
      return 'PDF';
    }
    if (mime === 'image/jpeg' || mime === 'image/jpg') return 'JPG';
    if (mime === 'image/png') return 'PNG';
    if (mime === 'image/webp') return 'WEBP';
    const parts = mime.split('/');
    return (parts[1] || 'ARCHIVO').toUpperCase();
  }

  formatFileSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes < 0) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
    }
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  }

  resolveAttachmentUrl(attachment: PlanAttachment): string {
    return this.filesApi.resolveUrl(attachment);
  }

  async openOrDownloadAttachment(attachment: PlanAttachment): Promise<void> {
    if (
      this.checkOfflineAndNotify(
        'No hay conexión con el servidor. No es posible abrir o descargar archivos sin conexión.',
      )
    ) {
      return;
    }

    this.attachmentActionError.set(null);
    try {
      const result = this.filesApi.download(attachment);
      if (isObservable(result)) {
        const blob = await firstValueFrom(result);
        this.triggerBrowserDownload(blob, attachment.name);
        return;
      }
      // Fallback si download() en otra implementación abre directamente o devuelve URL
      const url = this.resolveAttachmentUrl(attachment);
      if (typeof window !== 'undefined' && url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      const apiErr = toApiError(error);
      this.attachmentActionError.set(apiErr.message);
    }
  }

  private triggerBrowserDownload(blob: Blob, filename: string): void {
    if (typeof window === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    try {
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename || 'archivo';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }
  }

  requestDeleteAttachment(attachment: PlanAttachment): void {
    if (
      this.checkOfflineAndNotify(
        'No hay conexión con el servidor. No puedes eliminar archivos adjuntos sin conexión.',
      )
    ) {
      return;
    }
    this.attachmentActionError.set(null);
    this.attachmentPendingDeletion.set(attachment);
    this.deleteAttachmentModal()?.open(attachment.name);
  }

  onDeleteAttachmentCancelled(): void {
    this.attachmentPendingDeletion.set(null);
  }

  async onDeleteAttachmentConfirmed(): Promise<void> {
    const currentPlan = this.plan();
    const target = this.attachmentPendingDeletion();
    if (!currentPlan || !target) return;

    if (
      this.checkOfflineAndNotify(
        'No hay conexión con el servidor. No se pudo eliminar el archivo adjunto.',
      )
    ) {
      this.deleteAttachmentModal()?.close();
      this.attachmentPendingDeletion.set(null);
      return;
    }

    this.attachmentActionError.set(null);
    try {
      await firstValueFrom(this.filesApi.remove(currentPlan.id, target.id));
      this.plans.removeAttachmentFromPlan(currentPlan.id, target.id);
      this.removeAttachmentFromLocalFetchedPlan(target.id);
      this.realtime.notifyOtherTabs?.({
        type: 'plan:file-removed',
        planId: currentPlan.id,
        fileId: target.id,
        payload: { planId: currentPlan.id, fileId: target.id },
      });
      this.deleteAttachmentModal()?.close();
      this.attachmentPendingDeletion.set(null);
      this.notif.success(`Archivo "${target.name}" eliminado correctamente.`);
    } catch (error) {
      const apiErr = toApiError(error);
      this.deleteAttachmentModal()?.close();
      this.attachmentPendingDeletion.set(null);

      if (apiErr.status === 403) {
        const msg = apiErr.message || 'No tienes permisos para eliminar archivos de este plan (403).';
        this.attachmentActionError.set(msg);
      } else {
        this.attachmentActionError.set(
          apiErr.message || 'Ocurrió un error al intentar eliminar el archivo adjunto.',
        );
      }
    }
  }

  private checkOfflineAndNotify(message: string): boolean {
    if (!this.isOffline()) {
      this.offlineActionWarning.set(null);
      return false;
    }
    this.offlineActionWarning.set(message);
    this.notif.warning(message);
    return true;
  }

  /** Indica si el plan pertenece a otro usuario distinto al de la sesión actual. */
  isOtherUserPlan(plan: NutritionPlan): boolean {
    const currentId = this.authService.currentUser?.()?.id;
    return Boolean(plan.ownerId && currentId && plan.ownerId !== currentId);
  }

  backToDashboard(): void {
    void this.router.navigate(['/dashboard']);
  }

  /** Desglose completo de ingredientes con valores calculados */
  readonly detailedItems = computed(() => {
    const currentPlan = this.plan();
    if (!currentPlan) return [];

    return currentPlan.items.map(item => {
      const ingredient = this.plans.ingredients.find(i => i.id === item.ingredientId);
      const factor = item.grams / 100;

      return {
        ...item,
        ingredientName: ingredient?.name ?? item.ingredientId,
        category: ingredient?.category ?? 'Abarrotes',
        unit: ingredient?.unit ?? 'g',
        calories: ingredient ? Math.round(ingredient.calories * factor) : 0,
        protein: ingredient ? +(ingredient.protein * factor).toFixed(1) : 0,
        carbs: ingredient ? +(ingredient.carbs * factor).toFixed(1) : 0,
        fat: ingredient ? +(ingredient.fat * factor).toFixed(1) : 0,
      };
    });
  });

  /** Porcentajes de macronutrientes del plan */
  readonly macroPercentages = computed(() => {
    const currentPlan = this.plan();
    if (!currentPlan) return { protein: 0, carbs: 0, fat: 0 };

    const { protein, carbs, fat } = currentPlan.macroGoals;
    const proteinCal = protein * 4;
    const carbsCal = carbs * 4;
    const fatCal = fat * 9;
    const totalCal = proteinCal + carbsCal + fatCal;

    if (totalCal === 0) return { protein: 0, carbs: 0, fat: 0 };

    return {
      protein: Math.round((proteinCal / totalCal) * 100),
      carbs: Math.round((carbsCal / totalCal) * 100),
      fat: Math.round((fatCal / totalCal) * 100),
    };
  });

  async toggleFavorite(): Promise<void> {
    if (
      this.checkOfflineAndNotify(
        'No hay conexión con el servidor. No puedes cambiar favoritos sin conexión.',
      )
    ) {
      return;
    }
    const currentPlan = this.plan();
    if (!currentPlan) return;
    const wasFav = currentPlan.isFavorite;
    const ok = await this.plans.toggleFavorite(currentPlan.id);
    if (ok) {
      this.notif.info(
        !wasFav
          ? `Plan "${currentPlan.name}" añadido a favoritos.`
          : `Plan "${currentPlan.name}" retirado de favoritos.`,
      );
    }
  }

  generateShoppingList(): void {
    const currentPlan = this.plan();
    if (!currentPlan) return;

    if (this.plans.generateShoppingList(currentPlan.id)) {
      this.notif.success('Lista de compras generada a partir de este plan.');
      this.router.navigate(['/dashboard']);
    }
  }

  requestDelete(): void {
    if (
      this.checkOfflineAndNotify(
        'No hay conexión con el servidor. No puedes eliminar el plan sin conexión.',
      )
    ) {
      return;
    }
    const currentPlan = this.plan();
    if (currentPlan) {
      this.confirmModal()?.open(currentPlan.name);
    }
  }

  async onDeleteConfirmed(): Promise<void> {
    const currentPlan = this.plan();
    if (currentPlan) {
      const ok = await this.plans.deletePlan(currentPlan.id);
      this.confirmModal()?.close();
      if (ok) {
        this.notif.success(`El plan "${currentPlan.name}" fue eliminado.`);
        this.router.navigate(['/dashboard']);
      }
    }
  }

  categoryColorClass(category: string): string {
    switch (category) {
      case 'Verduras':
        return 'cat-badge--verduras';
      case 'Carnes':
        return 'cat-badge--carnes';
      case 'Lácteos':
        return 'cat-badge--lacteos';
      default:
        return 'cat-badge--abarrotes';
    }
  }
}
