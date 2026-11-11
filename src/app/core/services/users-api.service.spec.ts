import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { UsersApiService } from './users-api.service';
import { API_BASE_URL } from '../config/api-base-url.token';
import { User } from '../models/app.models';

describe('UsersApiService', () => {
  let service: UsersApiService;
  let httpMock: HttpTestingController;
  const mockBaseUrl = 'http://localhost:3000';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        UsersApiService,
        { provide: API_BASE_URL, useValue: mockBaseUrl },
      ],
    });

    service = TestBed.inject(UsersApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('obtiene la lista de usuarios desde GET /users', () => {
    const mockUsers: User[] = [
      { id: '1', name: 'Admin', email: 'admin@test.com', role: 'admin' },
      { id: '2', name: 'User', email: 'user@test.com', role: 'user' },
    ];

    service.getUsers().subscribe(users => {
      expect(users.length).toBe(2);
      expect(users[0].name).toBe('Admin');
      expect(users[0].role).toBe('admin');
    });

    const req = httpMock.expectOne(`${mockBaseUrl}/users`);
    expect(req.request.method).toBe('GET');
    req.flush(mockUsers);
  });

  it('retorna usuarios demo si la petición falla por error de red o servidor no disponible', () => {
    service.getUsers().subscribe(users => {
      expect(users.length).toBeGreaterThan(0);
      expect(users.some(u => u.role === 'admin')).toBe(true);
    });

    const req = httpMock.expectOne(`${mockBaseUrl}/users`);
    req.error(new ProgressEvent('Network error'));
  });

  it('retorna usuarios demo si el array de usuarios devuelto está vacío', () => {
    service.getUsers().subscribe(users => {
      expect(users.length).toBeGreaterThan(0);
      expect(users.some(u => u.role === 'admin')).toBe(true);
    });

    const req = httpMock.expectOne(`${mockBaseUrl}/users`);
    req.flush([]);
  });
});
