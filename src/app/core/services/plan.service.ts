import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { ApiError, toApiError } from '../errors/api-error';
import { INGREDIENT_CATALOG } from '../data/ingredients.data';
import {
  ConnectionStatus,
  Ingredient,
  NutritionPlan,
  PlanAttachment,
  PlanItem,
  PlanPayload,
  RealtimeMessage,
  ShoppingItem,
  ShoppingList,
  UserProfile,
} from '../models/app.models';
import { AuthService } from './auth.service';
import { FilesApiService, toAttachment } from './files-api.service';
import { NutritionService } from './nutrition.service';
import { PlansApiService } from './plans-api.service';
import { RealtimeEventInput, RealtimeService } from './realtime.service';

export const DEFAULT_PROFILE: UserProfile = {
  sex: 'male', age: 25, weightKg: 70, heightCm: 170,
  activity: 'moderate', objective: 'maintenance',
};

export type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * Estado del dashboard.
 *  - Planes: viven en la API (`PlansApiService`); aquí se guardan en una señal como caché
 *    y se sincronizan en tiempo real con `RealtimeService`.
 *  - Perfil y listas de compras: siguen en localStorage, por usuario.
 *
 * Los métodos de planes que escriben devuelven una promesa y NUNCA lanzan: si la API
 * falla, el interceptor global ya avisó al usuario y el método devuelve `null`/`false`.
 */
@Injectable({ providedIn: 'root' })
export class PlanService {
  private auth       = inject(AuthService);
  private nutrition  = inject(NutritionService);
  private plansApi   = inject(PlansApiService);
  private filesApi   = inject(FilesApiService);
  private realtime   = inject(RealtimeService);
  private destroyRef = inject(DestroyRef);

  /** Catálogo disponible para armar planes. */
  readonly ingredients: Ingredient[] = INGREDIENT_CATALOG;

  // ── Estado ────────────────────────────────────────────────
  private _profile = signal<UserProfile>(DEFAULT_PROFILE);
  private _plans   = signal<NutritionPlan[]>([]);
  private _lists   = signal<ShoppingList[]>([]);
  private _plansStatus = signal<LoadStatus>('idle');
  private _plansError  = signal<ApiError | null>(null);

  readonly profile = this._profile.asReadonly();
  readonly plans   = this._plans.asReadonly();
  readonly lists   = this._lists.asReadonly();

  /** Estado de la carga de planes: sirve para pintar cargando / error / vacío. */
  readonly plansStatus = this._plansStatus.asReadonly();
  readonly plansError  = this._plansError.asReadonly();
  readonly plansLoading = computed(() => this._plansStatus() === 'loading');

  // ── Derivados ─────────────────────────────────────────────
  private readonly userId = computed(() => this.auth.currentUser?.()?.id);
  readonly tdee = computed(() => this.nutrition.calculateTdee(this._profile()));
  readonly goals = computed(() => this.nutrition.calculateMacroGoals(this._profile()));
  readonly favoritesCount = computed(() => this._plans().filter(p => p.isFavorite).length);

  private previousConnectionStatus: ConnectionStatus = this.realtime.connectionStatus();

