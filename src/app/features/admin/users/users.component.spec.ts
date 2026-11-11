import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminUsersComponent } from './users.component';
import { UsersApiService } from '../../../core/services/users-api.service';
import { of, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';
import { User } from '../../../core/models/app.models';

describe('AdminUsersComponent', () => {
  let component: AdminUsersComponent;
  let fixture: ComponentFixture<AdminUsersComponent>;
  let mockUsersApi: { getUsers: ReturnType<typeof vi.fn> };

  const testUsers: User[] = [
    { id: '1', name: 'Ana Admin', email: 'admin@deficcitto.com', role: 'admin' },
    { id: '2', name: 'Beto Usuario', email: 'beto@deficcitto.com', role: 'user' },
  ];

  beforeEach(async () => {
    mockUsersApi = {
      getUsers: vi.fn().mockReturnValue(of(testUsers)),
    };

    await TestBed.configureTestingModule({
      imports: [AdminUsersComponent],
      providers: [
        provideRouter([]),
        { provide: UsersApiService, useValue: mockUsersApi },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminUsersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente e inicia cargando los usuarios', () => {
    expect(component).toBeTruthy();
    expect(mockUsersApi.getUsers).toHaveBeenCalled();
    expect(component.users().length).toBe(2);
    expect(component.state()).toBe('success');
  });

  it('calcula métricas de usuarios y roles correctamente', () => {
    expect(component.totalUsers()).toBe(2);
    expect(component.totalAdmins()).toBe(1);
    expect(component.totalRegularUsers()).toBe(1);
  });

  it('filtra usuarios por nombre o correo', () => {
    component.filterQuery.set('Ana');
    expect(component.filteredUsers().length).toBe(1);
    expect(component.filteredUsers()[0].name).toBe('Ana Admin');

    component.filterQuery.set('beto@');
    expect(component.filteredUsers().length).toBe(1);
    expect(component.filteredUsers()[0].name).toBe('Beto Usuario');

    component.filterQuery.set('inexistente');
    expect(component.filteredUsers().length).toBe(0);
  });

  it('establece estado error si la carga del servicio falla', () => {
    mockUsersApi.getUsers.mockReturnValueOnce(throwError(() => new Error('Error al conectar')));
    component.loadUsers();
    expect(component.state()).toBe('error');
  });
});
