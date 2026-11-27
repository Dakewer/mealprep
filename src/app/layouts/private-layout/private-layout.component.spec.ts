import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { User, UserRole } from '../../core/models/app.models';
import { AuthService } from '../../core/services/auth.service';
import { ConnectionStatus, RealtimeService } from '../../core/services/realtime.service';
import { PrivateLayoutComponent } from './private-layout.component';

describe('PrivateLayoutComponent · B1 Indicador de estado de la conexión', () => {
  let fixture: ComponentFixture<PrivateLayoutComponent>;
  let connectionStatusSignal: ReturnType<typeof signal<ConnectionStatus>>;

  beforeEach(async () => {
    connectionStatusSignal = signal<ConnectionStatus>('disconnected');
    const currentUser = signal<User | null>({
      id: 'usr-1',
      name: 'Carlos',
      email: 'carlos@test.com',
      role: 'user',
    });
    const role = signal<UserRole | null>('user');

    await TestBed.configureTestingModule({
      imports: [PrivateLayoutComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            currentUser,
            role,
            hasRole: (...roles: UserRole[]) => roles.includes('user'),
            logout: () => {},
          },
        },
        {
          provide: RealtimeService,
          useValue: {
            connectionStatus: connectionStatusSignal.asReadonly(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PrivateLayoutComponent);
    fixture.detectChanges();
  });

  it('muestra "Desconectado" en rojo/gris cuando connectionStatus es disconnected', () => {
    connectionStatusSignal.set('disconnected');
    fixture.detectChanges();

    const badge: HTMLElement = fixture.nativeElement.querySelector('[data-testid="connection-status-badge"]');
    expect(badge).toBeTruthy();
    expect(badge.textContent?.trim()).toBe('Desconectado');
    expect(badge.classList.contains('connection-badge--disconnected')).toBe(true);
  });

  it('muestra "Conectado" en verde cuando connectionStatus pasa a connected', () => {
    connectionStatusSignal.set('connected');
    fixture.detectChanges();

    const badge: HTMLElement = fixture.nativeElement.querySelector('[data-testid="connection-status-badge"]');
    expect(badge.textContent?.trim()).toBe('Conectado');
    expect(badge.classList.contains('connection-badge--connected')).toBe(true);
  });

  it('muestra "Reconectando..." en ámbar con pulso cuando connectionStatus es reconnecting', () => {
    connectionStatusSignal.set('reconnecting');
    fixture.detectChanges();

    const badge: HTMLElement = fixture.nativeElement.querySelector('[data-testid="connection-status-badge"]');
    const dot: HTMLElement = badge.querySelector('.connection-badge__dot')!;
    expect(badge.textContent?.trim()).toBe('Reconectando...');
    expect(badge.classList.contains('connection-badge--reconnecting')).toBe(true);
    expect(dot.classList.contains('connection-badge__dot--pulse')).toBe(true);
  });
});
