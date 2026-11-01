import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivityLevel, Objective, Sex, UserProfile } from '../../../../core/models/app.models';
import { NotificationService } from '../../../../core/services/notification.service';
import { PlanService } from '../../../../core/services/plan.service';
import { RippleDirective } from '../../../../shared/directives/ripple.directive';

@Component({
  selector: 'app-tdee-calculator',
  standalone: true,
  imports: [ReactiveFormsModule, RippleDirective],
  templateUrl: './tdee-calculator.component.html',
  styleUrl: './tdee-calculator.component.css',
})
export class TdeeCalculatorComponent {
  private fb    = inject(FormBuilder);
  private notif = inject(NotificationService);
  plans = inject(PlanService);

  readonly activityOptions: { value: ActivityLevel; label: string }[] = [
    { value: 'sedentary',   label: 'Sedentario (poco o nada de ejercicio)' },
    { value: 'light',       label: 'Ligero (1-3 días por semana)' },
    { value: 'moderate',    label: 'Moderado (3-5 días por semana)' },
    { value: 'active',      label: 'Activo (6-7 días por semana)' },
    { value: 'very_active', label: 'Muy activo (entrenamiento doble)' },
  ];

  readonly objectiveOptions: { value: Objective; label: string }[] = [
    { value: 'deficit',     label: 'Déficit (bajar de peso)' },
    { value: 'maintenance', label: 'Mantenimiento' },
    { value: 'surplus',     label: 'Superávit (ganar masa)' },
  ];

  form = this.fb.nonNullable.group({
    sex:      [this.plans.profile().sex as Sex],
    age:      [this.plans.profile().age,      [Validators.required, Validators.min(15), Validators.max(100)]],
    weightKg: [this.plans.profile().weightKg, [Validators.required, Validators.min(30), Validators.max(300)]],
    heightCm: [this.plans.profile().heightCm, [Validators.required, Validators.min(120), Validators.max(250)]],
    activity: [this.plans.profile().activity],
    objective:[this.plans.profile().objective],
  });

  isInvalid(name: 'age' | 'weightKg' | 'heightCm'): boolean {
    const c = this.form.controls[name];
    return c.invalid && c.touched;
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notif.error('Revisa los datos del perfil antes de guardar.');
      return;
    }
    this.plans.updateProfile(this.form.getRawValue() as UserProfile);
    this.notif.success('Perfil actualizado. Tus metas diarias se recalcularon.');
  }
}
