import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards/auth.guard';
import { unsavedChangesGuard } from './core/guards/unsaved-changes.guard';

export const routes: Routes = [
  // ── Public routes (with landing layout) ─────────────────
  {
    path: '',
    loadComponent: () =>
      import('./layouts/public-layout/public-layout.component').then(
        m => m.PublicLayoutComponent
      ),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/landing/landing.component').then(
            m => m.LandingComponent
          ),
        title: 'Deficcitto – Planifica tus comidas',
      },
      {
        path: 'caracteristicas',
        loadComponent: () =>
          import('./features/features-page/features-page.component').then(
            m => m.FeaturesPageComponent
          ),
        title: 'Características – Deficcitto',
      },
      {
        path: 'como-funciona',
        loadComponent: () =>
          import('./features/how-it-works-page/how-it-works-page.component').then(
            m => m.HowItWorksPageComponent
          ),
        title: 'Cómo Funciona – Deficcitto',
      },
      {
        path: 'testimonios',
        loadComponent: () =>
          import('./features/testimonials-page/testimonials-page.component').then(
            m => m.TestimonialsPageComponent
          ),
        title: 'Testimonios e Historias – Deficcitto',
      },
      { path: 'features', redirectTo: 'caracteristicas', pathMatch: 'full' },
      { path: 'how-it-works', redirectTo: 'como-funciona', pathMatch: 'full' },
      { path: 'testimonials', redirectTo: 'testimonios', pathMatch: 'full' },
    ],
  },

  // ── Auth routes (split-screen layout, protected by guestGuard) ──
  {
    path: 'auth',
    loadComponent: () =>
      import('./layouts/auth-layout/auth-layout.component').then(
        m => m.AuthLayoutComponent
      ),
    canActivate: [guestGuard],
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/auth/login/login.component').then(
            m => m.LoginComponent
          ),
        title: 'Iniciar sesión – Deficcitto',
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./features/auth/register/register.component').then(
            m => m.RegisterComponent
          ),
        title: 'Crear cuenta – Deficcitto',
      },
      {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full',
      },
    ],
  },

  // ── Protected routes (grouped under Private Layout & authGuard) ──
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layouts/private-layout/private-layout.component').then(
        m => m.PrivateLayoutComponent
      ),
    children: [
      {
        path: 'dashboard',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            m => m.DashboardComponent
          ),
        title: 'Dashboard – Deficcitto',
      },
      {
        path: 'dashboard/planes/:id',
        loadComponent: () =>
          import(
            './features/dashboard/components/plan-detail/plan-detail.component'
          ).then(m => m.PlanDetailComponent),
        title: 'Detalle del Plan – Deficcitto',
      },
      {
        path: 'dashboard/planes/:id/editar',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import(
            './features/dashboard/components/plan-edit/plan-edit.component'
          ).then(m => m.PlanEditComponent),
        title: 'Editar Plan – Deficcitto',
      },
      {
        path: 'admin/usuarios',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadComponent: () =>
          import('./features/admin/users/users.component').then(
            m => m.AdminUsersComponent
          ),
        title: 'Gestión de Usuarios – Deficcitto',
      },
      {
        path: 'admin',
        redirectTo: 'admin/usuarios',
        pathMatch: 'full',
      },
    ],
  },

  // ── Error views (403 Acceso Denegado & 404 No Encontrado) ──
  {
    path: '403',
    loadComponent: () =>
      import('./features/forbidden/forbidden.component').then(
        m => m.ForbiddenComponent
      ),
    title: '403 – Acceso denegado – Deficcitto',
  },
  {
    path: '404',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then(
        m => m.NotFoundComponent
      ),
    title: '404 – Página no encontrada – Deficcitto',
  },

  // ── Fallback (** -> vista 404) ───────────────────────────
  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then(
        m => m.NotFoundComponent
      ),
    title: '404 – Página no encontrada – Deficcitto',
  },
];
