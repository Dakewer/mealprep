import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { API_BASE_URL } from '../config/api-base-url.token';
import { WS_URL } from '../config/ws-url.token';
import { RealtimeMessage, User } from '../models/app.models';
import { expInSeconds, fakeJwt } from '../testing/fake-jwt';
import { AuthService, TOKEN_KEY, USER_KEY } from './auth.service';
import {
  CLOSE_TOKEN_EXPIRED,
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
  RealtimeService,
  WEBSOCKET_FACTORY,
} from './realtime.service';

const USER: User = { id: 'usr-1', name: 'Ana López', email: 'ana@test.com', role: 'user' };

/** WebSocket de mentira: se controla desde la prueba (abrir, recibir, cerrar). */
class FakeSocket {
  static instances: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  closedWith: number | null = null;

  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }
  open(): void { this.onopen?.(); }
  receive(message: unknown): void { this.onmessage?.({ data: typeof message === 'string' ? message : JSON.stringify(message) }); }
  /** Cierre que viene del servidor o de la red. */
  drop(code = 1006): void { this.onclose?.({ code }); }
  close(code?: number): void { this.closedWith = code ?? 1000; }
}

const last = (): FakeSocket => FakeSocket.instances[FakeSocket.instances.length - 1];

describe('RealtimeService', () => {
  let auth: AuthService;
  let realtime: RealtimeService;

  const login = (token = fakeJwt({ exp: expInSeconds(3600) })) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(USER));
  };

  /** Crea los servicios y deja correr el effect que abre (o no) la conexión. */
  function create(): void {
    auth = TestBed.inject(AuthService);
    realtime = TestBed.inject(RealtimeService);
    TestBed.tick();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test' },
        { provide: WS_URL, useValue: 'ws://api.test:3000' },
        { provide: WEBSOCKET_FACTORY, useValue: (url: string) => new FakeSocket(url) as unknown as WebSocket },
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  it('sin sesión no abre ninguna conexión', () => {
    create();

    expect(FakeSocket.instances).toHaveLength(0);
    expect(realtime.connectionStatus()).toBe('disconnected');
  });

  it('con sesión abre UNA conexión con el JWT en la URL y pasa a connected', () => {
    const token = fakeJwt({ exp: expInSeconds(3600) });
    login(token);
    create();

    expect(FakeSocket.instances).toHaveLength(1);
    expect(last().url).toBe(`ws://api.test:3000/?token=${token}`);
    expect(realtime.connectionStatus()).toBe('reconnecting'); // abriendo

    last().open();
    expect(realtime.connectionStatus()).toBe('connected');
  });

  it('abre la conexión al iniciar sesión y la cierra al hacer logout()', async () => {
    create();
    expect(FakeSocket.instances).toHaveLength(0);

    const token = fakeJwt({ exp: expInSeconds(3600) });
    const logged = auth.login({ email: 'ana@test.com', password: 'Clave12345' });
    TestBed.inject(HttpTestingController).expectOne('http://api.test/auth/login').flush({ token, user: USER });
    await logged;
    TestBed.tick();

    expect(FakeSocket.instances).toHaveLength(1);
    expect(last().url).toContain(`token=${token}`);
    const socket = last();
    socket.open();
    expect(realtime.connectionStatus()).toBe('connected');

    auth.logout();
    TestBed.tick();

    expect(socket.closedWith).toBe(1000);
    expect(realtime.connectionStatus()).toBe('disconnected');
    vi.advanceTimersByTime(RECONNECT_MAX_MS * 2);
    expect(FakeSocket.instances).toHaveLength(1); // no reintenta tras un logout
  });

  it('reconecta con backoff exponencial y vuelve a connected', () => {
    login();
    create();
    last().open();

    last().drop();
    expect(realtime.connectionStatus()).toBe('reconnecting');
    expect(FakeSocket.instances).toHaveLength(1);

    vi.advanceTimersByTime(RECONNECT_BASE_MS * 1.2); // 1.er intento: ~1 s
    expect(FakeSocket.instances).toHaveLength(2);

    last().drop(); // falla sin llegar a abrir: el siguiente espera ~2 s
    vi.advanceTimersByTime(RECONNECT_BASE_MS * 1.2);
    expect(FakeSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(RECONNECT_BASE_MS * 1.2);
    expect(FakeSocket.instances).toHaveLength(3);

    last().open();
    expect(realtime.connectionStatus()).toBe('connected');

    // al conectar, el backoff se reinicia
    last().drop();
    vi.advanceTimersByTime(RECONNECT_BASE_MS * 1.2);
    expect(FakeSocket.instances).toHaveLength(4);
  });

  it('el backoff no pasa del máximo', () => {
    login();
    create();
    for (let i = 0; i < 10; i++) {
      last().drop();
      vi.advanceTimersByTime(RECONNECT_MAX_MS * 1.2);
    }
    const before = FakeSocket.instances.length;
    last().drop();
    vi.advanceTimersByTime(RECONNECT_MAX_MS * 1.2);
    expect(FakeSocket.instances).toHaveLength(before + 1);
  });

  it('con 4401 (token vencido) no reintenta y deja la sesión cerrada si el JWT venció', () => {
    const token = fakeJwt({ exp: expInSeconds(60) });
    login(token);
    create();
    last().open();

    vi.setSystemTime(Date.now() + 120_000); // ya pasó el exp
    last().drop(CLOSE_TOKEN_EXPIRED);
    TestBed.tick();

    expect(realtime.connectionStatus()).toBe('disconnected');
    expect(auth.isAuthenticated()).toBe(false);
    vi.advanceTimersByTime(RECONNECT_MAX_MS * 2);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it('si al caerse la conexión el token ya no sirve, no reintenta', () => {
    login(fakeJwt({ exp: expInSeconds(30) }));
    create();
    last().open();

    vi.setSystemTime(Date.now() + 60_000);
    last().drop();

    expect(realtime.connectionStatus()).toBe('disconnected');
    vi.advanceTimersByTime(RECONNECT_MAX_MS * 2);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it('publica los eventos del servidor y filtra por nombre con on()', () => {
    login();
    create();
    last().open();

    const all: RealtimeMessage[] = [];
    const deleted: string[] = [];
    realtime.events$.subscribe(m => all.push(m));
    realtime.on('plan:deleted').subscribe(m => deleted.push(m.data.id));

    last().receive({ event: 'plan:updated', data: { id: '1', name: 'A' }, actorId: 'usr-2', at: '2026-11-01T00:00:00Z' });
    last().receive({ event: 'plan:deleted', data: { id: '7' }, actorId: 'usr-1', at: '2026-11-01T00:00:01Z' });

    expect(all.map(m => m.event)).toEqual(['plan:updated', 'plan:deleted']);
    expect(deleted).toEqual(['7']);
  });

  it('ignora mensajes mal formados, desconocidos o sin datos', () => {
    login();
    create();
    last().open();
    const all: RealtimeMessage[] = [];
    realtime.events$.subscribe(m => all.push(m));

    last().receive('esto no es json');
    last().receive({ event: 'otro:evento', data: {} });
    last().receive({ event: 'plan:created' });
    last().receive(null);

    expect(all).toHaveLength(0);
  });
});
