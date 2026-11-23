import {
  MAX_FILE_SIZE_BYTES,
  formatFileSize,
  validateFile,
} from './file.validators';

function makeFile(name: string, type: string, sizeBytes: number): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

describe('file.validators', () => {
  it('acepta imágenes JPG, PNG, WEBP y archivos PDF dentro del límite', () => {
    const validFiles = [
      makeFile('platillo.jpg', 'image/jpeg', 250_000),
      makeFile('receta.png', 'image/png', 1_024 * 500),
      makeFile('foto.webp', 'image/webp', 120_000),
      makeFile('ficha.pdf', 'application/pdf', MAX_FILE_SIZE_BYTES),
    ];

    for (const file of validFiles) {
      expect(validateFile(file)).toEqual({ valid: true, error: null });
    }
  });

  it('rechaza tipos no permitidos con un mensaje claro', () => {
    const exe = makeFile('instalador.exe', 'application/x-msdownload', 1024);
    const txt = makeFile('notas.txt', 'text/plain', 512);

    const exeResult = validateFile(exe);
    expect(exeResult.valid).toBe(false);
    expect(exeResult.code).toBe('invalid-type');
    expect(exeResult.error).toContain('Formato no permitido');

    const txtResult = validateFile(txt);
    expect(txtResult.valid).toBe(false);
    expect(txtResult.code).toBe('invalid-type');
  });

  it('rechaza archivos mayores a 5 MB y archivos vacíos', () => {
    const tooBig = makeFile('enorme.png', 'image/png', MAX_FILE_SIZE_BYTES + 1);
    const bigResult = validateFile(tooBig);
    expect(bigResult.valid).toBe(false);
    expect(bigResult.code).toBe('file-too-large');
    expect(bigResult.error).toContain('5 MB');

    const empty = makeFile('vacio.pdf', 'application/pdf', 0);
    const emptyResult = validateFile(empty);
    expect(emptyResult.valid).toBe(false);
    expect(emptyResult.code).toBe('empty-file');
    expect(emptyResult.error).toContain('vacío');
  });

  it('formatea tamaños correctamente en B, KB y MB', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5 MB');
  });
});
