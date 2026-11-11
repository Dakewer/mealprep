import { FormArray, FormControl, FormGroup } from '@angular/forms';
import {
  ingredientGramsRangeValidator,
  minIngredientsValidator,
  notBlankValidator,
  uniquePlanNameValidator,
} from './plan.validators';

describe('plan.validators (C1)', () => {
  describe('notBlankValidator', () => {
    it('acepta cadenas vacías (delegado a required) y texto válido', () => {
      const validator = notBlankValidator();
      expect(validator(new FormControl(''))).toBeNull();
      expect(validator(new FormControl('Comida post-entreno'))).toBeNull();
    });

    it('rechaza cadenas compuestas solo por espacios', () => {
      const validator = notBlankValidator();
      expect(validator(new FormControl('   '))).toEqual({ blank: true });
    });
  });

  describe('uniquePlanNameValidator', () => {
    it('rechaza nombres repetidos sin importar mayúsculas o espacios', () => {
      const names = ['Desayuno Proteico', 'Cena Ligera'];
      const validator = uniquePlanNameValidator(() => names);

      expect(validator(new FormControl('  desayuno proteico '))).toEqual({
        duplicateName: { value: 'desayuno proteico' },
      });
      expect(validator(new FormControl('Almuerzo Mediterráneo'))).toBeNull();
    });

    it('permite conservar el nombre original cuando se está editando un plan', () => {
      const names = ['Desayuno Proteico', 'Cena Ligera'];
      const validator = uniquePlanNameValidator(
        () => names,
        () => 'Desayuno Proteico',
      );

      expect(validator(new FormControl('desayuno proteico'))).toBeNull();
      expect(validator(new FormControl('Cena Ligera'))).toEqual({
        duplicateName: { value: 'Cena Ligera' },
      });
    });
  });

  describe('minIngredientsValidator', () => {
    it('exige al menos N ingredientes en un FormArray', () => {
      const array = new FormArray<FormGroup>([], minIngredientsValidator(1));
      expect(array.errors).toEqual({
        minIngredients: { required: 1, actual: 0 },
      });

      array.push(
        new FormGroup({
          ingredientId: new FormControl('pollo'),
          grams: new FormControl(150),
        }),
      );
      expect(array.errors).toBeNull();
    });

    it('funciona también con un FormControl de arreglo', () => {
      const control = new FormControl([], minIngredientsValidator(2));
      expect(control.errors).toEqual({
        minIngredients: { required: 2, actual: 0 },
      });
    });
  });

  describe('ingredientGramsRangeValidator', () => {
    it('valida cantidades numéricas dentro y fuera del rango', () => {
      const validator = ingredientGramsRangeValidator(10, 600);
      expect(validator(new FormControl(100))).toBeNull();
      expect(validator(new FormControl(0))).toEqual({
        invalidGrams: { min: 10, max: 600, actual: 0 },
      });
      expect(validator(new FormControl(750))).toEqual({
        invalidGrams: { min: 10, max: 600, actual: 750 },
      });
    });
  });
});
