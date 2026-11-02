import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../errors/api-error';
import { NotificationService } from '../services/notification.service';
import { httpErrorInterceptor, silentErrors } from './http-error.interceptor';

describe('httpErrorInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let notifications: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    notifications = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    notifications.dismissAll();
    controller.verify();
  });

  it('convierte el fallo en ApiError y muestra un aviso', () => {
    let received: unknown;
    http.get('/plans').subscribe({ error: e => (received = e) });
    controller.expectOne('/plans').flush('x', { status: 500, statusText: 'Server Error' });

    expect(received).toBeInstanceOf(ApiError);
    expect((received as ApiError).status).toBe(500);
    expect(notifications.notifications().length).toBe(1);
    expect(notifications.notifications()[0].type).toBe('error');
  });

  it('con silentErrors() no muestra aviso, pero sí lanza el ApiError', () => {
    let received: unknown;
    http.get('/plans', { context: silentErrors() }).subscribe({ error: e => (received = e) });
    controller.expectOne('/plans').flush('x', { status: 404, statusText: 'Not Found' });

    expect((received as ApiError).isNotFound).toBe(true);
    expect(notifications.notifications().length).toBe(0);
  });

  it('no interviene cuando la petición sale bien', () => {
    let body: unknown;
    http.get('/plans').subscribe(b => (body = b));
    controller.expectOne('/plans').flush([{ id: '1' }]);

    expect(body).toEqual([{ id: '1' }]);
    expect(notifications.notifications().length).toBe(0);
  });
});
