import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TripRecord } from '../../../common/models/trip.model';
import { TripApiService } from '../../../common/services/trip-api.service';
import { RolePermissionService } from '../../../common/services/role-permission.service';
import { SessionAuthService } from '../../../common/services/session-auth.service';

@Component({
  selector: 'app-trips',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './trips.component.html',
  styleUrl: './trips.component.css'
})
export class TripsComponent implements OnInit {
  trips: TripRecord[] = [];
  loading = true;
  errorMessage = '';
  successMessage: string;

  constructor(
    private readonly tripService: TripApiService,
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
