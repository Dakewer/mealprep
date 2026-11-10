import { Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService, SESSION_EXPIRED_MESSAGE } from '../../../core/services/auth.service';
import { RippleDirective } from '../../../shared/directives/ripple.directive';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, RippleDirective],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private fb          = inject(FormBuilder);
  private authService = inject(AuthService);
  private router      = inject(Router);
  private route       = inject(ActivatedRoute);

  // ── Estado de UI ─────────────────────────────────────────
  showPassword = signal(false);
  submitted    = signal(false);

  /** Señales del servicio: el estado de carga y el error de la API se pintan en el formulario. */
  readonly isLoading = this.authService.isLoading;
  readonly error     = this.authService.error;

  /** Aviso cuando la sesión previa expiró (`logoutReason() === 'expired'` o query `?expired`). */
  readonly sessionExpiredMessage = computed<string | null>(() => {
    const queryMap = this.route.snapshot.queryParamMap;
    const expiredParam = queryMap.get('expired');
    const hasExpiredQuery =
      queryMap.has('expired') && expiredParam !== 'false' && expiredParam !== '0';

    if (this.authService.logoutReason() === 'expired' || hasExpiredQuery) {
      return SESSION_EXPIRED_MESSAGE;
    }
    return null;
  });

  /** Query params para conservar `returnUrl` al navegar al registro. */
  readonly registerQueryParams = computed(() => {
    const url = this.rawReturnUrl();
    return url ? { returnUrl: url } : null;
  });

  // ── Formulario ───────────────────────────────────────────
  loginForm = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  // ── Getters ──────────────────────────────────────────────
  get email()    { return this.loginForm.get('email')!; }
  get password() { return this.loginForm.get('password')!; }

  isFieldInvalid(field: AbstractControl | null): boolean {
    return !!(field?.invalid && (field.touched || this.submitted()));
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  // ── Submit ───────────────────────────────────────────────
  async onSubmit(): Promise<void> {
    if (this.isLoading()) return;

    this.submitted.set(true);
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const success = await this.authService.login({
      email:    this.email.value!,
      password: this.password.value!,
    });

    if (success) {
      await this.router.navigateByUrl(this.returnUrl());
    }
  }

  /** Ruta interna de `returnUrl` si es válida, o `null`. */
  private rawReturnUrl(): string | null {
    const url = this.route.snapshot.queryParamMap.get('returnUrl');
    return url && url.startsWith('/') && !url.startsWith('//') ? url : null;
  }

  /** Ruta a la que volver tras entrar (la pone el guard o el interceptor); solo rutas internas. */
  private returnUrl(): string {
    return this.rawReturnUrl() ?? '/dashboard';
  }
}
