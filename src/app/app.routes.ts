import { Routes } from '@angular/router';
import { authGuard, publicGuard } from './core/guards/auth.guard';

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

  // ── Auth routes (split-screen layout) ───────────────────
  {
    path: 'auth',
    loadComponent: () =>
      import('./layouts/auth-layout/auth-layout.component').then(
        m => m.AuthLayoutComponent
      ),
    canActivate: [publicGuard],
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

  // ── Protected routes ─────────────────────────────────────
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then(
        m => m.DashboardComponent
      ),
    title: 'Dashboard – Deficcitto',
  },

  // ── Fallback ──────────────────────────────────────────────
  {
    path: '**',
    redirectTo: '',
  },
];
