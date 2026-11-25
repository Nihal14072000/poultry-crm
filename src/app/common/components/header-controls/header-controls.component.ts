import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TripRecord } from '../../models/trip.model';
import { RolePermissionService } from '../../services/role-permission.service';
import { SessionAuthService } from '../../services/session-auth.service';
import { TripApiService } from '../../services/trip-api.service';

@Component({
  selector: 'app-header-controls',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './header-controls.component.html',
  styleUrl: './header-controls.component.css'
})
export class HeaderControlsComponent implements OnInit {
  notificationsOpen = false;
  notificationsLoading = false;
  notificationsError = '';
  tripNotifications: TripRecord[] = [];
  notificationsLoaded = false;
  notificationPopoverTop: number | null = null;
  dateRangeOpen = false;
  dateRangeError = '';
  rangeStart = this.toDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  rangeEnd = this.toDateInput(new Date());
  selectedRangeStart = this.rangeStart;
  selectedRangeEnd = this.rangeEnd;

  constructor(
    private readonly tripApi: TripApiService,
    private readonly auth: SessionAuthService,
    private readonly rolePermissions: RolePermissionService
  ) {}

  ngOnInit(): void {
    if (this.auth.isAuthenticated) {
      void this.loadNotifications();
    }
  }

  toggleNotifications(event: MouseEvent): void {
    const button = event.currentTarget;
    if (button instanceof HTMLElement && button.parentElement) {
      const buttonRect = button.getBoundingClientRect();
      this.notificationPopoverTop = window.matchMedia('(max-width: 720px)').matches
        ? buttonRect.bottom + 8
        : buttonRect.bottom - button.parentElement.getBoundingClientRect().top + 8;
    }
    this.notificationsOpen = !this.notificationsOpen;
    this.dateRangeOpen = false;
    if (this.notificationsOpen && !this.notificationsLoading) {
      void this.loadNotifications();
    }
  }

  async loadNotifications(): Promise<void> {
    this.notificationsLoading = true;
    this.notificationsError = '';
    try {
      const trips = await this.tripApi.getTrips();
      const user = this.auth.currentUser;
      const userId = user?.id ?? user?._demoId;
      const userTrips = userId !== undefined
        ? trips.filter((trip) =>
          String(trip['driverId'] ?? '') === String(userId) ||
          String(trip['supervisorId'] ?? '') === String(userId) ||
          String(trip['labourId'] ?? '') === String(userId)
        )
        : [];
      const scopedTrips = userTrips.length > 0 ? userTrips : trips;
      const activeTrips = scopedTrips.filter((trip) => !this.isCompletedStatus(String(trip['status'] ?? '')));
      this.tripNotifications = activeTrips.length > 0 ? activeTrips : scopedTrips.slice(0, 5);
      this.notificationsLoaded = true;
    } catch {
      this.notificationsError = 'Current trips could not be loaded. Please try again.';
    } finally {
      this.notificationsLoading = false;
    }
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

  get activeTripsCount(): number {
    return this.tripNotifications.filter((trip) => !this.isCompletedStatus(String(trip['status'] ?? ''))).length;
  }

  get tripsOverviewRoute(): string {
    return this.rolePermissions.canAccessRoute('trips')
      ? '/people-logistics/trips'
      : '/people-logistics/deliveries';
  }

  tripRoute(trip: TripRecord): string[] {
    const id = String(trip['_demoId'] ?? '');
    if (!id) return [this.tripsOverviewRoute];
    return this.rolePermissions.canAccessRoute('trips')
      ? ['/people-logistics/trips', id]
      : ['/people-logistics/trips/deliveries', id];
  }

  tripParticipants(trip: TripRecord): string {
    const driver = String(trip['driverName'] ?? '').trim();
    const supervisor = String(trip['supervisorName'] ?? '').trim();
    const vehicle = String(trip['vehicleName'] ?? '').trim();
    const parts = [
      driver ? `Driver: ${driver}` : '',
      supervisor ? `Supervisor: ${supervisor}` : '',
      vehicle ? `Vehicle: ${vehicle}` : ''
    ].filter(Boolean);
    return parts.join(' · ') || 'Unassigned';
  }

  tripStatusClass(status: string): string {
    const normalized = status.trim().toLowerCase();
    if (normalized === 'completed') return 'low';
    if (normalized.includes('progress') || normalized === 'assigned' || normalized === 'in transit') return 'medium';
    return 'high';
  }

  private isCompletedStatus(status: string): boolean {
    const normalized = status.trim().toLowerCase();
    return normalized === 'completed' || normalized === 'cancelled' || normalized === 'deleted';
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
