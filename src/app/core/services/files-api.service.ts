import { HttpClient, HttpContext, HttpEventType } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, filter, map } from 'rxjs';
import { API_BASE_URL } from '../config/api-base-url.token';
import { SILENT_ERRORS } from '../interceptors/http-error.interceptor';
import { PlanAttachment } from '../models/app.models';
import { RequestOptions } from './plans-api.service';

/** Lo que emite `upload()`: el avance de la subida y, al final, el adjunto creado. */
export type UploadEvent =
  | { type: 'progress'; loaded: number; total: number | null; percent: number | null }
  | { type: 'done'; attachment: PlanAttachment };

/**
 * Capa HTTP de los archivos adjuntos de un plan (`/plans/:id/files`).
 * Pasa por `authInterceptor` (token) y `httpErrorInterceptor` (errores como `ApiError`),
 * igual que `PlansApiService`.
 *
 * Los permisos los decide el servidor (regla de dueño): `403` si el plan es de otro usuario.
 */
@Injectable({ providedIn: 'root' })
export class FilesApiService {
  private http    = inject(HttpClient);
  private baseUrl = inject(API_BASE_URL);

  /** Adjuntos de un plan. Por defecto no avisa si falla (la vista pinta su estado de error). */
  list(planId: string, options: RequestOptions = {}): Observable<PlanAttachment[]> {
    return this.http.get<PlanAttachment[]>(this.filesUrl(planId), {
      context: this.context(options.notify ?? false),
    });
  }

  /**
   * Sube un archivo (`POST /plans/:id/files`, multipart, campo `file`).
   * Emite eventos `progress` mientras sube y un único `done` con el adjunto al terminar.
   * Un error (413 tamaño, 415 tipo, 409 máximo por plan, 403 dueño) llega como `ApiError`.
   */
  upload(planId: string, file: File, options: RequestOptions = {}): Observable<UploadEvent> {
    const body = new FormData();
    body.append('file', file, file.name);

    return this.http
      .post<PlanAttachment>(this.filesUrl(planId), body, {
        reportProgress: true,
        observe: 'events',
        context: this.context(options.notify ?? true),
      })
      .pipe(
        filter(event => event.type === HttpEventType.UploadProgress || event.type === HttpEventType.Response),
        map((event): UploadEvent => {
          if (event.type === HttpEventType.Response) {
            return { type: 'done', attachment: event.body as PlanAttachment };
          }
          const total = event.total ?? null;
          return {
            type: 'progress',
            loaded: event.loaded,
            total,
            percent: total ? Math.round((event.loaded / total) * 100) : null,
          };
        }),
      );
  }

  /**
   * Descarga el contenido del adjunto como `Blob`. La petición lleva el token (un enlace `<a href>`
   * no podría), por eso se pide con HttpClient; usa `saveBlob()` para entregarlo al navegador.
   * La URL se arma desde `apiBaseUrl`, no desde `attachment.url`, para no mandar el token a otro host.
   */
  download(attachment: PlanAttachment, options: RequestOptions = {}): Observable<Blob> {
    return this.http.get(this.fileUrl(attachment.planId, attachment.id), {
      responseType: 'blob',
      context: this.context(options.notify ?? true),
    });
  }

  /** Elimina un adjunto (`DELETE /plans/:id/files/:fileId`). */
  remove(planId: string, fileId: string, options: RequestOptions = {}): Observable<void> {
    return this.http
      .delete<unknown>(this.fileUrl(planId, fileId), { context: this.context(options.notify ?? true) })
      .pipe(map(() => undefined));
  }

  // ── Helpers ───────────────────────────────────────────────

  private filesUrl(planId: string): string {
    return `${this.baseUrl}/plans/${encodeURIComponent(planId)}/files`;
  }

  private fileUrl(planId: string, fileId: string): string {
    return `${this.filesUrl(planId)}/${encodeURIComponent(fileId)}`;
  }

  private context(notify: boolean): HttpContext {
    return new HttpContext().set(SILENT_ERRORS, !notify);
  }
}

/** Entrega un `Blob` al usuario como descarga con el nombre indicado. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
