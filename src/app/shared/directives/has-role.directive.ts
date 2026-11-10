import {
  Directive,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
  input,
} from '@angular/core';
import { UserRole } from '../../core/models/app.models';
import { AuthService } from '../../core/services/auth.service';

type RenderedBranch = 'none' | 'then' | 'else';

/**
 * Directiva estructural para mostrar u ocultar fragmentos de la interfaz según el rol activo.
 *
 * Ejemplos de uso:
 * ```html
 * <a *appHasRole="'admin'" routerLink="/admin/usuarios">Usuarios</a>
 * <section *appHasRole="['admin', 'user']; else invitadoTpl">...</section>
 * ```
 */
@Directive({
  selector: '[appHasRole]',
  standalone: true,
})
export class HasRoleDirective {
  private templateRef   = inject(TemplateRef<unknown>);
  private viewContainer = inject(ViewContainerRef);
  private auth          = inject(AuthService);

  /** Rol o lista de roles permitidos para renderizar la plantilla principal. */
  readonly appHasRole = input.required<UserRole | readonly UserRole[]>();

  /** Plantilla alternativa opcional cuando el usuario no cumple el rol (`*appHasRole="'admin'; else otra"`). */
  readonly appHasRoleElse = input<TemplateRef<unknown> | null>(null);

  private currentBranch: RenderedBranch = 'none';
  private currentElseRef: TemplateRef<unknown> | null = null;

  constructor() {
    effect(() => {
      // Leemos `this.auth.role()` dentro del effect para reaccionar al login y al logout.
      this.auth.role();
      const rawRoles = this.appHasRole();
      const elseTpl = this.appHasRoleElse();

      const roles: UserRole[] = Array.isArray(rawRoles)
        ? [...rawRoles]
        : rawRoles
          ? [rawRoles as UserRole]
          : [];

      const allowed = roles.length > 0 && this.auth.hasRole(...roles);
      this.updateView(allowed, elseTpl);
    });
  }

  private updateView(allowed: boolean, elseTpl: TemplateRef<unknown> | null): void {
    if (allowed) {
      if (this.currentBranch === 'then') return;
      this.viewContainer.clear();
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.currentBranch = 'then';
      this.currentElseRef = null;
      return;
    }

    if (elseTpl) {
      if (this.currentBranch === 'else' && this.currentElseRef === elseTpl) return;
      this.viewContainer.clear();
      this.viewContainer.createEmbeddedView(elseTpl);
      this.currentBranch = 'else';
      this.currentElseRef = elseTpl;
      return;
    }

    if (this.currentBranch !== 'none') {
      this.viewContainer.clear();
      this.currentBranch = 'none';
      this.currentElseRef = null;
    }
  }
}

/**
 * Directiva estructural para la regla de dueño de un plan (`admin` o propietario del recurso).
 *
 * Ejemplos de uso:
 * ```html
 * <button *appCanManage="plan" (click)="requestDelete(plan)">Eliminar</button>
 * <div *appCanManage="plan; else soloLectura">...</div>
 * ```
 */
@Directive({
  selector: '[appCanManage]',
  standalone: true,
})
export class CanManageDirective {
  private templateRef   = inject(TemplateRef<unknown>);
  private viewContainer = inject(ViewContainerRef);
  private auth          = inject(AuthService);

  /** Recurso con `ownerId` opcional que se evalúa contra `AuthService.canManage()`. */
  readonly appCanManage = input.required<{ ownerId?: string } | null | undefined>();

  /** Plantilla alternativa opcional (`*appCanManage="plan; else sinPermiso"`). */
  readonly appCanManageElse = input<TemplateRef<unknown> | null>(null);

  private currentBranch: RenderedBranch = 'none';
  private currentElseRef: TemplateRef<unknown> | null = null;

  constructor() {
    effect(() => {
      // Suscripción reactiva a usuario/rol activo y al plan recibido.
      this.auth.currentUser();
      this.auth.role();
      const target = this.appCanManage();
      const elseTpl = this.appCanManageElse();

      const allowed = this.auth.canManage(target);
      this.updateView(allowed, elseTpl);
    });
  }

  private updateView(allowed: boolean, elseTpl: TemplateRef<unknown> | null): void {
    if (allowed) {
      if (this.currentBranch === 'then') return;
      this.viewContainer.clear();
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.currentBranch = 'then';
      this.currentElseRef = null;
      return;
    }

    if (elseTpl) {
      if (this.currentBranch === 'else' && this.currentElseRef === elseTpl) return;
      this.viewContainer.clear();
      this.viewContainer.createEmbeddedView(elseTpl);
      this.currentBranch = 'else';
      this.currentElseRef = elseTpl;
      return;
    }

    if (this.currentBranch !== 'none') {
      this.viewContainer.clear();
      this.currentBranch = 'none';
      this.currentElseRef = null;
    }
  }
}
