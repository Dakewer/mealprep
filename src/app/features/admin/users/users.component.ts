import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { User } from '../../../core/models/app.models';
import { UsersApiService } from '../../../core/services/users-api.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { RippleDirective } from '../../../shared/directives/ripple.directive';

type ViewState = 'loading' | 'success' | 'error' | 'empty';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    RippleDirective,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  template: `
    <div class="admin-users-page">
      <!-- Breadcrumb / Back button -->
      <div class="page-top-actions">
        <a routerLink="/dashboard" class="btn btn--ghost-dark btn--sm back-link" appRipple>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
          <span>Volver al Dashboard</span>
        </a>
      </div>

      <!-- Main Header -->
      <header class="page-header">
        <div class="page-header__main">
          <div class="header-icon-badge" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div>
            <h1 class="page-title">Gestión de Usuarios</h1>
            <p class="page-subtitle">Visualiza y supervisa los usuarios y roles registrados en la plataforma.</p>
          </div>
        </div>

        <button
          type="button"
          class="btn btn--ghost-dark btn--sm refresh-btn"
          (click)="loadUsers()"
          [disabled]="state() === 'loading'"
          appRipple
        >
          <svg class="refresh-icon" [class.spinning]="state() === 'loading'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          <span>Actualizar</span>
        </button>
      </header>

      <!-- Stats Cards -->
      <section class="stats-grid" aria-label="Métricas de usuarios">
        <div class="stat-card">
          <div class="stat-card__icon stat-card__icon--total" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/>
              <line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
          </div>
          <div class="stat-card__body">
            <span class="stat-card__value">{{ totalUsers() }}</span>
            <span class="stat-card__label">Usuarios totales</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card__icon stat-card__icon--admins" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div class="stat-card__body">
            <span class="stat-card__value">{{ totalAdmins() }}</span>
            <span class="stat-card__label">Administradores</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card__icon stat-card__icon--standard" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="8" r="5"/>
              <path d="M20 21a8 8 0 1 0-16 0"/>
            </svg>
          </div>
          <div class="stat-card__body">
            <span class="stat-card__value">{{ totalRegularUsers() }}</span>
            <span class="stat-card__label">Usuarios estándar</span>
          </div>
        </div>
      </section>

      <!-- Users Table Card -->
      <div class="table-container-card">
        <div class="table-toolbar">
          <div class="search-wrap">
            <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              class="search-input"
              placeholder="Filtrar por nombre o correo..."
              [value]="filterQuery()"
              (input)="updateFilter($event)"
              aria-label="Buscar usuarios"
            />
          </div>
          <span class="results-badge">{{ filteredUsers().length }} resultados</span>
        </div>

        @switch (state()) {
          @case ('loading') {
            <div class="table-loading-skeleton" aria-busy="true" aria-label="Cargando usuarios...">
              @for (row of [1, 2, 3, 4]; track row) {
                <div class="skeleton-row">
                  <app-skeleton variant="circle" width="2.5rem" height="2.5rem"></app-skeleton>
                  <div class="skeleton-col">
                    <app-skeleton variant="text" width="60%"></app-skeleton>
                    <app-skeleton variant="text" width="40%"></app-skeleton>
                  </div>
                  <app-skeleton variant="text" width="20%"></app-skeleton>
                  <app-skeleton variant="rect" width="5rem" height="1.5rem"></app-skeleton>
                </div>
              }
            </div>
          }

          @case ('error') {
            <div class="table-error-wrap">
              <app-error-state
                title="No se pudieron cargar los usuarios"
                message="Ocurrió un error al consultar el servicio de usuarios (GET /users)."
                retryLabel="Reintentar carga"
                (retry)="loadUsers()"
              ></app-error-state>
            </div>
          }

          @case ('empty') {
            <div class="table-empty-wrap">
              <app-empty-state
                title="No se encontraron usuarios"
                message="No hay registros que coincidan con el criterio de búsqueda."
                actionLabel="Limpiar búsqueda"
                (action)="clearFilter()"
              ></app-empty-state>
            </div>
          }

          @case ('success') {
            <div class="table-responsive">
              <table class="users-table">
                <thead>
                  <tr>
                    <th scope="col">Usuario</th>
                    <th scope="col">Correo electrónico</th>
                    <th scope="col">Rol</th>
                    <th scope="col">ID de Cuenta</th>
                    <th scope="col">Registro</th>
                  </tr>
                </thead>
                <tbody>
                  @for (user of filteredUsers(); track user.id) {
                    <tr class="table-row">
                      <!-- Usuario (Avatar + Nombre) -->
                      <td class="col-user">
                        <div class="user-cell">
                          <span class="user-cell__avatar" aria-hidden="true">
                            {{ user.avatarInitials || getInitials(user.name) }}
                          </span>
                          <div class="user-cell__details">
                            <span class="user-cell__name">{{ user.name }}</span>
                          </div>
                        </div>
                      </td>

                      <!-- Correo -->
                      <td class="col-email">
                        <span class="email-text">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                            <polyline points="22,6 12,13 2,6"/>
                          </svg>
                          <span>{{ user.email }}</span>
                        </span>
                      </td>

                      <!-- Rol -->
                      <td class="col-role">
                        @if (user.role === 'admin') {
                          <span class="role-badge role-badge--admin">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            </svg>
                            <span>Administrador</span>
                          </span>
                        } @else {
                          <span class="role-badge role-badge--user">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                              <circle cx="12" cy="7" r="4"/>
                              <path d="M5 21a7 7 0 0 1 14 0"/>
                            </svg>
                            <span>Usuario</span>
                          </span>
                        }
                      </td>

                      <!-- ID -->
                      <td class="col-id">
                        <code class="user-id-code">{{ user.id }}</code>
                      </td>

                      <!-- Fecha -->
                      <td class="col-date">
                        <span class="date-text">
                          {{ (user.createdAt | date: 'dd MMM yyyy') || 'Reciente' }}
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .admin-users-page {
      max-width: 1100px;
      margin: 0 auto;
      padding: 2rem;
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
    }

    .page-top-actions {
      display: flex;
      align-items: center;
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
      font-weight: 600;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .page-header__main {
      display: flex;
      align-items: center;
      gap: 1.25rem;
    }

    .header-icon-badge {
      width: 3.5rem;
      height: 3.5rem;
      border-radius: var(--radius-xl, 16px);
      background: #ecfdf5;
      color: var(--clr-primary-600, #16a34a);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(22, 163, 74, 0.12);
    }

    .page-title {
      font-size: 1.75rem;
      font-weight: 900;
      color: var(--text-on-light, #111827);
      margin: 0;
      letter-spacing: -0.02em;
    }

    .page-subtitle {
      font-size: 0.9375rem;
      color: var(--text-on-light-3, #6b7280);
      margin: 0.25rem 0 0 0;
    }

    .refresh-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      font-weight: 600;
    }

    .refresh-icon.spinning {
      animation: spin 800ms linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Stats Cards */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.25rem;
    }

    .stat-card {
      background: #ffffff;
      border: 1px solid var(--clr-light-200, #e5e7eb);
      border-radius: var(--radius-xl, 16px);
      padding: 1.25rem 1.5rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
    }

    .stat-card__icon {
      width: 2.75rem;
      height: 2.75rem;
      border-radius: var(--radius-lg, 12px);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .stat-card__icon--total {
      background: #ecfdf5;
      color: #16a34a;
    }

    .stat-card__icon--admins {
      background: #fef3c7;
      color: #b45309;
    }

    .stat-card__icon--standard {
      background: #f1f5f9;
      color: #475569;
    }

    .stat-card__body {
      display: flex;
      flex-direction: column;
    }

    .stat-card__value {
      font-size: 1.5rem;
      font-weight: 900;
      color: var(--text-on-light, #111827);
      line-height: 1.1;
    }

    .stat-card__label {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--text-on-light-3, #6b7280);
      margin-top: 0.2rem;
    }

    /* Table Container */
    .table-container-card {
      background: #ffffff;
      border: 1px solid var(--clr-light-200, #e5e7eb);
      border-radius: var(--radius-2xl, 20px);
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.04);
      overflow: hidden;
    }

    .table-toolbar {
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--clr-light-200, #e5e7eb);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      background: #ffffff;
    }

    .search-wrap {
      position: relative;
      flex: 1;
      max-width: 360px;
    }

    .search-icon {
      position: absolute;
      left: 0.875rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-on-light-3, #9ca3af);
      pointer-events: none;
    }

    .search-input {
      width: 100%;
      padding: 0.55rem 0.875rem 0.55rem 2.5rem;
      border: 1px solid var(--clr-light-200, #e5e7eb);
      border-radius: var(--radius-lg, 12px);
      font-size: 0.875rem;
      background: var(--clr-light-50, #f9fafb);
      transition: all var(--transition-fast, 150ms ease);
    }

    .search-input:focus {
      outline: none;
      background: #ffffff;
      border-color: var(--clr-primary-500, #22c55e);
      box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.15);
    }

    .results-badge {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--text-on-light-3, #6b7280);
    }

    .table-responsive {
      overflow-x: auto;
    }

    .users-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    .users-table th {
      padding: 0.875rem 1.5rem;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-on-light-3, #6b7280);
      background: var(--clr-light-50, #f9fafb);
      border-bottom: 1px solid var(--clr-light-200, #e5e7eb);
    }

    .users-table td {
      padding: 1.1rem 1.5rem;
      border-bottom: 1px solid var(--clr-light-100, #f3f4f6);
      vertical-align: middle;
    }

    .table-row:hover {
      background: var(--clr-light-50, #f9fafb);
    }

    .user-cell {
      display: flex;
      align-items: center;
      gap: 0.875rem;
    }

    .user-cell__avatar {
      width: 2.35rem;
      height: 2.35rem;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--clr-primary-500, #22c55e), var(--clr-primary-700, #15803d));
      color: #ffffff;
      font-size: 0.8125rem;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .user-cell__name {
      font-size: 0.9375rem;
      font-weight: 700;
      color: var(--text-on-light, #111827);
    }

    .email-text {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: var(--text-on-light-2, #4b5563);
    }

    .role-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      padding: 0.25rem 0.65rem;
      border-radius: 9999px;
    }

    .role-badge--admin {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #bbf7d0;
    }

    .role-badge--user {
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #e2e8f0;
    }

    .user-id-code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.8125rem;
      background: var(--clr-light-100, #f3f4f6);
      padding: 0.2rem 0.5rem;
      border-radius: var(--radius-sm, 6px);
      color: var(--text-on-light-2, #4b5563);
    }

    .date-text {
      font-size: 0.875rem;
      color: var(--text-on-light-3, #6b7280);
    }

    /* Skeleton Loading */
    .table-loading-skeleton {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .skeleton-row {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }

    .skeleton-col {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      flex: 1;
    }

    .table-error-wrap,
    .table-empty-wrap {
      padding: 3rem 1.5rem;
    }

    @media (max-width: 768px) {
      .admin-users-page {
        padding: 1.25rem;
      }
      .stats-grid {
        grid-template-columns: 1fr;
      }
      .table-toolbar {
        flex-direction: column;
        align-items: stretch;
      }
      .search-wrap {
        max-width: 100%;
      }
    }
  `],
})
export class AdminUsersComponent implements OnInit {
  private readonly usersApi = inject(UsersApiService);

