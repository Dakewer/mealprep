import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NotificationToastComponent } from './shared/components/notification-toast/notification-toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NotificationToastComponent],
  template: `
    <!-- Global toast notifications -->
    <app-notification-toast />
    <!-- Routed pages -->
    <router-outlet />
  `,
  styles: [':host { display: block; }'],
})
export class App {}
