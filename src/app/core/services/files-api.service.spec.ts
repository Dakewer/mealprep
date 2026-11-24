import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../config/api-base-url.token';
import { SILENT_ERRORS as SILENT } from '../interceptors/http-error.interceptor';
import { PlanAttachment } from '../models/app.models';
import { FilesApiService, UploadEvent } from './files-api.service';

const BASE = 'http://api.test';

const attachment: PlanAttachment = {
  id: 'file-1',
  planId: 'plan 1',
  name: 'receta.pdf',
  mimeType: 'application/pdf',
  size: 1234,
  url: `${BASE}/plans/plan%201/files/file-1`,
  createdAt: '2026-11-01T10:00:00.000Z',
};

describe('FilesApiService', () => {
  let api: FilesApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    });
    api = TestBed.inject(FilesApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista los adjuntos de un plan', () => {
    let result: PlanAttachment[] = [];
    api.list('plan 1').subscribe(r => (result = r));

    const req = http.expectOne(`${BASE}/plans/plan%201/files`);
    expect(req.request.method).toBe('GET');
    req.flush([attachment]);

    expect(result).toEqual([attachment]);
  });

  it('sube el archivo como multipart (campo "file") y reporta el progreso', () => {
    const file = new File(['%PDF-1.4'], 'receta.pdf', { type: 'application/pdf' });
    const events: UploadEvent[] = [];
    api.upload('plan 1', file).subscribe(e => events.push(e));

    const req = http.expectOne(`${BASE}/plans/plan%201/files`);
    expect(req.request.method).toBe('POST');
    expect(req.request.reportProgress).toBe(true);
    const body = req.request.body as FormData;
    expect(body.get('file')).toBeInstanceOf(File);
    expect((body.get('file') as File).name).toBe('receta.pdf');

    req.event({ type: HttpEventType.Sent });
    req.event({ type: HttpEventType.UploadProgress, loaded: 50, total: 200 });
    req.event({ type: HttpEventType.UploadProgress, loaded: 100 });
    req.flush(attachment, { status: 201, statusText: 'Created' });

    expect(events).toEqual([
      { type: 'progress', loaded: 50, total: 200, percent: 25 },
      { type: 'progress', loaded: 100, total: null, percent: null },
      { type: 'done', attachment },
    ]);
  });

  it('en la subida, los errores avisan por defecto y se pueden silenciar', () => {
    const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });

    api.upload('p1', file).subscribe({ error: () => undefined });
    let req = http.expectOne(`${BASE}/plans/p1/files`);
    expect(req.request.context.get(SILENT)).toBe(false);
    req.flush({ message: 'x' }, { status: 413, statusText: 'Payload Too Large' });

    api.upload('p1', file, { notify: false }).subscribe({ error: () => undefined });
    req = http.expectOne(`${BASE}/plans/p1/files`);
    expect(req.request.context.get(SILENT)).toBe(true);
    req.flush({}, { status: 413, statusText: 'Payload Too Large' });
  });

  it('descarga el contenido como Blob desde la URL de la API (no desde attachment.url)', () => {
    let blob: Blob | undefined;
    api.download({ ...attachment, url: 'https://otro-host.test/robo' }).subscribe(b => (blob = b));

    const req = http.expectOne(`${BASE}/plans/plan%201/files/file-1`);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['%PDF-1.4'], { type: 'application/pdf' }));

    expect(blob?.type).toBe('application/pdf');
  });

  it('elimina un adjunto con DELETE', () => {
    let done = false;
    api.remove('plan 1', 'file-1').subscribe(() => (done = true));

    const req = http.expectOne(`${BASE}/plans/plan%201/files/file-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});

    expect(done).toBe(true);
  });
});
