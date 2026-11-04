import { AbstractControl, FormArray, ValidationErrors, ValidatorFn } from '@angular/forms';
import { PlanItem } from '../models/app.models';

/**
 * Valida que un campo de texto no contenga únicamente espacios en blanco.
 */
export function notBlankValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = control.value;
    if (typeof raw !== 'string' || raw.length === 0) {
      return null; // Validators.required se encarga del vacío
    }
    return raw.trim().length > 0 ? null : { blank: true };
  };
}

/**
 * Validador personalizado que impide repetir el nombre de un plan existente
 * (comparación insensible a mayúsculas/minúsculas y espacios extremos).
 *
 * @param existingNamesFn Función que devuelve los nombres actuales de los planes.
 * @param currentNameFn Opcional (modo edición): nombre original del plan editado para permitir conservarlo.
 */
export function uniquePlanNameValidator(
  existingNamesFn: () => readonly string[],
  currentNameFn?: () => string | undefined,
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = typeof control.value === 'string' ? control.value.trim() : '';
    if (!raw) {
      return null;
    }

    const normalized = raw.toLocaleLowerCase();
    const originalName = currentNameFn?.()?.trim().toLocaleLowerCase();

    if (originalName && normalized === originalName) {
      return null;
    }

    const exists = existingNamesFn().some(
      name => name.trim().toLocaleLowerCase() === normalized,
    );

    return exists ? { duplicateName: { value: raw } } : null;
  };
}

/**
 * Validador personalizado que exige al menos `min` ingredientes en el plan
 * (funciona tanto sobre un `FormArray` como sobre un control con arreglo de `PlanItem`).
 */
export function minIngredientsValidator(min = 1): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const length =
      control instanceof FormArray
        ? control.length
        : Array.isArray(control.value)
          ? control.value.length
          : 0;

    return length >= min
      ? null
      : { minIngredients: { required: min, actual: length } };
  };
}

/**
 * Validador personalizado para verificar que cada ingrediente tenga una cantidad
 * en gramos dentro del rango permitido (`[min, max]`).
 */
export function ingredientGramsRangeValidator(min = 10, max = 600): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;

    if (typeof value === 'number') {
      return Number.isFinite(value) && value >= min && value <= max
        ? null
        : { invalidGrams: { min, max, actual: value } };
    }

    if (Array.isArray(value)) {
      const invalid = (value as PlanItem[]).find(
        item => !Number.isFinite(item?.grams) || item.grams < min || item.grams > max,
      );
      return invalid
        ? { invalidGrams: { min, max, actual: invalid.grams } }
        : null;
    }

    return null;
  };
}
