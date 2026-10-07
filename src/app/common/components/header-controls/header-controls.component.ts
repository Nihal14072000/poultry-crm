import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DirectoryService } from '../../services/directory.service';

@Component({
  selector: 'app-header-controls',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './header-controls.component.html',
  styleUrl: './header-controls.component.css'
})
export class HeaderControlsComponent {
  notificationsOpen = false;
  notificationsLoading = false;
  notificationsError = '';
  notifications: Record<string, string | number>[] = [];
  notificationsLoaded = false;
  dateRangeOpen = false;
  dateRangeError = '';
  rangeStart = this.toDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  rangeEnd = this.toDateInput(new Date());
  selectedRangeStart = this.rangeStart;
  selectedRangeEnd = this.rangeEnd;

  constructor(private readonly directories: DirectoryService) {}

  toggleNotifications(): void {
    this.notificationsOpen = !this.notificationsOpen;
    this.dateRangeOpen = false;
    if (this.notificationsOpen && !this.notificationsLoaded && !this.notificationsLoading) {
      this.loadNotifications();
    }
  }

  loadNotifications(): void {
    this.notificationsLoading = true;
    this.notificationsError = '';
    this.directories.getDirectory('notifications').subscribe({
      next: (response) => {
        this.notifications = response.records;
        this.notificationsLoaded = true;
        this.notificationsLoading = false;
      },
      error: () => {
        this.notificationsError = 'Notifications could not be loaded. Please try again.';
        this.notificationsLoading = false;
      }
    });
  }

  toggleDateRange(): void {
    this.dateRangeOpen = !this.dateRangeOpen;
    this.notificationsOpen = false;
    this.dateRangeError = '';
  }

  selectDatePreset(preset: 'today' | 'last-seven-days' | 'this-month'): void {
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const start = new Date(end);
    if (preset === 'last-seven-days') start.setDate(start.getDate() - 6);
    if (preset === 'this-month') start.setDate(1);
    this.rangeStart = this.toDateInput(start);
    this.rangeEnd = this.toDateInput(end);
    this.dateRangeError = '';
  }

  applyDateRange(): void {
    if (!this.rangeStart || !this.rangeEnd || this.rangeStart > this.rangeEnd) {
      this.dateRangeError = 'Choose a valid start and end date.';
      return;
    }
    this.selectedRangeStart = this.rangeStart;
    this.selectedRangeEnd = this.rangeEnd;
    this.dateRangeOpen = false;
    this.dateRangeError = '';
  }

  get selectedRangeLabel(): string {
    return `${this.formatDate(this.selectedRangeStart)} – ${this.formatDate(this.selectedRangeEnd)}`;
  }

  notificationSeverityClass(notification: Record<string, string | number>): string {
    return String(notification['severity'] ?? '').toLowerCase();
  }

  private toDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatDate(value: string): string {
    if (!value) return '';
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' })
      .format(new Date(year, month - 1, day));
  }
}
