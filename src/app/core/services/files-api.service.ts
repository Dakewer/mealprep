import { HttpClient, HttpEvent } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api-base-url.token';
import { PlanAttachment } from '../models/app.models';

/**
 * Servicio dedicado a la subida y gestión de archivos adjuntos de un plan.
 * Todas las peticiones pasan por `authInterceptor` (token Bearer) y `httpErrorInterceptor`.
 */
@Injectable({ providedIn: 'root' })
export class FilesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * Sube un archivo adjunto a `POST /plans/:id/files` reportando el progreso HTTP
   * (`reportProgress: true`, `observe: 'events'`) para alimentar la barra y permitir cancelación.
   */
  upload(planId: string, file: File): Observable<HttpEvent<PlanAttachment>> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.http.post<PlanAttachment>(
      `${this.baseUrl}/plans/${encodeURIComponent(planId)}/files`,
      formData,
      {
        reportProgress: true,
        observe: 'events',
      },
    );
  }
}
