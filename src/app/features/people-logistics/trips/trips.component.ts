import { LoadingSkeletonComponent } from '../../../common/components/loading-skeleton/loading-skeleton.component';
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TripRecord } from '../../../common/models/trip.model';
import { TripApiService } from '../../../common/services/trip-api.service';
import { TripService } from '../../../common/services/trip.service';
import { RolePermissionService } from '../../../common/services/role-permission.service';
import { StatusPillPipe } from '../../../common/pipes/status-pill.pipe';
import { ToastService } from '../../../common/services/toast.service';

@Component({
  selector: 'app-trips',
  standalone: true,
  imports: [CommonModule, LoadingSkeletonComponent, RouterLink, StatusPillPipe],
  templateUrl: './trips.component.html',
  styleUrl: './trips.component.css'
})
export class TripsComponent implements OnInit {
  trips: TripRecord[] = [];
  loading = true;
  errorMessage = '';
  deletingTripId: string | null = null;
  page = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;

  constructor(
    private readonly tripService: TripApiService,
    private readonly tripRecords: TripService,
    private readonly router: Router,
    readonly rolePermissions: RolePermissionService,
    private readonly toast: ToastService
  ) {
    const state = router.getCurrentNavigation()?.extras.state as { successMessage?: string } | undefined;
    if (state?.successMessage) this.toast.success(state.successMessage);
  }

  get canOpenTripDeliveries(): boolean {
    return this.rolePermissions.can('trips', 'transition');
  }

  get tripDeliveriesLabel(): string {
    return this.rolePermissions.can('trips', 'create')
      ? 'Trip deliveries' : 'My assigned trips';
  }

  isDeleted(trip: TripRecord): boolean { return trip['status'] === 'Deleted'; }

  async deleteTrip(trip: TripRecord): Promise<void> {
    const id = String(trip['_demoId'] ?? '');
    if (!id || this.deletingTripId || !this.rolePermissions.can('trips', 'delete')) return;
    if (!window.confirm('Delete this trip? This action cannot be undone.')) return;

    this.deletingTripId = id;
    this.errorMessage = '';
    try {
      await this.tripRecords.softDeleteTrip(id);
      trip['status'] = 'Deleted';
      this.toast.success('Trip deleted successfully.');
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Trip could not be deleted. Try again.';
    } finally {
      this.deletingTripId = null;
    }
  }

  get rangeStart(): number {
    return this.totalElements === 0 ? 0 : this.page * this.pageSize + 1;
  }

  get rangeEnd(): number {
    return Math.min((this.page + 1) * this.pageSize, this.totalElements);
  }

  async changePageSize(size: number): Promise<void> {
    this.pageSize = Number(size) || 10;
    await this.loadPage(0);
  }

  async loadPage(targetPage: number): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    try {
      const result = await this.tripService.getTripsPage(targetPage, this.pageSize);
      this.trips = result.items;
      this.page = result.page;
      this.pageSize = result.size;
      this.totalElements = result.totalElements;
      this.totalPages = result.totalPages;
    } catch {
      this.errorMessage = 'Trips could not be loaded. Refresh the page to try again.';
    } finally {
      this.loading = false;
    }
  }

  async ngOnInit(): Promise<void> {
    await this.loadPage(0);
  }
}
