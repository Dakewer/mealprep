import { Component, HostListener, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import {
  HasUnsavedChanges,
  UNSAVED_CHANGES_MESSAGE,
} from '../../core/guards/unsaved-changes.guard';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { PlanService } from '../../core/services/plan.service';
import { RippleDirective } from '../../shared/directives/ripple.directive';
import { PlanBuilderComponent } from './components/plan-builder/plan-builder.component';
import { PlanListComponent } from './components/plan-list/plan-list.component';
import { ShoppingListComponent } from './components/shopping-list/shopping-list.component';
import { TdeeCalculatorComponent } from './components/tdee-calculator/tdee-calculator.component';

export type DashboardTab = 'resumen' | 'crear' | 'planes' | 'compras';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    RippleDirective,
    TdeeCalculatorComponent, PlanBuilderComponent, PlanListComponent, ShoppingListComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements HasUnsavedChanges {
  authService  = inject(AuthService);
  notifService = inject(NotificationService);
  plans        = inject(PlanService);
  private router = inject(Router);

  planBuilder = viewChild<PlanBuilderComponent>(PlanBuilderComponent);

  readonly tabs: { id: DashboardTab; label: string }[] = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'crear',   label: 'Crear plan' },
    { id: 'planes',  label: 'Mis planes' },
    { id: 'compras', label: 'Compras' },
  ];

  activeTab = signal<DashboardTab>('resumen');

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
    }
  }

  setTab(tab: DashboardTab): void {
    if (tab !== this.activeTab() && this.hasUnsavedChanges()) {
      const ok =
        typeof window !== 'undefined' && typeof window.confirm === 'function'
          ? window.confirm(UNSAVED_CHANGES_MESSAGE)
          : true;
      if (!ok) return;
    }
    this.activeTab.set(tab);
  }

  hasUnsavedChanges(): boolean {
    return this.planBuilder()?.hasUnsavedChanges() ?? false;
  }

  logout(): void {
    this.authService.logout();
    this.notifService.info('Sesión cerrada correctamente.');
    this.router.navigate(['/']);
  }

  // ── Demo de notificaciones (de la entrega anterior) ──────
  demoSuccess(): void { this.notifService.success('Plan nutricional guardado correctamente.'); }
  demoError():   void { this.notifService.error('No se pudo eliminar el elemento. Intenta de nuevo.'); }
  demoWarning(): void { this.notifService.warning('Tu plan nutricional no ha sido guardado aún.'); }
  demoInfo():    void { this.notifService.info('Recuerda configurar tu TDEE en el perfil.'); }
}
