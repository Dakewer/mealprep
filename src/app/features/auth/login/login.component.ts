import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RippleDirective } from '../../../shared/directives/ripple.directive';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, RippleDirective],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private fb           = inject(FormBuilder);
  private authService  = inject(AuthService);
  private notifService = inject(NotificationService);
  private router       = inject(Router);

  // ── UI state ─────────────────────────────────────────────
  showPassword = signal(false);
  isLoading    = signal(false);

  // ── Form ─────────────────────────────────────────────────
  loginForm = this.fb.group({
    email:      ['', [Validators.required, Validators.email]],
    password:   ['', [Validators.required, Validators.minLength(6)]],
    rememberMe: [false],
  });

  // ── Getters ───────────────────────────────────────────────
  get email()    { return this.loginForm.get('email')!; }
  get password() { return this.loginForm.get('password')!; }

  isFieldInvalid(field: ReturnType<typeof this.loginForm.get>): boolean {
    return !!(field?.invalid && field.touched);
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  // ── Submit ────────────────────────────────────────────────
  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.notifService.error('Por favor, completa todos los campos correctamente.');
      return;
    }

    this.isLoading.set(true);

    const success = await this.authService.login({
      email:      this.email.value!,
      password:   this.password.value!,
      rememberMe: this.loginForm.value.rememberMe ?? false,
    });

    this.isLoading.set(false);

    if (success) {
      this.notifService.success('¡Bienvenido de vuelta! Redirigiendo al dashboard…');
      setTimeout(() => this.router.navigate(['/dashboard']), 1200);
    } else {
      this.notifService.error('Credenciales incorrectas. Intenta de nuevo.');
    }
  }
}
