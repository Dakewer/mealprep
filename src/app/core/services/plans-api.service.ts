import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../config/api-base-url.token';
import { SILENT_ERRORS } from '../interceptors/http-error.interceptor';
import { NutritionPlan, Page, PlanPayload } from '../models/app.models';

/** Parámetros de `GET /plans`. Todos son opcionales. */
export interface PlanListParams {
  /** Texto a buscar (nombre, descripción, etiquetas e ingredientes). */
  q?: string;
  /** Página, empezando en 1. Sin `page` ni `limit` se devuelven todos los planes. */
  page?: number;
  /** Planes por página. */
  limit?: number;
  /** Solo favoritos. */
  favorite?: boolean;
  /** Campo por el que ordenar. Por defecto: el orden en que están guardados. */
  sort?: 'name' | 'createdAt';
  order?: 'asc' | 'desc';
}

export interface RequestOptions {
  /**
   * `true`: si la petición falla, el interceptor global muestra un aviso (toast).
   * `false`: no avisa; la vista pinta su propio estado de error.
   * Por defecto, las lecturas (list / get) NO avisan y las escrituras SÍ.
   */
  notify?: boolean;
}

/**
 * Capa HTTP de la entidad Plan. Es el único lugar que conoce las URLs y los
 * parámetros de la API; los componentes nunca usan `HttpClient` directamente.
 *
 * Los errores llegan ya convertidos a `ApiError` por el interceptor global.
 */
@Injectable({ providedIn: 'root' })
export class PlansApiService {
  private http    = inject(HttpClient);
  private baseUrl = inject(API_BASE_URL);

  private get url(): string {
    return `${this.baseUrl}/plans`;
  }

  /** Lista planes con búsqueda y paginación. El total sale del encabezado `X-Total-Count`. */
  list(params: PlanListParams = {}, options: RequestOptions = {}): Observable<Page<NutritionPlan>> {
    return this.http
      .get<unknown[]>(this.url, {
        params: this.toHttpParams(params),
        observe: 'response',
        context: this.context(options.notify ?? false),
      })
      .pipe(
        map(res => {
          const items = (res.body ?? []).map(toPlan);
          const header = Number(res.headers.get('X-Total-Count'));
          return {
            items,
            total: Number.isFinite(header) && res.headers.has('X-Total-Count') ? header : items.length,
            page: params.page ?? 1,
            limit: params.limit ?? null,
          };
        }),
      );
  }

  /** Detalle de un plan. Responde 404 (`ApiError.isNotFound`) si no existe. */
  get(id: string, options: RequestOptions = {}): Observable<NutritionPlan> {
    return this.http
      .get<unknown>(`${this.url}/${encodeURIComponent(id)}`, {
        context: this.context(options.notify ?? false),
      })
      .pipe(map(toPlan));
  }

  create(payload: PlanPayload, options: RequestOptions = {}): Observable<NutritionPlan> {
    return this.http
      .post<unknown>(this.url, payload, { context: this.context(options.notify ?? true) })
      .pipe(map(toPlan));
  }

  /** Reemplaza el plan completo (PUT). */
  update(id: string, payload: PlanPayload, options: RequestOptions = {}): Observable<NutritionPlan> {
    return this.http
      .put<unknown>(`${this.url}/${encodeURIComponent(id)}`, payload, {
        context: this.context(options.notify ?? true),
      })
      .pipe(map(toPlan));
  }

  /** Cambia solo algunos campos (PATCH), por ejemplo `{ isFavorite: true }`. */
  patch(id: string, changes: Partial<PlanPayload>, options: RequestOptions = {}): Observable<NutritionPlan> {
    return this.http
      .patch<unknown>(`${this.url}/${encodeURIComponent(id)}`, changes, {
        context: this.context(options.notify ?? true),
      })
      .pipe(map(toPlan));
  }

  remove(id: string, options: RequestOptions = {}): Observable<void> {
    return this.http
      .delete<unknown>(`${this.url}/${encodeURIComponent(id)}`, {
        context: this.context(options.notify ?? true),
      })
      .pipe(map(() => undefined));
  }

  // ── Helpers ───────────────────────────────────────────────

  private context(notify: boolean): HttpContext {
    return new HttpContext().set(SILENT_ERRORS, !notify);
  }

  /** Traduce nuestros parámetros a los de json-server (`q`, `_page`, `_limit`, `_sort`, `_order`). */
  private toHttpParams(p: PlanListParams): HttpParams {
    let params = new HttpParams();
    const q = p.q?.trim();
    if (q) params = params.set('q', q);
    if (p.page !== undefined) params = params.set('_page', p.page);
    if (p.limit !== undefined) params = params.set('_limit', p.limit);
    if (p.favorite) params = params.set('isFavorite', true);
    if (p.sort) {
      params = params.set('_sort', p.sort).set('_order', p.order ?? 'asc');
    }
    return params;
  }
}

/**
 * Convierte la respuesta de la API en un `NutritionPlan` seguro.
 * json-server puede devolver ids numéricos; aquí se normalizan a string para que
 * el modelo no cambie el día que se reemplace por una API con UUID.
 */
function toPlan(raw: unknown): NutritionPlan {
  const r = raw as Partial<NutritionPlan> & { id: string | number };
  return {
    id: String(r.id),
    name: r.name ?? '',
    description: r.description,
    macroGoals: r.macroGoals ?? { calories: 0, protein: 0, carbs: 0, fat: 0 },
    items: r.items ?? [],
    createdAt: r.createdAt ?? new Date(0).toISOString(),
    isFavorite: r.isFavorite ?? false,
    tags: r.tags ?? [],
    ...(r.ownerId !== undefined ? { ownerId: String(r.ownerId) } : {}),
  };
}
