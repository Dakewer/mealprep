import { Component, computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { User, UserRole } from '../../core/models/app.models';
import { AuthService } from '../../core/services/auth.service';
import { CanManageDirective, HasRoleDirective } from './has-role.directive';

class FakeAuthService {
  readonly currentUser = signal<User | null>(null);
  readonly role = computed<UserRole | null>(() => this.currentUser()?.role ?? null);

  hasRole(...roles: UserRole[]): boolean {
    const current = this.role();
    return current !== null && roles.includes(current);
  }

  canManage(plan: { ownerId?: string } | null | undefined): boolean {
    if (!plan) return false;
    const user = this.currentUser();
    if (!user) return false;
    if (this.hasRole('admin')) return true;
    return Boolean(plan.ownerId && plan.ownerId === user.id);
  }

  loginAs(id: string, role: UserRole): void {
    this.currentUser.set({
      id,
      name: `Usuario ${id}`,
      email: `${id}@deficcitto.com`,
      avatarInitials: 'US',
      role,
    });
  }

  logout(): void {
    this.currentUser.set(null);
  }
}

@Component({
  standalone: true,
  imports: [HasRoleDirective, CanManageDirective],
  template: `
    <div id="only-admin" *appHasRole="'admin'">Panel Admin</div>

    <div id="admin-or-user" *appHasRole="['admin', 'user']">Contenido Autenticado</div>

    <div id="with-else" *appHasRole="'admin'; else sinPermiso">Vista Admin</div>
    <ng-template #sinPermiso>
      <span id="fallback-role">Sin permiso de rol</span>
    </ng-template>

    <div id="manage-box" *appCanManage="plan(); else noManage">Botones CRUD</div>
    <ng-template #noManage>
      <span id="fallback-manage">Solo lectura</span>
    </ng-template>
  `,
})
class HostTestComponent {
  plan = signal<{ ownerId?: string }>({ ownerId: 'usr-002' });
}

describe('HasRoleDirective y CanManageDirective', () => {
  let fixture: ComponentFixture<HostTestComponent>;
  let auth: FakeAuthService;

  beforeEach(() => {
    auth = new FakeAuthService();
    TestBed.configureTestingModule({
      imports: [HostTestComponent],
      providers: [{ provide: AuthService, useValue: auth }],
    });
    fixture = TestBed.createComponent(HostTestComponent);
    fixture.detectChanges();
  });

  it('no renderiza bloques protegidos cuando no hay sesión activa y muestra el bloque else', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#only-admin')).toBeNull();
    expect(el.querySelector('#admin-or-user')).toBeNull();
    expect(el.querySelector('#with-else')).toBeNull();
    expect(el.querySelector('#fallback-role')?.textContent).toContain('Sin permiso de rol');
  });

  it('renderiza según el rol y reacciona cuando el rol cambia (login → cambio de rol → logout)', () => {
    const el = fixture.nativeElement as HTMLElement;

    // Login como 'user'
    auth.loginAs('usr-002', 'user');
    fixture.detectChanges();

    expect(el.querySelector('#only-admin')).toBeNull();
    expect(el.querySelector('#admin-or-user')?.textContent).toContain('Contenido Autenticado');
    expect(el.querySelector('#with-else')).toBeNull();
    expect(el.querySelector('#fallback-role')).not.toBeNull();

    // Cambio a 'admin'
    auth.loginAs('usr-001', 'admin');
    fixture.detectChanges();

    expect(el.querySelector('#only-admin')?.textContent).toContain('Panel Admin');
    expect(el.querySelector('#admin-or-user')).not.toBeNull();
    expect(el.querySelector('#with-else')?.textContent).toContain('Vista Admin');
    expect(el.querySelector('#fallback-role')).toBeNull();

    // Logout → limpia las vistas protegidas y restaura else
    auth.logout();
    fixture.detectChanges();

    expect(el.querySelector('#only-admin')).toBeNull();
    expect(el.querySelector('#admin-or-user')).toBeNull();
    expect(el.querySelector('#with-else')).toBeNull();
    expect(el.querySelector('#fallback-role')).not.toBeNull();
  });

  it('appCanManage permite gestionar al dueño y al admin, pero no a otro user', () => {
    const el = fixture.nativeElement as HTMLElement;

    // 1. Dueño del plan (usr-002) → sí puede
    auth.loginAs('usr-002', 'user');
    fixture.detectChanges();
    expect(el.querySelector('#manage-box')?.textContent).toContain('Botones CRUD');
    expect(el.querySelector('#fallback-manage')).toBeNull();

    // 2. Otro usuario normal (usr-003) → no puede, muestra else
    auth.loginAs('usr-003', 'user');
    fixture.detectChanges();
    expect(el.querySelector('#manage-box')).toBeNull();
    expect(el.querySelector('#fallback-manage')?.textContent).toContain('Solo lectura');

    // 3. Admin (usr-001) → sí puede aunque el plan sea de usr-002
    auth.loginAs('usr-001', 'admin');
    fixture.detectChanges();
    expect(el.querySelector('#manage-box')?.textContent).toContain('Botones CRUD');
    expect(el.querySelector('#fallback-manage')).toBeNull();
  });
});

