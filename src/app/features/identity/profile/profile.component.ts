import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SessionAuthService } from '../../../common/services/session-auth.service';
import { ToastService } from '../../../common/services/toast.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent {
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  saving = false;
  error = '';

  constructor(
    readonly auth: SessionAuthService,
    private readonly toast: ToastService
  ) {}

  get userInitials(): string {
    const name = this.auth.currentUser?.name ?? '';
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'U';
  }

  updatePassword(): void {
    this.error = '';

    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.error = 'Fill in all password fields.';
      return;
    }
    if (this.newPassword.length < 8) {
      this.error = 'New password must be at least 8 characters.';
      return;
    }
    if (new TextEncoder().encode(this.newPassword).length > 72) {
      this.error = 'New password must be at most 72 bytes.';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.error = 'New password and confirmation do not match.';
      return;
    }
    if (this.newPassword === this.currentPassword) {
      this.error = 'New password must be different from your current password.';
      return;
    }

    this.saving = true;
    this.auth.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: () => {
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.saving = false;
        this.toast.success('Password updated successfully.');
      },
      error: (error: unknown) => {
        this.saving = false;
        if (error instanceof HttpErrorResponse) {
          const message = typeof error.error?.message === 'string' ? error.error.message : '';
          this.error = message || (error.status === 400
            ? 'Current password is incorrect or new password is invalid.'
            : 'Could not update password. Please try again.');
          return;
        }
        this.error = 'Could not update password. Please try again.';
      }
    });
  }
}
