import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SessionAuthService } from '../../../common/services/session-auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  username = '';
  password = '';
  loading = false;
  error = '';

  constructor(
    private readonly auth: SessionAuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  signIn(): void {
    this.error = '';
    this.loading = true;
    this.auth.signIn(this.username, this.password).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/workspace/overview';
        void this.router.navigateByUrl(returnUrl.startsWith('/') ? returnUrl : '/workspace/overview');
      },
      error: (error: unknown) => {
        this.error = error instanceof HttpErrorResponse && error.status === 401
          ? 'Username or password is incorrect.'
          : error instanceof HttpErrorResponse && error.status === 403
            ? 'Your account cannot access the employee directory.'
            : 'Sign in could not be completed. Check the API connection and try again.';
        this.loading = false;
      }
    });
  }
}
