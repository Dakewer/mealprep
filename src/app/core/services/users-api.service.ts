import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { API_BASE_URL } from '../config/api-base-url.token';
import { User } from '../models/app.models';

const DEMO_SEED_USERS: User[] = [
  {
    id: 'usr-admin-1',
    name: 'Admin Deficcitto',
    email: 'admin@deficcitto.com',
    role: 'admin',
    avatarInitials: 'AD',
    createdAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'usr-002',
    name: 'Carlos Fitness',
    email: 'carlos@deficcitto.com',
    role: 'user',
    avatarInitials: 'CF',
    createdAt: '2026-10-15T10:30:00.000Z',
  },
  {
    id: 'usr-003',
    name: 'Lucía Nutrición',
    email: 'lucia@deficcitto.com',
    role: 'user',
    avatarInitials: 'LN',
    createdAt: '2026-10-20T14:15:00.000Z',
  },
];

@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly http    = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * Obtiene la lista de usuarios (GET /users).
   * Si la base de datos de prueba aún no tiene registros o falla la conexión,
   * provee usuarios demo para garantizar la operatividad de la interfaz.
   */
  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.baseUrl}/users`).pipe(
      map(users => (Array.isArray(users) && users.length > 0 ? users : DEMO_SEED_USERS)),
      catchError(() => of(DEMO_SEED_USERS))
    );
  }
}
