import { UserRole } from '../models/app.models';

/** Segundos desde 1970 a `seconds` segundos de ahora (negativo = ya venció). */
export const expInSeconds = (seconds: number): number => Math.floor(Date.now() / 1000) + seconds;

/**
 * JWT de mentira solo para pruebas: el cliente únicamente lee el cuerpo, la firma
 * la verifica el servidor.
 */
export function fakeJwt(payload: { exp: number; sub?: string; role?: UserRole }): string {
  const encode = (value: object): string =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return [
    encode({ alg: 'HS256', typ: 'JWT' }),
    encode({ sub: 'usr-1', role: 'user', ...payload }),
    'firma-de-prueba',
  ].join('.');
}