  constructor() {
    const initialId = this.auth.currentUser?.()?.id;
    this.load(initialId);

    let lastUserId = initialId;
    effect(() => {
      const id = this.userId();
      if (id === lastUserId) return;
      lastUserId = id;
      untracked(() => {
        this.load(id);
        this._plans.set([]);
        this._plansStatus.set(id ? 'loading' : 'idle');
        this._plansError.set(null);
        if (id) void this.loadPlans();
      });
    });

    // B2: Al pasar de 'reconnecting' a 'connected', disparar loadPlans() para resincronizar cambios perdidos
    effect(() => {
      const status = this.realtime.connectionStatus();
      const wasReconnecting = this.previousConnectionStatus === 'reconnecting';
      this.previousConnectionStatus = status;

      if (wasReconnecting && status === 'connected' && this._plansStatus() !== 'loading') {
        untracked(() => {
          void this.loadPlans();
        });
      }
    });

    // B2: Suscripción a eventos en tiempo real con limpieza obligatoria mediante takeUntilDestroyed
    this.realtime.events$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        this.handleRealtimeEvent(event);
      });

    void this.loadPlans();
  }

  private load(userId: string | undefined): void {
    this._profile.set(this.read<UserProfile>(userId, 'profile', DEFAULT_PROFILE));
    this._lists.set(this.read<ShoppingList[]>(userId, 'lists', []));
  }

  // ── Sincronización en Tiempo Real (B2) ────────────────────
  handleRealtimeEvent(event: RealtimeMessage | RealtimeEventInput): void {
    const eventType = (event as RealtimeMessage).event ?? (event as RealtimeEventInput).type;
    if (!eventType) return;

    switch (eventType) {
      case 'plan:created': {
        const created = extractRealtimePlan(event);
        if (!created) return;
        this._plans.update(list => {
          if (list.some(p => p.id === created.id)) {
            return list.map(p => (p.id === created.id ? { ...p, ...created } : p));
          }
          return [created, ...list];
        });
        break;
      }

      case 'plan:updated': {
        const updated = extractRealtimePlan(event);
        if (!updated) return;
        this._plans.update(list =>
          list.map(p => (p.id === updated.id ? { ...p, ...updated } : p)),
        );
        break;
      }

      case 'plan:deleted': {
        const deletedId = extractRealtimePlanId(event);
        if (!deletedId) return;
        this._plans.update(list => list.filter(p => p.id !== deletedId));
        break;
      }

      case 'plan:file-added': {
        const attachment = extractRealtimeAttachment(event);
        const planId = extractRealtimePlanId(event) || attachment?.planId;
        if (planId && attachment) {
          this.addAttachmentToPlan(planId, attachment);
        }
        break;
      }

      case 'plan:file-removed': {
        const attachment = extractRealtimeAttachment(event);
        const planId = extractRealtimePlanId(event) || attachment?.planId;
        const fileId = extractRealtimeFileId(event) || attachment?.id;
        if (planId && fileId) {
          this.removeAttachmentFromPlan(planId, fileId);
        }
        break;
      }
    }
  }

  // ── Archivos adjuntos de planes (B2 / B3) ─────────────────
  getPlanAttachments(plan: NutritionPlan | null | undefined): PlanAttachment[] {
    if (!plan) return [];
    const list = plan.files ?? plan.attachments ?? [];
    return Array.isArray(list) ? list : [];
  }

  setPlanAttachments(planId: string, files: PlanAttachment[]): void {
    this._plans.update(list =>
      list.map(plan =>
        plan.id === planId
          ? {
            ...plan,
            files,
            ...(plan.attachments !== undefined ? { attachments: files } : {}),
          }
          : plan,
      ),
    );
  }

  addAttachmentToPlan(planId: string, attachment: PlanAttachment): void {
    this._plans.update(list =>
      list.map(plan => {
        if (plan.id !== planId) return plan;
        const current = this.getPlanAttachments(plan);
        const next = current.some(f => f.id === attachment.id)
          ? current.map(f => (f.id === attachment.id ? attachment : f))
          : [...current, attachment];
        return {
          ...plan,
          files: next,
          ...(plan.attachments !== undefined ? { attachments: next } : {}),
        };
      }),
    );
  }

  removeAttachmentFromPlan(planId: string, fileId: string): void {
    this._plans.update(list =>
      list.map(plan => {
        if (plan.id !== planId) return plan;
        const current = this.getPlanAttachments(plan);
        const next = current.filter(f => f.id !== fileId);
        return {
          ...plan,
          files: next,
          ...(plan.attachments !== undefined ? { attachments: next } : {}),
        };
      }),
    );
  }

  /** Elimina un archivo adjunto en la API y actualiza el estado del plan. */
  async deletePlanAttachment(planId: string, fileId: string): Promise<boolean> {
    this._plansError.set(null);
    const snapshot = this._plans();
    this.removeAttachmentFromPlan(planId, fileId);
    try {
      await firstValueFrom(this.filesApi.remove(planId, fileId));
      return true;
    } catch (error) {
      this._plans.set(snapshot);
      this._plansError.set(toApiError(error));
      return false;
    }
  }

  // ── Perfil ────────────────────────────────────────────────
  updateProfile(profile: UserProfile): void {
    this._profile.set(profile);
    this.write('profile', profile);
  }

  // ── Planes ────────────────────────────────────────────────
  /** Trae todos los planes de la API. Si falla, avisa (toast) y deja `plansStatus = 'error'`. */
  async loadPlans(): Promise<void> {
    this._plansStatus.set('loading');
    this._plansError.set(null);
    try {
      const page = await firstValueFrom(this.plansApi.list({ sort: 'createdAt', order: 'desc' }, { notify: true }));
      this._plans.set(page.items);
      this._plansStatus.set('loaded');
    } catch (error) {
      this._plansError.set(toApiError(error));
      this._plansStatus.set('error');
    }
  }

  /** Crea un plan. Devuelve el plan guardado, o `null` si la API falló. */
  async savePlan(name: string, items: PlanItem[], description = ''): Promise<NutritionPlan | null> {
    this._plansError.set(null);
    try {
      const plan = await firstValueFrom(this.plansApi.create(this.buildPayload(name, items, description)));
      this._plans.update(list => (list.some(p => p.id === plan.id) ? list : [plan, ...list]));
      return plan;
    } catch (error) {
      this._plansError.set(toApiError(error));
      return null; // el interceptor ya avisó al usuario
    }
  }

  /** Reemplaza nombre, ingredientes y descripción de un plan existente. `null` si falló. */
  async updatePlan(
    id: string, name: string, items: PlanItem[], description = '',
  ): Promise<NutritionPlan | null> {
    this._plansError.set(null);
    const current = this._plans().find(p => p.id === id);
    try {
      const payload: PlanPayload = {
        ...this.buildPayload(name, items, description),
        // al editar se conservan la fecha de creación, el favorito, las etiquetas y los archivos
        ...(current && {
          createdAt: current.createdAt,
          isFavorite: current.isFavorite,
          tags: current.tags,
          ...(current.files !== undefined ? { files: current.files } : {}),
          ...(current.attachments !== undefined ? { attachments: current.attachments } : {}),
        }),
      };
      const plan = await firstValueFrom(this.plansApi.update(id, payload));
      this._plans.update(list => list.map(p => (p.id === id ? plan : p)));
      return plan;
    } catch (error) {
      this._plansError.set(toApiError(error));
      return null;
    }
  }

  /** Elimina un plan. Devuelve `true` si se borró. Si responde 403 u otro error, revierte el estado optimista. */
  async deletePlan(id: string): Promise<boolean> {
    this._plansError.set(null);
    const snapshot = this._plans();
    this._plans.update(list => list.filter(p => p.id !== id));
    try {
      await firstValueFrom(this.plansApi.remove(id));
      return true;
    } catch (error) {
      this._plans.set(snapshot);
      this._plansError.set(toApiError(error));
      return false;
    }
  }

  /** Marca o desmarca un plan como favorito. Devuelve `true` si se guardó; si falla (ej. 403), revierte la estrella. */
  async toggleFavorite(id: string): Promise<boolean> {
    this._plansError.set(null);
    const current = this._plans().find(p => p.id === id);
    if (!current) return false;
    const previousFavorite = current.isFavorite;
    this._plans.update(list =>
      list.map(p => (p.id === id ? { ...p, isFavorite: !previousFavorite } : p)),
    );
    try {
      const plan = await firstValueFrom(this.plansApi.patch(id, { isFavorite: !previousFavorite }));
      this._plans.update(list => list.map(p => (p.id === id ? plan : p)));
      return true;
    } catch (error) {
      this._plans.update(list =>
        list.map(p => (p.id === id ? { ...p, isFavorite: previousFavorite } : p)),
      );
      this._plansError.set(toApiError(error));
      return false;
    }
  }

  private buildPayload(name: string, items: PlanItem[], description: string): PlanPayload {
    return {
      name: name.trim(),
      description: description.trim() || undefined,
      macroGoals: this.nutrition.calculateTotals(items, this.ingredients),
      items,
      createdAt: new Date().toISOString(),
      isFavorite: false,
      tags: [this._profile().objective],
    };
  }

  // ── Listas de compras ─────────────────────────────────────
  generateShoppingList(planId: string): ShoppingList | null {
    const plan = this._plans().find(p => p.id === planId);
    if (!plan) return null;

    const items: ShoppingItem[] = plan.items.flatMap(item => {
      const ing = this.ingredients.find(i => i.id === item.ingredientId);
      return ing
        ? [{
          ingredientId: ing.id,
          ingredientName: ing.name,
          category: ing.category,
          quantity: item.grams,
          unit: ing.unit,
          isChecked: false,
        }]
        : [];
    });

    const list: ShoppingList = {
      id: `list-${Date.now()}`,
      planId: plan.id,
      planName: plan.name,
      items,
      generatedAt: new Date().toISOString(),
    };
    this._lists.update(l => [list, ...l]);
    this.write('lists', this._lists());
    return list;
  }

  toggleShoppingItem(listId: string, ingredientId: string): void {
    this._lists.update(lists =>
      lists.map(l =>
        l.id !== listId
          ? l
          : {
            ...l,
            items: l.items.map(i =>
              i.ingredientId === ingredientId ? { ...i, isChecked: !i.isChecked } : i,
            ),
          },
      ),
    );
    this.write('lists', this._lists());
  }

  deleteList(id: string): void {
    this._lists.update(l => l.filter(x => x.id !== id));
    this.write('lists', this._lists());
  }

  // ── Persistencia ──────────────────────────────────────────
  private key(userId: string | undefined, name: string): string {
    return `deficcitto_${name}_${userId ?? 'guest'}`;
  }

  private read<T>(userId: string | undefined, name: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(this.key(userId, name));
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  private write(name: string, value: unknown): void {
    try {
      localStorage.setItem(this.key(this.userId(), name), JSON.stringify(value));
    } catch {
      /* ... */
    }
  }
}

