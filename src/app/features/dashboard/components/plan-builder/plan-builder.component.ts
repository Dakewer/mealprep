import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { HasUnsavedChanges } from '../../../../core/guards/unsaved-changes.guard';
import { NutritionPlan, PlanItem } from '../../../../core/models/app.models';
import { NotificationService } from '../../../../core/services/notification.service';
import { NutritionService } from '../../../../core/services/nutrition.service';
import { PlanService } from '../../../../core/services/plan.service';
import {
  ingredientGramsRangeValidator,
  minIngredientsValidator,
  notBlankValidator,
  uniquePlanNameValidator,
} from '../../../../core/validators/plan.validators';
import { MacroBarsComponent } from '../../../../shared/components/macro-bars/macro-bars.component';
import { RippleDirective } from '../../../../shared/directives/ripple.directive';

export type IngredientItemGroup = FormGroup<{
  ingredientId: FormControl<string>;
  grams: FormControl<number>;
}>;

@Component({
  selector: 'app-plan-builder',
  standalone: true,
  imports: [ReactiveFormsModule, MacroBarsComponent, RippleDirective],
  templateUrl: './plan-builder.component.html',
  styleUrl: './plan-builder.component.css',
})
export class PlanBuilderComponent implements HasUnsavedChanges {
  private fb        = inject(FormBuilder);
  private notif     = inject(NotificationService);
  private nutrition = inject(NutritionService);
  plans             = inject(PlanService);

  /**
   * Si se recibe un plan, el formulario entra en modo edición (C3) y precarga
   * su nombre, descripción e ingredientes. Si es `null`, opera en modo alta (C2).
   */
  initialPlan = input<NutritionPlan | null>(null);

  /** Se emite cuando el plan se crea o actualiza correctamente en la API. */
  saved = output<NutritionPlan>();

  /** Se emite cuando el usuario pulsa Cancelar en modo edición. */
  cancelled = output<void>();

  readonly sliderMin  = 10;
  readonly sliderMax  = 600;
  readonly sliderStep = 10;

  readonly isEditMode = computed(() => this.initialPlan() !== null);
  readonly isSaving   = signal(false);
  readonly submitted  = signal(false);
  /** Mensaje en línea cuando la API rechaza la edición con 403 Forbidden. */
  readonly forbiddenError = signal<string | null>(null);

  /** Espejo reactivo de los ingredientes actuales para calcular totales y catálogo disponible. */
  readonly items = signal<PlanItem[]>([]);

  readonly planForm = this.fb.group({
    name: this.fb.nonNullable.control('', [
      Validators.required,
      notBlankValidator(),
      Validators.minLength(3),
      Validators.maxLength(80),
      uniquePlanNameValidator(
        () => this.plans.plans().map(p => p.name),
        () => this.initialPlan()?.name,
      ),
    ]),
    description: this.fb.nonNullable.control('', [Validators.maxLength(240)]),
    items: this.fb.array<IngredientItemGroup>([], [minIngredientsValidator(1)]),
  });

  /** Ingredientes del catálogo que aún no están en el plan. */
  readonly available = computed(() => {
    const used = new Set(this.items().map(i => i.ingredientId));
    return this.plans.ingredients.filter(i => !used.has(i.id));
  });

  /** Ingredientes del plan con sus datos de catálogo, para pintar la lista. */
  readonly rows = computed(() =>
    this.items().map(item => ({
      ...item,
      ingredient: this.plans.ingredients.find(i => i.id === item.ingredientId)!,
    })),
  );

  readonly totals = computed(() =>
    this.nutrition.calculateTotals(this.items(), this.plans.ingredients),
  );

  constructor() {
    effect(() => {
      const plan = this.initialPlan();
      if (plan) {
        this.loadFromPlan(plan);
      }
    });
  }

  // ── Accesores del formulario ──────────────────────────────
  get nameControl(): FormControl<string> {
    return this.planForm.controls.name;
  }

  get descriptionControl(): FormControl<string> {
    return this.planForm.controls.description;
  }

  get itemsArray(): FormArray<IngredientItemGroup> {
    return this.planForm.controls.items;
  }

  // ── Estado de errores por campo ───────────────────────────
  isFieldInvalid(controlName: 'name' | 'description'): boolean {
    const control = this.planForm.get(controlName);
    return !!(control && control.invalid && (control.touched || control.dirty || this.submitted()));
  }

  get nameErrorMessage(): string | null {
    const ctrl = this.nameControl;
    if (!this.isFieldInvalid('name')) return null;
    if (ctrl.hasError('required') || ctrl.hasError('blank')) {
      return 'El nombre del plan es obligatorio.';
    }
    if (ctrl.hasError('minlength')) {
      return 'El nombre debe tener al menos 3 caracteres.';
    }
    if (ctrl.hasError('maxlength')) {
      return 'El nombre no puede superar los 80 caracteres.';
    }
    if (ctrl.hasError('duplicateName')) {
      return 'Ya existe un plan con este nombre. Elige uno distinto.';
    }
    if (ctrl.hasError('serverError')) {
      return String(ctrl.getError('serverError'));
    }
    return 'Nombre inválido.';
  }

  get descriptionErrorMessage(): string | null {
    const ctrl = this.descriptionControl;
    if (!this.isFieldInvalid('description')) return null;
    if (ctrl.hasError('maxlength')) {
      return 'La descripción no puede superar los 240 caracteres.';
    }
    if (ctrl.hasError('serverError')) {
      return String(ctrl.getError('serverError'));
    }
    return null;
  }

