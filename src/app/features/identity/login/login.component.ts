import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SessionAuthService, DEMO_PASSWORD } from '../../../common/services/session-auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  email = 'alex.morgan@example.test';
  password = '';
  loading = false;
  error = '';
  readonly demoPassword = DEMO_PASSWORD;

  constructor(
    private readonly auth: SessionAuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  signIn(): void {
    this.error = '';
    this.loading = true;
    this.auth.signIn(this.email, this.password).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/workspace/overview';
        void this.router.navigateByUrl(returnUrl.startsWith('/') ? returnUrl : '/workspace/overview');
      },
      error: (error: unknown) => {
        this.error = error instanceof Error ? error.message : 'Sign in could not be completed.';
        this.loading = false;
      }
    });
  }
}
