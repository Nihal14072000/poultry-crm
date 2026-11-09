import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TripRecord } from '../../../common/models/trip.model';
import { TripApiService } from '../../../common/services/trip-api.service';
import { TripService } from '../../../common/services/trip.service';
import { RolePermissionService } from '../../../common/services/role-permission.service';
import { SessionAuthService } from '../../../common/services/session-auth.service';
import { StatusPillPipe } from '../../../common/pipes/status-pill.pipe';

@Component({
  selector: 'app-trips',
  standalone: true,
  imports: [CommonModule, RouterLink, StatusPillPipe],
  templateUrl: './trips.component.html',
  styleUrl: './trips.component.css'
})
export class TripsComponent implements OnInit {
  trips: TripRecord[] = [];
  loading = true;
  errorMessage = '';
  deletingTripId: string | null = null;
  successMessage: string;

  constructor(
    private readonly tripService: TripApiService,
    private readonly tripRecords: TripService,
    private readonly router: Router,
    readonly rolePermissions: RolePermissionService,
    readonly auth: SessionAuthService
  ) {
    const state = router.getCurrentNavigation()?.extras.state as { successMessage?: string } | undefined;
    this.successMessage = state?.successMessage ?? '';
  }

  get canOpenTripDeliveries(): boolean {
    return ['Farm Supervisor', 'Supervisor', 'Sales Manager', 'Organization Admin'].includes(this.auth.currentUser?.role ?? '');
  }

  get tripDeliveriesLabel(): string {
    return ['Sales Manager', 'Organization Admin'].includes(this.auth.currentUser?.role ?? '')
      ? 'Trip deliveries' : 'My assigned trips';
  }

  isDeleted(trip: TripRecord): boolean { return trip['status'] === 'Deleted'; }

  async deleteTrip(trip: TripRecord): Promise<void> {
    const id = String(trip['_demoId'] ?? '');
    if (!id || this.deletingTripId || !this.rolePermissions.can('trips', 'delete')) return;
    if (!window.confirm('Delete this trip? This action cannot be undone.')) return;

    this.deletingTripId = id;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.tripRecords.softDeleteTrip(id);
      trip['status'] = 'Deleted';
      this.successMessage = 'Trip deleted successfully.';
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Trip could not be deleted. Try again.';
    } finally {
      this.deletingTripId = null;
    }
  }

  async ngOnInit(): Promise<void> {
    try {
      this.trips = await this.tripService.getTrips();
    } catch {
      this.errorMessage = 'Trips could not be loaded. Refresh the page to try again.';
    } finally {
      this.loading = false;
    }
  }
}
