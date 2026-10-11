import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TripRecord, VendorPickupInput } from '../../../common/models/trip.model';
import { DirectoryService } from '../../../common/services/directory.service';
import { RolePermissionService } from '../../../common/services/role-permission.service';
import { SessionAuthService } from '../../../common/services/session-auth.service';
import { summarizeTrip, TripService } from '../../../common/services/trip.service';
import { firstValueFrom } from 'rxjs';

type PickupKind = 'broiler' | 'culls' | 'feed';

interface VendorPickupForm extends VendorPickupInput {
  key: number;
}

function emptyPickup(key: number): VendorPickupForm {
  return {
    key,
    vendorId: '',
    broiler: { quantity: null, rate: null },
    culls: { quantity: null, rate: null },
    feed: { quantity: null, rate: null }
  };
}

function today(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-create-trip',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-trip.component.html',
  styleUrl: './create-trip.component.css'
})
export class CreateTripComponent implements OnInit {
  vehicles: TripRecord[] = [];
  drivers: TripRecord[] = [];
  vendors: TripRecord[] = [];
  savedRoutes: string[] = [];
  selectedVehicleId = '';
  selectedDriverId = '';
  route = '';
  tripDate = today();
  feedUnit = '';
  editTripId = '';
  vendorPickups: VendorPickupForm[] = [emptyPickup(1)];
  loading = true;
  saving = false;
  submitted = false;
  errorMessage = '';
  private nextPickupKey = 2;

  constructor(
    private readonly directories: DirectoryService,
    private readonly tripService: TripService,
    private readonly activatedRoute: ActivatedRoute,
    private readonly router: Router,
    private readonly auth: SessionAuthService,
    readonly rolePermissions: RolePermissionService
  ) {}

  async ngOnInit(): Promise<void> {
    this.editTripId = this.activatedRoute.snapshot.paramMap.get('tripId') ?? '';
    try {
      const [vehicles, employees, suppliers, products, trips] = await Promise.all([
        firstValueFrom(this.directories.getDirectory('vehicles')),
        firstValueFrom(this.directories.getDirectory('employees')),
        firstValueFrom(this.directories.getDirectory('suppliers')),
        firstValueFrom(this.directories.getDirectory('products')),
        firstValueFrom(this.directories.getDirectory('trips'))
      ]);
      this.vehicles = vehicles.records.filter((record) =>
        String(record['status'] ?? '').toLowerCase() === 'active' &&
        this.rolePermissions.canAccessRecord('vehicles', record)
      );
      this.drivers = employees.records.filter((record) =>
        String(record['status'] ?? '').toLowerCase() === 'active' &&
        (String(record['department'] ?? '').trim().toLowerCase() === 'driver' ||
          String(record['designation'] ?? '').trim().toLowerCase() === 'driver') &&
        this.rolePermissions.canAccessRecord('employees', record)
      );
      this.vendors = suppliers.records.filter((record) =>
        String(record['status'] ?? '').toLowerCase() === 'active' &&
        this.rolePermissions.canAccessRecord('suppliers', record)
      );
      this.savedRoutes = [...new Set(trips.records
        .filter((record) => this.rolePermissions.canAccessRecord('trips', record))
        .map((record) => String(record['route'] ?? '').trim())
        .filter(Boolean))];
      const feedUnits = [...new Set(products.records.filter((record) =>
        String(record['category'] ?? '').toLowerCase() === 'feed' &&
        String(record['status'] ?? '').toLowerCase() === 'active' &&
        String(record['unit'] ?? '').trim()
      ).map((record) => String(record['unit']).trim()))];
      if (feedUnits.length === 1) {
        this.feedUnit = feedUnits[0];
      } else {
        this.errorMessage = 'Configure active feed products with one consistent unit before creating a trip.';
      }
      if (this.editTripId) {
        const details = await this.tripService.getTripDetails(this.editTripId);
        const trip = details.trip;
        this.selectedVehicleId = String(trip['vehicleId'] ?? '');
        this.selectedDriverId = String(trip['driverId'] ?? '');
        this.route = String(trip['route'] ?? '');
        this.tripDate = String(trip['tripDate'] ?? today());
        this.vendorPickups = details.vendorPickups.length
          ? details.vendorPickups.map((pickup, index) => ({
            key: index + 1,
            vendorId: pickup.vendorId,
            broiler: { quantity: pickup.broiler.quantity, rate: pickup.broiler.rate },
            culls: { quantity: pickup.culls.quantity, rate: pickup.culls.rate },
            feed: { quantity: pickup.feed.quantity, rate: pickup.feed.rate }
          }))
          : [emptyPickup(1)];
        this.nextPickupKey = this.vendorPickups.length + 1;
      }
    } catch (error) {
      this.errorMessage = error instanceof Error
        ? error.message
        : 'Vehicle, driver, vendor, or feed details could not be loaded. Refresh to try again.';
    } finally {
      this.loading = false;
    }
  }

  get canSave(): boolean {
    return this.rolePermissions.can('trips', this.editTripId ? 'update' : 'create');
  }

  get selectedVehicle(): TripRecord | undefined {
    return this.vehicles.find((record) => String(record['_demoId'] ?? '') === this.selectedVehicleId);
  }

  get selectedBirdCapacity(): string | number | null {
    const vehicle = this.selectedVehicle;
    const birdCapacity = vehicle?.['birdCapacity'];
    const capacity = birdCapacity === undefined || birdCapacity === ''
      ? vehicle?.['capacityBirds']
      : birdCapacity;
    return capacity === undefined || capacity === '' ? null : capacity;
  }

