import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../config/api-base-url.token';
import { AuthResponse, RegisterData, User } from '../models/app.models';
import { expInSeconds, fakeJwt } from '../testing/fake-jwt';
import { AuthService, TOKEN_KEY, USER_KEY } from './auth.service';

const BASE = 'http://api.test';

const USER: User = {
  id: 'usr-1',
  name: 'Ana López',
  email: 'ana@test.com',
  role: 'user',
  avatarInitials: 'AL',
};

const REGISTER: RegisterData = {
  name: ' Ana López ',
  email: 'ana@test.com',
  password: 'Clave12345',
  confirmPassword: 'Clave12345',
  objective: 'maintenance',
  acceptTerms: true,
};

describe('AuthService', () => {
  let http: HttpTestingController;

  /** Crea el servicio. Lo guardado en localStorage antes de llamarla es la "sesión de antes". */
  function create(stored: { token?: string; user?: User } = {}): AuthService {
    if (stored.token) localStorage.setItem(TOKEN_KEY, stored.token);
    if (stored.user) localStorage.setItem(USER_KEY, JSON.stringify(stored.user));

    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(AuthService);
  }

  const response = (): AuthResponse => ({ token: fakeJwt({ exp: expInSeconds(3600) }), user: USER });

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    });
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
    vi.useRealTimers();
  });

  describe('login', () => {
    it('envía las credenciales, guarda el token en localStorage y deja la sesión iniciada', async () => {
      const auth = create();
      const res = response();

      const pending = auth.login({ email: ' ana@test.com ', password: 'Clave12345' });
      const req = http.expectOne(`${BASE}/auth/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'ana@test.com', password: 'Clave12345' });
      req.flush(res);

      expect(await pending).toBe(true);
      expect(auth.isAuthenticated()).toBe(true);
      expect(auth.token()).toBe(res.token);
      expect(auth.currentUser()).toEqual(USER);
      expect(auth.status()).toBe('success');
      expect(localStorage.getItem(TOKEN_KEY)).toBe(res.token);
    });

    it('con credenciales incorrectas (401) devuelve false y no guarda nada', async () => {
      const auth = create();

      const pending = auth.login({ email: 'ana@test.com', password: 'mala' });
      http.expectOne(`${BASE}/auth/login`)
        .flush({ message: 'Correo o contraseña incorrectos.' }, { status: 401, statusText: 'Unauthorized' });

      expect(await pending).toBe(false);
      expect(auth.error()).toBe('Correo o contraseña incorrectos.');
      expect(auth.isAuthenticated()).toBe(false);
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    });

    it('sin correo o contraseña ni siquiera llama a la API', async () => {
      const auth = create();

      expect(await auth.login({ email: '  ', password: '' })).toBe(false);
      expect(auth.error()).toBe('Por favor, completa todos los campos.');
    });
  });

  describe('register', () => {
    it('envía solo nombre, correo y contraseña, y deja la sesión iniciada', async () => {
      const auth = create();

      const pending = auth.register(REGISTER);
      const req = http.expectOne(`${BASE}/auth/register`);
      expect(req.request.body).toEqual({ name: 'Ana López', email: 'ana@test.com', password: 'Clave12345' });
      req.flush(response(), { status: 201, statusText: 'Created' });

      expect(await pending).toBe(true);
      expect(auth.currentUser()?.email).toBe('ana@test.com');
      expect(localStorage.getItem(TOKEN_KEY)).not.toBeNull();
    });

    it('si las contraseñas no coinciden no llama a la API', async () => {
      const auth = create();

      expect(await auth.register({ ...REGISTER, confirmPassword: 'otra' })).toBe(false);
      expect(auth.error()).toBe('Las contraseñas no coinciden.');
    });

    it('si el correo ya existe (409) muestra el mensaje del servidor', async () => {
      const auth = create();

      const pending = auth.register(REGISTER);
      http.expectOne(`${BASE}/auth/register`)
        .flush({ message: 'Ya existe una cuenta con ese correo.' }, { status: 409, statusText: 'Conflict' });

      expect(await pending).toBe(false);
      expect(auth.error()).toBe('Ya existe una cuenta con ese correo.');
    });
  });

  describe('persistencia al recargar', () => {
    it('recupera la sesión guardada si el token sigue vigente', () => {
      const token = fakeJwt({ exp: expInSeconds(3600) });
      const auth = create({ token, user: USER });

      expect(auth.isAuthenticated()).toBe(true);
      expect(auth.token()).toBe(token);
      expect(auth.currentUser()).toEqual(USER);
    });

    it('descarta un token vencido y limpia el almacenamiento', () => {
      const auth = create({ token: fakeJwt({ exp: expInSeconds(-10) }), user: USER });

      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.currentUser()).toBeNull();
      expect(auth.logoutReason()).toBe('expired');
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(USER_KEY)).toBeNull();
    });

    it('descarta un token que no es un JWT', () => {
      const auth = create({ token: 'basura', user: USER });

      expect(auth.isAuthenticated()).toBe(false);
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    });

    it('ignora el usuario guardado si no corresponde al token', () => {
      const token = fakeJwt({ exp: expInSeconds(3600), sub: 'usr-9' });
      const auth = create({ token, user: USER });

      expect(auth.isAuthenticated()).toBe(true);
      expect(auth.currentUser()).toBeNull();
    });

    it('restoreSession pide /auth/me y actualiza al usuario', async () => {
      const auth = create({ token: fakeJwt({ exp: expInSeconds(3600) }), user: USER });

      const pending = auth.restoreSession();
      http.expectOne(`${BASE}/auth/me`).flush({ ...USER, name: 'Ana Actualizada' });
      await pending;

      expect(auth.currentUser()?.name).toBe('Ana Actualizada');
      expect(JSON.parse(localStorage.getItem(USER_KEY)!).name).toBe('Ana Actualizada');
    });

    it('restoreSession no pide nada si no hay sesión', async () => {
      const auth = create();

      await auth.restoreSession();

      http.expectNone(`${BASE}/auth/me`);
    });

    it('restoreSession conserva la sesión si no hay conexión', async () => {
      const auth = create({ token: fakeJwt({ exp: expInSeconds(3600) }), user: USER });

      const pending = auth.restoreSession();
      http.expectOne(`${BASE}/auth/me`).error(new ProgressEvent('error'));
      await pending;

      expect(auth.isAuthenticated()).toBe(true);
      expect(auth.currentUser()).toEqual(USER);
    });
  });

  describe('expiración (exp)', () => {
    it('checkSession: valid, missing y expired', () => {
      const sin = create();
      expect(sin.checkSession()).toBe('missing');

      TestBed.resetTestingModule();
      localStorage.clear();
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: BASE }],
      });
      const con = create({ token: fakeJwt({ exp: expInSeconds(60) }), user: USER });
      expect(con.checkSession()).toBe('valid');

      // pasa el tiempo: el mismo token ya venció
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(Date.now() + 61_000);

      expect(con.checkSession()).toBe('expired');
      expect(con.isAuthenticated()).toBe(false);
      expect(con.logoutReason()).toBe('expired');
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    });
  });

  describe('logout', () => {
    it('limpia token, usuario, estado y almacenamiento', async () => {
      const auth = create();
      const pending = auth.login({ email: 'ana@test.com', password: 'Clave12345' });
      http.expectOne(`${BASE}/auth/login`).flush(response());
      await pending;

      auth.logout();

      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.token()).toBeNull();
      expect(auth.currentUser()).toBeNull();
      expect(auth.status()).toBe('idle');
      expect(auth.error()).toBeNull();
      expect(auth.logoutReason()).toBe('manual');
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(USER_KEY)).toBeNull();
    });
  });
});
