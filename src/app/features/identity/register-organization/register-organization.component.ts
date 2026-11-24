import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-register-organization',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './register-organization.component.html',
  styleUrl: '../login/login.component.css'
})
export class RegisterOrganizationComponent {
  companyName = '';
  ownerName = '';
  username = '';
  password = '';
  confirmPassword = '';
  loading = false;
  error = '';
  created = false;

  constructor(private readonly http: HttpClient) {}

  register(): void {
    this.error = '';
    if (this.password !== this.confirmPassword) {
      this.error = 'Passwords do not match.';
      return;
    }

    this.loading = true;
    this.http.post(
      `${environment.apiUrl}/tenants/register`,
      {
        companyName: this.companyName.trim(),
        ownerName: this.ownerName.trim(),
        username: this.username.trim(),
        password: this.password
      }
    ).subscribe({
      next: () => {
        this.created = true;
        this.loading = false;
      },
      error: (error: unknown) => {
        this.error = error instanceof HttpErrorResponse && error.status === 409
          ? 'That username is already in use. Choose another username.'
          : error instanceof HttpErrorResponse && error.status === 400
            ? 'Check the organization details and password requirements.'
            : 'Organization registration could not be completed. Check the API connection and try again.';
        this.loading = false;
      }
    });
  }
}