// ── Helpers para extraer datos de RealtimeMessage / RealtimeEventInput ──

export function extractRealtimePlan(event: RealtimeMessage | RealtimeEventInput): NutritionPlan | null {
  const raw = event as RealtimeEventInput;
  const candidate =
    raw.plan ??
    (isPlanObject(raw.data) ? raw.data : null) ??
    (isPlanObject(raw.payload) ? raw.payload : null) ??
    (isObject(raw.payload) && isPlanObject((raw.payload as { plan?: unknown }).plan)
      ? ((raw.payload as { plan: NutritionPlan }).plan)
      : null);

  if (!candidate) return null;
  return {
    ...candidate,
    id: String(candidate.id),
  };
}

export function extractRealtimePlanId(event: RealtimeMessage | RealtimeEventInput): string | null {
  const raw = event as RealtimeEventInput;
  const eventType = (event as RealtimeMessage).event ?? raw.type;
  if (raw.planId) return String(raw.planId);
  if (typeof raw.data === 'string' || typeof raw.data === 'number') {
    return String(raw.data);
  }
  if (isObject(raw.data)) {
    const d = raw.data as { planId?: string | number; id?: string | number };
    if (d.planId !== undefined) return String(d.planId);
    if (eventType === 'plan:deleted' && d.id !== undefined) return String(d.id);
  }
  if (typeof raw.payload === 'string' || typeof raw.payload === 'number') {
    return String(raw.payload);
  }
  if (isObject(raw.payload)) {
    const p = raw.payload as { planId?: string | number; id?: string | number; plan?: { id?: string | number } };
    if (p.planId !== undefined) return String(p.planId);
    if (eventType === 'plan:deleted' && p.id !== undefined) return String(p.id);
    if (p.plan?.id !== undefined) return String(p.plan.id);
  }
  if (raw.id !== undefined && eventType === 'plan:deleted') {
    return String(raw.id);
  }
  return null;
}

