import { Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { RippleDirective } from '../../../shared/directives/ripple.directive';

/** Validador personalizado de grupo: las contraseñas deben coincidir */
function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password        = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, RippleDirective],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent {
  private fb          = inject(FormBuilder);
  private authService = inject(AuthService);
  private router      = inject(Router);
  private route       = inject(ActivatedRoute);

  // ── Estado de UI ─────────────────────────────────────────
  showPassword        = signal(false);
  showConfirmPassword = signal(false);
  submitted           = signal(false);

  /** Señales del servicio: el estado de carga y el error de la API se pintan en el formulario. */
  readonly isLoading = this.authService.isLoading;

  /**
   * Normaliza el mensaje de conflicto 409 en el registro a "Ese correo ya está registrado."
   * manteniendo intacto `AuthService.error()`.
   */
  readonly error = computed<string | null>(() => {
    const raw = this.authService.error();
    if (!raw) return null;
    if (raw.toLowerCase().includes('ya existe')) {
      return 'Ese correo ya está registrado.';
    }
    return raw;
  });

  /** Query params para conservar `returnUrl` al volver a iniciar sesión. */
  readonly loginQueryParams = computed(() => {
    const url = this.rawReturnUrl();
    return url ? { returnUrl: url } : null;
  });

  // ── Formulario ───────────────────────────────────────────
  registerForm = this.fb.group(
    {
      name: ['', [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(60),
      ]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/), // al menos 1 letra + 1 número
      ]],
      confirmPassword: ['', Validators.required],
      objective: ['maintenance' as 'deficit' | 'maintenance' | 'surplus', Validators.required],
      acceptTerms: [false, Validators.requiredTrue],
    },
    { validators: passwordMatchValidator }
  );

  // ── Getters ──────────────────────────────────────────────
  get name()            { return this.registerForm.get('name')!; }
  get email()           { return this.registerForm.get('email')!; }
  get password()        { return this.registerForm.get('password')!; }
  get confirmPassword() { return this.registerForm.get('confirmPassword')!; }
  get acceptTerms()     { return this.registerForm.get('acceptTerms')!; }

  /** Fuerza de contraseña: 0-4 */
  passwordStrength = computed<number>(() => {
    const pw = this.password.value ?? '';
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8)              score++;
    if (/[A-Z]/.test(pw))           score++;
    if (/[0-9]/.test(pw))           score++;
    if (/[^A-Za-z0-9]/.test(pw))    score++;
    return score;
  });

  strengthLabels = ['', 'Muy débil', 'Débil', 'Buena', 'Fuerte'];
  strengthColors = ['', '#ef4444', '#f59e0b', '#3b82f6', '#22c55e'];

  isFieldInvalid(field: AbstractControl | null): boolean {
    return !!(field?.invalid && (field.touched || this.submitted()));
  }

  isPasswordMismatch(): boolean {
    return !!(
      this.registerForm.hasError('passwordMismatch') &&
      (this.confirmPassword.touched || this.submitted())
    );
  }

  togglePassword():        void { this.showPassword.update(v => !v); }
  toggleConfirmPassword(): void { this.showConfirmPassword.update(v => !v); }

  // ── Submit ───────────────────────────────────────────────
  async onSubmit(): Promise<void> {
    if (this.isLoading()) return;

    this.submitted.set(true);
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const val = this.registerForm.value;
    const success = await this.authService.register({
      name:            val.name!,
      email:           val.email!,
      password:        val.password!,
      confirmPassword: val.confirmPassword!,
      objective:       val.objective as 'deficit' | 'maintenance' | 'surplus',
      acceptTerms:     val.acceptTerms!,
    });

    if (success) {
      await this.router.navigateByUrl(this.returnUrl());
    }
  }

  private rawReturnUrl(): string | null {
    const url = this.route.snapshot.queryParamMap.get('returnUrl');
    return url && url.startsWith('/') && !url.startsWith('//') ? url : null;
  }

  private returnUrl(): string {
    return this.rawReturnUrl() ?? '/dashboard';
  }
}
