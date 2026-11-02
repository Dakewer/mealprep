import { HttpErrorResponse } from '@angular/common/http';
import { ApiError, UNKNOWN_STATUS, toApiError } from './api-error';

const http = (status: number, error: unknown = null) =>
  new HttpErrorResponse({ status, error, url: 'http://api.test/plans' });

describe('toApiError', () => {
  it('traduce "sin conexión" (status 0)', () => {
    const e = toApiError(http(0));
    expect(e.isNetworkError).toBe(true);
    expect(e.message).toContain('No se pudo conectar');
    expect(e.title).toBe('Sin conexión');
  });

  it('usa el mensaje del servidor solo en 400/409/422', () => {
    expect(toApiError(http(400, { message: 'Nombre obligatorio' })).message).toBe('Nombre obligatorio');
    expect(toApiError(http(409, { message: 'Nombre repetido' })).message).toBe('Nombre repetido');
    expect(toApiError(http(404, { message: 'detalle interno' })).message).toBe('No encontramos lo que buscabas.');
  });

  it('nunca muestra texto interno del servidor en errores 5xx', () => {
    const e = toApiError(http(500, { message: 'stack trace secreto' }));
    expect(e.message).not.toContain('secreto');
    expect(e.isServerError).toBe(true);
    expect(e.title).toBe('Error del servidor');
  });

  it('extrae errores por campo', () => {
    const e = toApiError(http(422, { errors: { name: ['Es obligatorio'], items: 'Agrega uno' } }));
    expect(e.fieldErrors).toEqual({ name: ['Es obligatorio'], items: ['Agrega uno'] });
    expect(e.isValidationError).toBe(true);
  });

  it('acepta cuerpos de texto o vacíos sin romperse', () => {
    expect(toApiError(http(404, 'Not Found')).isNotFound).toBe(true);
    expect(toApiError(http(503)).isServerError).toBe(true);
  });

  it('no vuelve a envolver un ApiError ni una excepción cualquiera', () => {
    const original = new ApiError(404, 'x');
    expect(toApiError(original)).toBe(original);
    expect(toApiError(new TypeError('boom')).status).toBe(UNKNOWN_STATUS);
  });
});