  get itemsErrorMessage(): string | null {
    const arr = this.itemsArray;
    if (!(arr.invalid && (arr.touched || arr.dirty || this.submitted()))) {
      return null;
    }
    if (arr.hasError('minIngredients')) {
      return 'Agrega al menos un ingrediente a tu plan.';
    }
    return null;
  }

  itemGramsError(index: number): string | null {
    const group = this.itemsArray.at(index);
    if (!group) return null;
    const ctrl = group.controls.grams;
    if (!(ctrl.invalid && (ctrl.touched || ctrl.dirty || this.submitted()))) {
      return null;
    }
    if (ctrl.hasError('required') || ctrl.hasError('invalidGrams') || ctrl.hasError('min') || ctrl.hasError('max')) {
      return `La cantidad debe estar entre ${this.sliderMin} g y ${this.sliderMax} g.`;
    }
    return null;
  }

  // ── Manipulación de ingredientes ──────────────────────────
  add(ingredientId: string): void {
    if (!ingredientId) return;
    if (this.items().some(i => i.ingredientId === ingredientId)) return;

    this.itemsArray.push(this.createItemGroup(ingredientId, 100));
    this.itemsArray.markAsDirty();
    this.itemsArray.markAsTouched();
    this.planForm.markAsDirty();
    this.syncItemsSignal();
  }

  setGrams(ingredientId: string, grams: number): void {
    const normalized = Number.isFinite(grams) ? Math.round(grams) : 0;
    const idx = this.itemsArray.controls.findIndex(
      ctrl => ctrl.controls.ingredientId.value === ingredientId,
    );
    if (idx === -1) return;

    const gramsCtrl = this.itemsArray.at(idx).controls.grams;
    gramsCtrl.setValue(normalized);
    gramsCtrl.markAsDirty();
    gramsCtrl.markAsTouched();
    this.planForm.markAsDirty();
    this.syncItemsSignal();
  }

  remove(ingredientId: string): void {
    const idx = this.itemsArray.controls.findIndex(
      ctrl => ctrl.controls.ingredientId.value === ingredientId,
    );
    if (idx === -1) return;

    this.itemsArray.removeAt(idx);
    this.itemsArray.markAsDirty();
    this.itemsArray.markAsTouched();
    this.planForm.markAsDirty();
    this.syncItemsSignal();
  }

  // ── Guardado (alta y edición) ─────────────────────────────
  async save(): Promise<void> {
    if (this.isSaving()) return;

    this.submitted.set(true);
    this.nameControl.updateValueAndValidity();
    this.itemsArray.updateValueAndValidity();

    if (this.planForm.invalid) {
      this.planForm.markAllAsTouched();
      if (this.nameControl.invalid) {
        this.notif.error(this.nameErrorMessage ?? 'Revisa el nombre del plan.');
      } else if (this.itemsArray.invalid) {
        this.notif.warning(this.itemsErrorMessage ?? 'Agrega al menos un ingrediente a tu plan.');
      } else {
        this.notif.warning('Corrige los errores del formulario antes de guardar.');
      }
      return;
    }

    const name = this.nameControl.value.trim();
    const description = this.descriptionControl.value.trim();
    const currentItems = this.items();
    const editingPlan = this.initialPlan();

    this.isSaving.set(true);
    this.forbiddenError.set(null);
    try {
      const savedPlan = editingPlan
        ? await this.plans.updatePlan(editingPlan.id, name, currentItems, description)
        : await this.plans.savePlan(name, currentItems, description);

      if (!savedPlan) {
        if (editingPlan && this.plans.plansError()?.status === 403) {
          this.forbiddenError.set('No tienes permiso para editar este plan');
          this.planForm.markAsPristine();
        }
        return;
      }

      this.notif.success(
        editingPlan
          ? 'Plan nutricional actualizado correctamente.'
          : 'Plan nutricional guardado correctamente.',
      );

      if (editingPlan) {
        this.planForm.markAsPristine();
        this.submitted.set(false);
      } else {
        this.resetForm();
      }

      this.saved.emit(savedPlan);
    } finally {
      this.isSaving.set(false);
    }
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  // ── HasUnsavedChanges (C1) ────────────────────────────────
  hasUnsavedChanges(): boolean {
    if (this.forbiddenError() !== null) {
      return false;
    }
    return this.planForm.dirty && !this.isSaving();
  }

  resetForm(): void {
    this.itemsArray.clear();
    this.planForm.reset({ name: '', description: '' });
    this.planForm.markAsPristine();
    this.planForm.markAsUntouched();
    this.submitted.set(false);
    this.forbiddenError.set(null);
    this.syncItemsSignal();
  }

  private loadFromPlan(plan: NutritionPlan): void {
    this.itemsArray.clear();
    for (const item of plan.items) {
      this.itemsArray.push(this.createItemGroup(item.ingredientId, item.grams));
    }
    this.planForm.patchValue({
      name: plan.name,
      description: plan.description ?? '',
    });
    this.planForm.markAsPristine();
    this.planForm.markAsUntouched();
    this.submitted.set(false);
    this.forbiddenError.set(null);
    this.syncItemsSignal();
  }

  private createItemGroup(ingredientId: string, grams: number): IngredientItemGroup {
    return this.fb.group({
      ingredientId: this.fb.nonNullable.control(ingredientId, [Validators.required]),
      grams: this.fb.nonNullable.control(grams, [
        Validators.required,
        ingredientGramsRangeValidator(this.sliderMin, this.sliderMax),
      ]),
    });
  }

  private syncItemsSignal(): void {
    const rawItems: PlanItem[] = this.itemsArray.controls.map(group => ({
      ingredientId: group.controls.ingredientId.value,
      grams: group.controls.grams.value,
    }));
    this.items.set(rawItems);
  }
}
