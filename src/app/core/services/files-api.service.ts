import { HttpClient, HttpContext, HttpEvent } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../config/api-base-url.token';
import { SILENT_ERRORS } from '../interceptors/http-error.interceptor';
import { PlanAttachment } from '../models/app.models';
import { RequestOptions } from './plans-api.service';

/**
 * Capa HTTP para los archivos adjuntos de un plan (`/plans/:id/files`).
 * Pasa por `authInterceptor` y `httpErrorInterceptor`.
 */
@Injectable({ providedIn: 'root' })
export class FilesApiService {
  private readonly http    = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  private filesUrl(planId: string): string {
    return `${this.baseUrl}/plans/${encodeURIComponent(planId)}/files`;
  }

  /** Lista los archivos adjuntos de un plan (`GET /plans/:id/files`). */
  list(planId: string, options: RequestOptions = {}): Observable<PlanAttachment[]> {
    return this.http
      .get<unknown[]>(this.filesUrl(planId), {
        context: this.context(options.notify ?? false),
      })
      .pipe(map(items => (Array.isArray(items) ? items.map(item => toAttachment(item, planId)) : [])));
  }

  /**
   * Sube un archivo adjunto al plan (`POST /plans/:id/files`) emitiendo eventos
   * de progreso (`reportProgress: true`, `observe: 'events'`).
   */
  upload(planId: string, file: File, options: RequestOptions = {}): Observable<HttpEvent<PlanAttachment>> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.http.post<PlanAttachment>(this.filesUrl(planId), formData, {
      reportProgress: true,
      observe: 'events',
      context: this.context(options.notify ?? true),
    });
  }

  /** Descarga el contenido binario del archivo pasando por los interceptores de auth y error. */
  download(attachment: PlanAttachment, options: RequestOptions = {}): Observable<Blob> {
    return this.http.get(this.resolveUrl(attachment), {
      responseType: 'blob',
      context: this.context(options.notify ?? true),
    });
  }

  /** Elimina un archivo adjunto del plan (`DELETE /plans/:id/files/:fileId`). */
  remove(planId: string, fileId: string, options: RequestOptions = {}): Observable<void> {
    return this.http
      .delete<unknown>(`${this.filesUrl(planId)}/${encodeURIComponent(fileId)}`, {
        context: this.context(options.notify ?? true),
      })
      .pipe(map(() => undefined));
  }

  /** Resuelve la URL absoluta del archivo adjunto para visualización o descarga. */
  resolveUrl(attachment: PlanAttachment): string {
    const rawUrl = attachment.url ?? '';
    if (!rawUrl) {
      return `${this.filesUrl(attachment.planId)}/${encodeURIComponent(attachment.id)}`;
    }
    if (
      rawUrl.startsWith('http://') ||
      rawUrl.startsWith('https://') ||
      rawUrl.startsWith('blob:') ||
      rawUrl.startsWith('data:')
    ) {
      return rawUrl;
    }
    return `${this.baseUrl}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
  }

  private context(notify: boolean): HttpContext {
    return new HttpContext().set(SILENT_ERRORS, !notify);
  }
}

export function toAttachment(raw: unknown, fallbackPlanId = ''): PlanAttachment {
  const r = (raw ?? {}) as Partial<PlanAttachment> & { id?: string | number; planId?: string | number };
  return {
    id: String(r.id ?? ''),
    planId: String(r.planId ?? fallbackPlanId),
    name: r.name ?? 'archivo',
    mimeType: r.mimeType ?? 'application/octet-stream',
    size: typeof r.size === 'number' && Number.isFinite(r.size) ? r.size : 0,
    url: r.url ?? '',
    createdAt: r.createdAt ?? new Date(0).toISOString(),
  };
}
