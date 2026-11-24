import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { ApiError } from '../../../core/errors/api-error';
import { PlanAttachment } from '../../../core/models/app.models';
import { FilesApiService, UploadEvent } from '../../../core/services/files-api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { FileUploaderComponent } from './file-uploader.component';

function makeFile(name: string, type: string, sizeBytes: number): File {
  const file = new File(['contenido'], name, { type });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

describe('FileUploaderComponent', () => {
  let fixture: ComponentFixture<FileUploaderComponent>;
  let component: FileUploaderComponent;
  let uploadSubject: Subject<UploadEvent>; // Cambiado a UploadEvent
  let uploadSpy: ReturnType<typeof vi.fn>;
  let notif: NotificationService;

  beforeEach(async () => {
    uploadSubject = new Subject<UploadEvent>();
    uploadSpy = vi.fn().mockReturnValue(uploadSubject.asObservable());

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/preview-1');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    await TestBed.configureTestingModule({
      imports: [FileUploaderComponent],
      providers: [
        {
          provide: FilesApiService,
          useValue: { upload: uploadSpy },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FileUploaderComponent);
    component = fixture.componentInstance;
    notif = TestBed.inject(NotificationService);
    fixture.componentRef.setInput('planId', 'plan-001');
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rechaza un archivo inválido y muestra alerta en el DOM sin llamar a FilesApiService', () => {
    const invalid = makeFile('script.txt', 'text/plain', 500);
    component.handleFileCandidate(invalid);
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement | null;
    expect(alert?.textContent).toContain('Formato no permitido');
    expect(component.selectedFile()).toBeNull();
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it('genera vista previa en miniatura al seleccionar una imagen válida', () => {
    const image = makeFile('ensalada.png', 'image/png', 120_000);
    component.handleFileCandidate(image);
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('.uploader__preview-img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('blob:http://localhost/preview-1');
    expect(component.selectedFile()?.name).toBe('ensalada.png');
  });

  it('actualiza la barra y porcentaje de progreso con UploadProgress y emite uploaded al terminar', () => {
    const image = makeFile('pollo.jpg', 'image/jpeg', 200_000);
    const emitted: PlanAttachment[] = [];
    component.uploaded.subscribe(att => emitted.push(att));

    component.handleFileCandidate(image);
    component.startUpload();
    fixture.detectChanges();

    expect(uploadSpy).toHaveBeenCalledWith('plan-001', image);
    expect(component.isUploading()).toBe(true);

    // Enviamos un evento de progreso compatible con el nuevo UploadEvent
    uploadSubject.next({
      type: 'progress',
      loaded: 100_000,
      total: 200_000,
      percent: 50
    });
    fixture.detectChanges();

    const bar = fixture.nativeElement.querySelector('[role="progressbar"]') as HTMLElement | null;
    expect(component.uploadProgress()).toBe(50);
    expect(bar?.getAttribute('aria-valuenow')).toBe('50');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('50%');

    const attachment: PlanAttachment = {
      id: 'att-1',
      planId: 'plan-001',
      name: 'pollo.jpg',
      mimeType: 'image/jpeg',
      size: 200_000,
      url: '/uploads/pollo.jpg',
      createdAt: '2026-11-23T12:00:00.000Z',
    };

    // Enviamos el evento final compatible con el nuevo UploadEvent
    uploadSubject.next({ type: 'done', attachment });
    uploadSubject.complete();
    fixture.detectChanges();

    expect(component.isUploading()).toBe(false);
    expect(component.selectedFile()).toBeNull();
    expect(emitted).toEqual([attachment]);
    expect(notif.notifications().some(n => n.type === 'success')).toBe(true);
  });

  it('al pulsar "Cancelar subida" cancela la suscripción en curso y limpia el estado de carga', () => {
    const pdf = makeFile('ficha.pdf', 'application/pdf', 150_000);
    component.handleFileCandidate(pdf);
    component.startUpload();
    fixture.detectChanges();

    expect(uploadSubject.observed).toBe(true);

    const cancelBtn = fixture.nativeElement.querySelector('.uploader__cancel-btn') as HTMLButtonElement;
    cancelBtn.click();
    fixture.detectChanges();

    expect(uploadSubject.observed).toBe(false);
    expect(component.isUploading()).toBe(false);
    expect(component.uploadProgress()).toBe(0);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Subida cancelada.');
  });

  it('muestra mensaje en línea si la API responde 403 sin duplicar error', () => {
    const pdf = makeFile('ficha.pdf', 'application/pdf', 150_000);
    component.handleFileCandidate(pdf);
    component.startUpload();

    uploadSubject.error(new ApiError(403, 'Acceso denegado'));
    fixture.detectChanges();

    expect(component.isUploading()).toBe(false);
    expect(component.uploadError()).toBe('No tienes permiso para subir archivos a este plan.');
  });

  it('muestra aviso y deshabilita la subida cuando no hay conexión', () => {
    const pdf = makeFile('ficha.pdf', 'application/pdf', 150_000);
    component.handleFileCandidate(pdf);
    fixture.componentRef.setInput('connectionOffline', true);
    fixture.detectChanges();

    expect(component.isOffline()).toBe(true);
    expect(component.canUpload()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Sin conexión');
  });
});
