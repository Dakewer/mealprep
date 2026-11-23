/** Tipos MIME aceptados para archivos adjuntos de un plan nutricional. */
export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export type AllowedFileType = (typeof ALLOWED_FILE_TYPES)[number];

/** Extensiones de respaldo cuando el navegador no reporta el tipo MIME del archivo. */
export const ALLOWED_FILE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'] as const;

/** Tamaño máximo permitido por archivo: 5 MB. */
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export type FileValidationErrorCode = 'invalid-type' | 'file-too-large' | 'empty-file';

export interface FileValidationResult {
  valid: boolean;
  error: string | null;
  code?: FileValidationErrorCode;
}

export interface FileValidationOptions {
  allowedTypes?: readonly string[];
  allowedExtensions?: readonly string[];
  maxSizeBytes?: number;
}

/**
 * Valida un archivo en el cliente antes de subirlo a la API.
 * Comprueba que no esté vacío, que su tipo MIME o extensión esté permitida
 * y que no supere el tamaño máximo configurado.
 */
export function validateFile(
  file: File,
  options: FileValidationOptions = {},
): FileValidationResult {
  const allowedTypes = options.allowedTypes ?? ALLOWED_FILE_TYPES;
  const allowedExtensions = options.allowedExtensions ?? ALLOWED_FILE_EXTENSIONS;
  const maxSizeBytes = options.maxSizeBytes ?? MAX_FILE_SIZE_BYTES;

  if (file.size === 0) {
    return {
      valid: false,
      code: 'empty-file',
      error: 'El archivo seleccionado está vacío.',
    };
  }

  const normalizedMime = file.type.trim().toLowerCase();
  const normalizedName = file.name.trim().toLowerCase();

  const matchesMime = normalizedMime !== '' && allowedTypes.includes(normalizedMime);
  const matchesExtension = allowedExtensions.some(ext => normalizedName.endsWith(ext));

  if (!matchesMime && !(normalizedMime === '' && matchesExtension)) {
    return {
      valid: false,
      code: 'invalid-type',
      error: 'Formato no permitido. Solo se aceptan imágenes (JPG, PNG, WEBP) o archivos PDF.',
    };
  }

  if (file.size > maxSizeBytes) {
    const maxLabel = formatFileSize(maxSizeBytes);
    return {
      valid: false,
      code: 'file-too-large',
      error: `El archivo supera el tamaño máximo permitido (${maxLabel}).`,
    };
  }

  return { valid: true, error: null };
}

/** Formatea un tamaño en bytes a una cadena legible en español (`B`, `KB`, `MB`). */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${Number.isInteger(kb) ? kb : kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
}
