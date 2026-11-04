import { HttpErrorResponse } from '@angular/common/http';

/** Errores por campo que puede devolver la API: { "name": ["Es obligatorio"] } */
export type FieldErrors = Record<string, string[]>;

/** Forma del cuerpo de error que documenta el contrato de la API (ver README). */
interface ApiErrorBody {
  message?: unknown;
  errors?: unknown;
}

/** Estado que usamos cuando el fallo no vino de una respuesta HTTP. */
export const UNKNOWN_STATUS = -1;

/**
 * Error normalizado de la API. Es lo único que ven los servicios y componentes:
 * nunca un `HttpErrorResponse` crudo.
 *
 * - `status`: código HTTP. `0` = sin conexión; `-1` = error no HTTP.
 * - `message`: texto listo para mostrar al usuario.
 * - `fieldErrors`: errores por campo (para pintarlos en un formulario).
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fieldErrors: FieldErrors = {},
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = 'ApiError';
  }

  get isNetworkError(): boolean { return this.status === 0; }
  get isNotFound(): boolean { return this.status === 404; }
  get isValidationError(): boolean { return this.status === 400 || this.status === 422; }
  get isServerError(): boolean { return this.status >= 500; }

  /** Título corto para el aviso (toast). */
  get title(): string {
    if (this.isNetworkError) return 'Sin conexión';
    if (this.isServerError) return 'Error del servidor';
    return 'No se pudo completar';
  }
}

const DEFAULT_MESSAGES: Record<number, string> = {
  0:   'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
  400: 'Los datos enviados no son válidos. Revísalos e inténtalo de nuevo.',
  401: 'Tu sesión no es válida. Inicia sesión de nuevo.',
  403: 'No tienes permiso para realizar esta acción.',
  404: 'No encontramos lo que buscabas.',
  409: 'Ya existe un registro con esos datos.',
  422: 'Los datos enviados no son válidos. Revísalos e inténtalo de nuevo.',
};

const SERVER_MESSAGE = 'El servidor tuvo un problema. Inténtalo de nuevo en unos minutos.';
const FALLBACK_MESSAGE = 'No se pudo completar la operación. Inténtalo de nuevo.';

/** Estados en los que el mensaje del servidor está pensado para el usuario. */
const SERVER_MESSAGE_ALLOWED = new Set([400, 409, 422]);

/**
 * Único punto donde se traduce un fallo cualquiera a `ApiError`.
 * Lo usa el interceptor global; no hace falta llamarlo desde componentes.
 */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof HttpErrorResponse) {
    const body = (typeof error.error === 'object' && error.error !== null
      ? error.error
      : {}) as ApiErrorBody;

    const serverMessage =
      typeof body.message === 'string' && body.message.trim() ? body.message.trim() : null;

    let message: string;
    if (serverMessage && SERVER_MESSAGE_ALLOWED.has(error.status)) {
      message = serverMessage;
    } else if (error.status >= 500) {
      message = SERVER_MESSAGE;
    } else {
      message = DEFAULT_MESSAGES[error.status] ?? FALLBACK_MESSAGE;
    }

    return new ApiError(error.status, message, parseFieldErrors(body.errors), error);
  }

  return new ApiError(UNKNOWN_STATUS, FALLBACK_MESSAGE, {}, error);
}

function parseFieldErrors(raw: unknown): FieldErrors {
  if (typeof raw !== 'object' || raw === null) return {};
  const result: FieldErrors = {};
  for (const [field, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      result[field] = value.filter((v): v is string => typeof v === 'string');
    } else if (typeof value === 'string') {
      result[field] = [value];
    }
  }
  return result;
}
