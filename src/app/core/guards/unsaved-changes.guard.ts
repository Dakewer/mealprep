import { CanDeactivateFn } from '@angular/router';

export const UNSAVED_CHANGES_MESSAGE =
  'Tienes cambios sin guardar en el formulario. ¿Seguro que deseas salir y descartarlos?';

/**
 * Contrato para vistas con formularios que deben advertir al usuario
 * antes de abandonar la ruta si hay cambios pendientes.
 */
export interface HasUnsavedChanges {
  /** Devuelve `true` cuando el formulario tiene cambios sin guardar. */
  hasUnsavedChanges(): boolean;
  /**
   * Opcional: abre un diálogo propio (por ejemplo, `ConfirmModalComponent`)
   * y resuelve `true` si el usuario confirma descartar los cambios.
   */
  confirmDiscardChanges?(): boolean | Promise<boolean>;
}

/**
 * Guard de salida (`canDeactivate`) que evita perder cambios en formularios
 * de creación o edición de planes cuando el usuario navega a otra ruta.
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = component => {
  if (!component || !component.hasUnsavedChanges()) {
    return true;
  }

  if (typeof component.confirmDiscardChanges === 'function') {
    return component.confirmDiscardChanges();
  }

  return typeof window !== 'undefined' && typeof window.confirm === 'function'
    ? window.confirm(UNSAVED_CHANGES_MESSAGE)
    : true;
};