  readonly state = signal<ViewState>('loading');
  readonly users = signal<User[]>([]);
  readonly filterQuery = signal<string>('');

  readonly filteredUsers = computed(() => {
    const q = this.filterQuery().trim().toLowerCase();
    const list = this.users();
    if (!q) return list;
    return list.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.role && u.role.toLowerCase().includes(q))
    );
  });

  readonly totalUsers = computed(() => this.users().length);
  readonly totalAdmins = computed(() => this.users().filter(u => u.role === 'admin').length);
  readonly totalRegularUsers = computed(() => this.users().filter(u => u.role !== 'admin').length);

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.state.set('loading');
    this.usersApi.getUsers().subscribe({
      next: (data) => {
        this.users.set(data);
        this.state.set(data.length === 0 ? 'empty' : 'success');
      },
      error: () => {
        this.state.set('error');
      },
    });
  }

  updateFilter(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.filterQuery.set(val);
    if (this.filteredUsers().length === 0 && this.users().length > 0) {
      this.state.set('empty');
    } else if (this.users().length > 0) {
      this.state.set('success');
    }
  }

  clearFilter(): void {
    this.filterQuery.set('');
    this.state.set(this.users().length === 0 ? 'empty' : 'success');
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map(n => n.charAt(0).toUpperCase())
      .join('');
  }
}