  get summary(): ReturnType<typeof summarizeTrip> {
    return summarizeTrip({
      tripDate: this.tripDate,
      vehicleId: this.selectedVehicleId,
      driverId: this.selectedDriverId,
      route: this.route,
      vendorPickups: this.vendorPickups
    });
  }

  get capacityError(): string {
    const vehicle = this.selectedVehicle;
    if (this.selectedBirdCapacity === null) return '';
    const capacity = Number(this.selectedBirdCapacity);
    return Number.isFinite(capacity) && capacity >= 0 && this.summary.birds > capacity
      ? `Total birds exceed this vehicle's capacity of ${capacity}.`
      : '';
  }

  availableVendors(pickup: VendorPickupForm): TripRecord[] {
    const selectedElsewhere = new Set(this.vendorPickups
      .filter((other) => other.key !== pickup.key && other.vendorId)
      .map((other) => other.vendorId));
    return this.vendors.filter((vendor) => {
      const id = String(vendor['_demoId'] ?? '');
      return id === pickup.vendorId || !selectedElsewhere.has(id);
    });
  }

  addVendor(): void {
    if (this.vendorPickups.length < this.vendors.length) {
      this.vendorPickups = [...this.vendorPickups, emptyPickup(this.nextPickupKey++)];
    }
  }

  removeVendor(key: number): void {
    if (this.vendorPickups.length > 1) {
      this.vendorPickups = this.vendorPickups.filter((pickup) => pickup.key !== key);
    }
  }

  lineTotal(pickup: VendorPickupForm, kind: PickupKind): number {
    const line = pickup[kind];
    const total = (line.quantity ?? 0) * (line.rate ?? 0);
    if ((line.quantity !== null && line.quantity < 0) || (line.rate !== null && line.rate < 0) || !Number.isFinite(total)) {
      return 0;
    }
    const rounded = Math.round(total * 100) / 100;
    return Number.isFinite(rounded) ? rounded : 0;
  }

  quantityError(pickup: VendorPickupForm, kind: PickupKind): string {
    const quantity = pickup[kind].quantity;
    if (quantity === null) return '';
    if (!Number.isFinite(quantity) || quantity < 0) return 'Enter a non-negative quantity.';
    if (kind !== 'feed' && (!Number.isSafeInteger(quantity) || !Number.isInteger(quantity))) {
      return 'Bird quantities must be safe whole numbers.';
    }
    if (kind === 'feed' && this.feedUnit.toLowerCase() === 'kg') {
      const cents = quantity * 100;
      if (!Number.isFinite(cents) || Math.abs(cents - Math.round(cents)) > 1e-8) {
        return 'Feed in kilograms must use no more than two decimal places.';
      }
    }
    return '';
  }

  rateError(pickup: VendorPickupForm, kind: PickupKind): string {
    const rate = pickup[kind].rate;
    if (rate === null) return '';
    if (!Number.isFinite(rate) || rate < 0) return 'Enter a non-negative rate.';
    const cents = rate * 100;
    if (!Number.isFinite(cents) || Math.abs(cents - Math.round(cents)) > 1e-8) return 'Use no more than two decimal places.';
    return '';
  }

  vendorError(pickup: VendorPickupForm): string {
    if (!pickup.vendorId) return this.submitted ? 'Select a vendor.' : '';
    if (this.vendorPickups.some((other) => other.key !== pickup.key && other.vendorId === pickup.vendorId)) {
      return 'Each vendor may appear only once per trip.';
    }
    const hasQuantity = [pickup.broiler.quantity, pickup.culls.quantity, pickup.feed.quantity]
      .some((quantity) => quantity !== null && Number.isFinite(quantity) && quantity > 0);
    if (this.submitted && !hasQuantity) return 'Enter a positive pickup quantity for this vendor.';
    for (const kind of ['broiler', 'culls', 'feed'] as const) {
      const quantityError = this.quantityError(pickup, kind);
      if (quantityError) return quantityError;
      const rateError = this.rateError(pickup, kind);
      if (rateError) return rateError;
    }
    return '';
  }

  get hasPickupError(): boolean {
    return this.vendorPickups.some((pickup) => this.vendorError(pickup) !== '');
  }

  cancel(): void {
    void this.router.navigateByUrl('/people-logistics/trips');
  }

  async submitTrip(): Promise<void> {
    this.submitted = true;
    this.errorMessage = '';
    if (!this.canSave || this.saving) return;
    if (!this.selectedVehicleId || !this.selectedDriverId || !this.route.trim() ||
    !this.tripDate ||
      !this.vendorPickups.length || this.hasPickupError || this.capacityError || !this.feedUnit) {
      this.errorMessage = 'Review the required trip details and correct the highlighted fields.';
      return;
    }

    this.saving = true;
    try {
      const input = {
        tripDate: this.tripDate,
        vehicleId: this.selectedVehicleId,
        driverId: this.selectedDriverId,
        route: this.route,
        vendorPickups: this.vendorPickups
      };
      if (this.editTripId) {
        await this.tripService.updateTrip(this.editTripId, input, this.auth.currentUser?.name ?? '');
      } else {
        await this.tripService.createTrip(input, this.auth.currentUser?.name ?? '');
      }
      await this.router.navigateByUrl('/people-logistics/trips', {
        state: { successMessage: this.editTripId ? 'Trip updated successfully.' : 'Trip created successfully.' }
      });
    } catch (error) {
      this.errorMessage = error instanceof Error
        ? error.message
        : 'The trip could not be saved. Your entered details are still available; please try again.';
    } finally {
      this.saving = false;
    }
  }
}