export function extractRealtimeAttachment(event: RealtimeMessage | RealtimeEventInput): PlanAttachment | null {
  const raw = event as RealtimeEventInput;
  const direct = raw.file ?? raw.attachment;
  if (direct) return toAttachment(direct, raw.planId ?? '');

  if (isObject(raw.data)) {
    const d = raw.data as {
      file?: unknown;
      attachment?: unknown;
      planId?: string;
      mimeType?: string;
      url?: string;
    };
    if (d.file) return toAttachment(d.file, d.planId ?? raw.planId ?? '');
    if (d.attachment) return toAttachment(d.attachment, d.planId ?? raw.planId ?? '');
    if (d.mimeType !== undefined || d.url !== undefined || d.planId !== undefined) {
      return toAttachment(d, d.planId ?? raw.planId ?? '');
    }
  }

  if (isObject(raw.payload)) {
    const p = raw.payload as {
      file?: unknown;
      attachment?: unknown;
      planId?: string;
      mimeType?: string;
      url?: string;
    };
    if (p.file) return toAttachment(p.file, p.planId ?? raw.planId ?? '');
    if (p.attachment) return toAttachment(p.attachment, p.planId ?? raw.planId ?? '');
    if (p.mimeType !== undefined || p.url !== undefined || p.planId !== undefined) {
      return toAttachment(p, p.planId ?? raw.planId ?? '');
    }
  }
  return null;
}

export function extractRealtimeFileId(event: RealtimeMessage | RealtimeEventInput): string | null {
  const raw = event as RealtimeEventInput;
  if (raw.fileId) return String(raw.fileId);
  if (isObject(raw.data)) {
    const d = raw.data as { fileId?: string | number; id?: string | number; file?: { id?: string | number } };
    if (d.fileId !== undefined) return String(d.fileId);
    if (d.file?.id !== undefined) return String(d.file.id);
    if (d.id !== undefined) return String(d.id);
  }
  if (isObject(raw.payload)) {
    const p = raw.payload as { fileId?: string | number; id?: string | number; file?: { id?: string | number } };
    if (p.fileId !== undefined) return String(p.fileId);
    if (p.file?.id !== undefined) return String(p.file.id);
    if (p.id !== undefined) return String(p.id);
  }
  return null;
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null;
}

function isPlanObject(val: unknown): val is NutritionPlan {
  return isObject(val) && 'id' in val && 'name' in val && 'items' in val;
}
