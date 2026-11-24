import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { toApiError } from '../../../core/errors/api-error';
import { PlanAttachment } from '../../../core/models/app.models';
import { FilesApiService } from '../../../core/services/files-api.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  ALLOWED_FILE_TYPES,
  formatFileSize,
  validateFile,
} from '../../../core/validators/file.validators';
import { RippleDirective } from '../../directives/ripple.directive';

/**
 * Componente reutilizable para subir archivos adjuntos a un plan nutricional.
 * Soporta selección con `<input type="file">`, arrastrar y soltar (drag & drop),
 * validación en cliente (tipo y tamaño), vista previa, progreso real (`HttpEventType.UploadProgress`),
 * cancelación de subida en curso y control de estado sin conexión.
 */
@Component({
  selector: 'app-file-uploader',
  standalone: true,
  imports: [RippleDirective],
  templateUrl: './file-uploader.component.html',
  styleUrl: './file-uploader.component.css',
})
export class FileUploaderComponent {
  private readonly filesApi = inject(FilesApiService);
  private readonly notif = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  /** ID del plan al que se asociará el archivo subido. */
  readonly planId = input.required<string>();

  /** Permite deshabilitar el componente externamente. */
  readonly disabled = input<boolean>(false);

  /** Permite reflejar un estado desconectado proveniente de `RealtimeService` u otro origen. */
  readonly connectionOffline = input<boolean>(false);

  /** Se emite al completarse la subida con el adjunto devuelto por la API. */
  readonly uploaded = output<PlanAttachment>();

  readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly acceptAttr = ALLOWED_FILE_TYPES.join(',');

  // ── Estado reactivo ───────────────────────────────────────
  readonly selectedFile = signal<File | null>(null);
  readonly previewUrl = signal<string | null>(null);
  readonly isDragging = signal<boolean>(false);
  readonly isUploading = signal<boolean>(false);
  readonly uploadProgress = signal<number>(0);
  readonly validationError = signal<string | null>(null);
  readonly uploadError = signal<string | null>(null);
  readonly cancelNotice = signal<string | null>(null);
  readonly isOnline = signal<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  readonly isOffline = computed(() => !this.isOnline() || this.connectionOffline());
  readonly isImagePreview = computed(() => {
    const file = this.selectedFile();
    return Boolean(file && file.type.startsWith('image/') && this.previewUrl());
  });
  readonly selectedFileSize = computed(() => {
    const file = this.selectedFile();
    return file ? formatFileSize(file.size) : '';
  });
  readonly selectedFileTypeLabel = computed(() => {
    const file = this.selectedFile();
    if (!file) return '';
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      return 'Documento PDF';
    }
    return file.type.replace('image/', '').toUpperCase() || 'Archivo';
  });
  readonly canUpload = computed(
    () =>
      Boolean(this.selectedFile()) &&
      !this.isUploading() &&
      !this.disabled() &&
      !this.isOffline(),
  );

  private activeUploadSub: Subscription | null = null;

  constructor() {
    const handleOnline = (): void => this.isOnline.set(true);
    const handleOffline = (): void => this.isOnline.set(false);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    this.destroyRef.onDestroy(() => {
      this.abortActiveUpload();
      this.revokePreviewUrl();
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    });
  }

  // ── Selección y Drag & Drop ───────────────────────────────

  openFileDialog(): void {
    if (this.isUploading() || this.disabled()) return;
    this.fileInput()?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0] ?? null;
    if (file) {
      this.handleFileCandidate(file);
    }
    // Permite volver a elegir el mismo archivo tras quitarlo o fallar
    inputEl.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.isUploading() || this.disabled()) return;
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
    if (this.isUploading() || this.disabled()) return;

    const file = event.dataTransfer?.files?.[0] ?? null;
    if (file) {
      this.handleFileCandidate(file);
    }
  }

  /** Valida el archivo seleccionado y genera la vista previa local si cumple. */
  handleFileCandidate(file: File): void {
    this.uploadError.set(null);
    this.cancelNotice.set(null);

    const validation = validateFile(file);
    if (!validation.valid) {
      this.clearSelection();
      this.validationError.set(validation.error);
      return;
    }

    this.validationError.set(null);
    this.revokePreviewUrl();
    this.selectedFile.set(file);

    if (file.type.startsWith('image/') && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      this.previewUrl.set(URL.createObjectURL(file));
    }
  }

  clearSelection(): void {
    if (this.isUploading()) return;
    this.revokePreviewUrl();
    this.selectedFile.set(null);
    this.validationError.set(null);
    this.uploadError.set(null);
    this.cancelNotice.set(null);
    this.uploadProgress.set(0);
    const inputEl = this.fileInput()?.nativeElement;
    if (inputEl) {
      inputEl.value = '';
    }
  }

  // ── Subida con progreso y cancelación ─────────────────────

  startUpload(): void {
    const file = this.selectedFile();
    if (!file || this.isUploading() || this.disabled()) return;

    if (this.isOffline()) {
      this.uploadError.set('Sin conexión. No es posible subir archivos en este momento.');
      return;
    }

    this.isUploading.set(true);
    this.uploadProgress.set(0);
    this.uploadError.set(null);
    this.cancelNotice.set(null);

    this.activeUploadSub = this.filesApi.upload(this.planId(), file).subscribe({
      next: (event) => {
        // El nuevo servicio emite { type: 'progress', percent: ... } o { type: 'done', attachment: ... }
        if (event.type === 'progress') {
          this.uploadProgress.set(event.percent ?? 0);
          return;
        }

        if (event.type === 'done') {
          this.uploadProgress.set(100);
          this.isUploading.set(false);
          this.activeUploadSub = null;

          if (event.attachment) {
            this.uploaded.emit(event.attachment);
          }
          this.notif.success(`Archivo "${file.name}" subido correctamente.`);
          this.clearSelection();
        }
      },
      error: (err: unknown) => {
        const apiError = toApiError(err);
        this.isUploading.set(false);
        this.uploadProgress.set(0);
        this.activeUploadSub = null;

        if (apiError.status === 403) {
          this.uploadError.set('No tienes permiso para subir archivos a este plan.');
          return;
        }

        this.uploadError.set(apiError.message);
      },
    });
  }

  cancelUpload(): void {
    if (!this.isUploading()) return;
    this.abortActiveUpload();
    this.isUploading.set(false);
    this.uploadProgress.set(0);
    this.cancelNotice.set('Subida cancelada.');
    this.notif.info('Subida cancelada.');
  }

  private abortActiveUpload(): void {
    if (this.activeUploadSub) {
      this.activeUploadSub.unsubscribe();
      this.activeUploadSub = null;
    }
  }

  private revokePreviewUrl(): void {
    const currentUrl = this.previewUrl();
    if (currentUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(currentUrl);
    }
    this.previewUrl.set(null);
  }
}
