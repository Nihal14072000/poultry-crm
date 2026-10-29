import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TripExpenseInput, TripPaymentInput, TripRecord, VendorDeliveryInput, VendorPickupInput } from '../../../common/models/trip.model';
import { DirectoryService } from '../../../common/services/directory.service';
import { RolePermissionService } from '../../../common/services/role-permission.service';
import { summarizeTrip } from '../../../common/services/trip.service';
import { TripApiService, TripFormOptions } from '../../../common/services/trip-api.service';
import { firstValueFrom } from 'rxjs';

type PickupKind = 'broiler' | 'culls' | 'feed';

interface VendorPickupForm extends VendorPickupInput {
  key: number;
}

interface VendorDeliveryForm extends VendorDeliveryInput {
  key: number;
  broilerWeight: number | null;
  cullsWeight: number | null;
  feedQuantity: number | null;
  feedWeight: number | null;
  feedRate: number | null;
}

function emptyPickup(key: number): VendorPickupForm {
  return {
    key,
    vendorId: '',
    broiler: { quantity: null, weight: null, rate: null },
    culls: { quantity: null, weight: null, rate: null },
    feed: { quantity: null, weight: null, rate: null }
  };
}

function emptyDeliveryStop(key: number): VendorDeliveryForm {
  return { key, vendorDestinationId: '', broilerQuantity: null, broilerWeight: null, broilerRate: null,
    cullsQuantity: null, cullsWeight: null, cullsRate: null, feedQuantity: null, feedWeight: null, feedRate: null };
}

function today(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-create-trip',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './create-trip.component.html',
  styleUrl: './create-trip.component.css'
})
export class CreateTripComponent implements OnInit {
  vehicles: TripRecord[] = [];
  drivers: TripRecord[] = [];
  vendors: TripRecord[] = [];
  supervisors: TripRecord[] = [];
  deliveryVendors: TripRecord[] = [];
  deliveryStops: VendorDeliveryForm[] = [emptyDeliveryStop(1)];
  selectedSupervisorId = '';
  private formOptions?: TripFormOptions;
  savedRoutes: string[] = [];
  selectedVehicleId = '';
  selectedDriverId = '';
  route = '';
  tripDate = today();
  feedUnit = '';
  editTripId = '';
  vendorPickups: VendorPickupForm[] = [emptyPickup(1)];
  payments: TripPaymentInput[] = [];
  expenses: TripExpenseInput[] = [];
  loading = true;
  saving = false;
  submitted = false;
  errorMessage = '';
  private nextPickupKey = 2;
  private nextDeliveryKey = 2;

  constructor(
    private readonly directories: DirectoryService,
    private readonly tripApi: TripApiService,
    private readonly activatedRoute: ActivatedRoute,
    private readonly router: Router,
    readonly rolePermissions: RolePermissionService
  ) {}

  async ngOnInit(): Promise<void> {
    this.editTripId = this.activatedRoute.snapshot.paramMap.get('tripId') ?? '';
    try {
      const [options, products] = await Promise.all([
        this.tripApi.getFormOptions(),
        firstValueFrom(this.directories.getDirectory('products'))
      ]);
      this.formOptions = options;
      this.vehicles = options.vehicles.filter((record) =>
        this.rolePermissions.canAccessRecord('vehicles', record)
      );
      this.drivers = options.drivers.filter((record) =>
        this.rolePermissions.canAccessRecord('employees', record)
      );
      this.vendors = options.suppliers.filter((record) =>
        this.rolePermissions.canAccessRecord('suppliers', record)
      );
      this.supervisors = options.supervisors;
      this.deliveryVendors = options.deliveryVendors;
      this.savedRoutes = [...new Set(options.trips
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
        const details = await this.tripApi.getTripDetails(this.editTripId);
        const trip = details.trip;
        this.selectedVehicleId = String(trip['vehicleId'] ?? '');
        this.selectedDriverId = String(trip['driverId'] ?? '');
        this.route = String(trip['route'] ?? '');
        this.selectedSupervisorId = String(trip['supervisorId'] ?? '');
        try {
          const savedStops: unknown = JSON.parse(String(trip['vendorDeliveries'] ?? '[]'));
          this.deliveryStops = Array.isArray(savedStops) && savedStops.length
            ? savedStops.map((item, index) => {
              const stop = item as Record<string, unknown>;
              return { key: index + 1, vendorDestinationId: String(stop['vendorDestinationId'] ?? ''),
                broilerQuantity: Number(stop['orderedBroiler'] ?? 0), broilerWeight: Number(stop['orderedBroilerWeight'] ?? 0),
                broilerRate: Number(stop['broilerRate'] ?? 0), cullsQuantity: Number(stop['orderedCulls'] ?? 0),
                cullsWeight: Number(stop['orderedCullsWeight'] ?? 0), cullsRate: Number(stop['cullsRate'] ?? 0),
                feedQuantity: Number(stop['orderedFeed'] ?? 0), feedWeight: Number(stop['orderedFeedWeight'] ?? 0),
                feedRate: Number(stop['feedRate'] ?? 0) };
            }) : [emptyDeliveryStop(1)];
          this.nextDeliveryKey = this.deliveryStops.length + 1;
        } catch { this.deliveryStops = [emptyDeliveryStop(1)]; }
        this.tripDate = String(trip['tripDate'] ?? today());
        this.vendorPickups = details.vendorPickups.length
          ? details.vendorPickups.map((pickup, index) => ({
            key: index + 1,
            vendorId: pickup.vendorId,
            broiler: { quantity: pickup.broiler.quantity, weight: pickup.broiler.weight ?? null, rate: pickup.broiler.rate },
            culls: { quantity: pickup.culls.quantity, weight: pickup.culls.weight ?? null, rate: pickup.culls.rate },
            feed: { quantity: pickup.feed.quantity, weight: pickup.feed.weight ?? null, rate: pickup.feed.rate }
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

  recordId(record: TripRecord): string { return String(record['_demoId'] ?? ''); }

  get availableDrivers(): TripRecord[] {
    const activeTrips = (this.formOptions?.trips ?? []).filter((trip) => {
      const isCurrentTrip = !!this.editTripId && (
        String(trip['_demoId'] ?? '') === this.editTripId ||
        String(trip['tripId'] ?? '') === this.editTripId ||
        String(trip['tripNumber'] ?? '') === this.editTripId
      );
      if (isCurrentTrip) return false;
      const status = String(trip['status'] ?? '').toLowerCase();
      return status !== 'completed' && status !== 'deleted';
    });
    const assignedDriverIds = new Set(
      activeTrips.map((trip) => String(trip['driverId'] ?? '')).filter(Boolean)
    );
    return this.drivers.filter((driver) => {
      const id = String(driver['_demoId'] ?? driver['id'] ?? '');
      return id === this.selectedDriverId || !assignedDriverIds.has(id);
    });
  }

  get availableSupervisors(): TripRecord[] {
    const activeTrips = (this.formOptions?.trips ?? []).filter((trip) => {
      const isCurrentTrip = !!this.editTripId && (
        String(trip['_demoId'] ?? '') === this.editTripId ||
        String(trip['tripId'] ?? '') === this.editTripId ||
        String(trip['tripNumber'] ?? '') === this.editTripId
      );
      if (isCurrentTrip) return false;
      const status = String(trip['status'] ?? '').toLowerCase();
      return status !== 'completed' && status !== 'deleted';
    });
    const assignedSupervisorIds = new Set(
      activeTrips.map((trip) => String(trip['supervisorId'] ?? '')).filter(Boolean)
    );
    return this.supervisors.filter((supervisor) => {
      const id = String(supervisor['_demoId'] ?? supervisor['id'] ?? '');
      return id === this.selectedSupervisorId || !assignedSupervisorIds.has(id);
    });
  }

  availableDeliveryVendors(stop: VendorDeliveryForm): TripRecord[] {
    const used = new Set(this.deliveryStops.filter((item) => item.key !== stop.key).map((item) => item.vendorDestinationId));
    return this.deliveryVendors.filter((item) => this.recordId(item) === stop.vendorDestinationId || !used.has(this.recordId(item)));
  }

  selectedDeliveryVendor(stop: VendorDeliveryForm): TripRecord | undefined {
    return this.deliveryVendors.find((item) => this.recordId(item) === stop.vendorDestinationId);
  }

  addDeliveryStop(): void {
    if (this.deliveryStops.length < this.deliveryVendors.length) this.deliveryStops = [...this.deliveryStops, emptyDeliveryStop(this.nextDeliveryKey++)];
  }

  removeDeliveryStop(key: number): void {
    if (this.deliveryStops.length > 1) this.deliveryStops = this.deliveryStops.filter((item) => item.key !== key);
  }

  get deliveryStopError(): string {
    if (!this.deliveryStops.length) return 'Add at least one vendor destination.';
    const ids = this.deliveryStops.map((item) => item.vendorDestinationId);
    if (ids.some((id) => !id) || new Set(ids).size !== ids.length) return 'Select a different vendor destination for each stop.';
    if (this.deliveryStops.some((item) => [item.broilerQuantity, item.cullsQuantity, item.feedQuantity].some((quantity) => quantity !== null && (!Number.isSafeInteger(quantity) || quantity < 0)) || [item.broilerWeight, item.cullsWeight, item.feedWeight].some((weight) => weight !== null && (!Number.isFinite(weight) || weight < 0 || Math.abs(weight * 100 - Math.round(weight * 100)) > 1e-8)) || [item.broilerRate, item.cullsRate, item.feedRate].some((rate) => rate !== null && (!Number.isFinite(rate) || rate < 0 || Math.abs(rate * 100 - Math.round(rate * 100)) > 1e-8)) || (Number(item.broilerQuantity ?? 0) > 0 && Number(item.broilerWeight ?? 0) <= 0) || (Number(item.cullsQuantity ?? 0) > 0 && Number(item.cullsWeight ?? 0) <= 0) || (Number(item.feedQuantity ?? 0) > 0 && Number(item.feedWeight ?? 0) <= 0) || (Number(item.feedQuantity ?? 0) === 0 && Number(item.feedWeight ?? 0) > 0) || Number(item.broilerQuantity ?? 0) + Number(item.cullsQuantity ?? 0) <= 0)) return 'Each vendor stop needs positive whole-number quantities, valid weights and rates, and a weight for any feed quantity.';
    return '';
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

  addPayment(): void { this.payments = [...this.payments, { paymentType: 'BUYER_RECEIPT', partyId: '', amount: null, paymentDate: this.tripDate, paymentMethod: 'UPI' }]; }
  removePayment(index: number): void { this.payments = this.payments.filter((_, itemIndex) => itemIndex !== index); }
  changePaymentType(payment: TripPaymentInput): void { payment.partyId = ''; }
  paymentParties(payment: TripPaymentInput): TripRecord[] { return payment.paymentType === 'BUYER_RECEIPT' ? this.vendors : this.deliveryVendors; }
  addExpense(): void { this.expenses = [...this.expenses, { category: '', amount: null, expenseDate: this.tripDate }]; }
  removeExpense(index: number): void { this.expenses = this.expenses.filter((_, itemIndex) => itemIndex !== index); }

  get financeError(): string {
    const paymentsValid = this.payments.every(payment => payment.partyId && Number(payment.amount) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(payment.paymentDate));
    const expensesValid = this.expenses.every(expense => expense.category.trim() && Number(expense.amount) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(expense.expenseDate));
    return paymentsValid && expensesValid ? '' : 'Each payment needs a party, positive amount and date; each expense needs a category, positive amount and date.';
  }

  lineTotal(pickup: VendorPickupForm, kind: PickupKind): number {
    const line = pickup[kind];
    const total = (line.weight ?? 0) * (line.rate ?? 0);
    if ((line.weight !== null && (line.weight ?? 0) < 0) || (line.rate !== null && line.rate < 0) || !Number.isFinite(total)) {
      return 0;
    }
    const rounded = Math.round(total * 100) / 100;
    return Number.isFinite(rounded) ? rounded : 0;
  }

  deliveryLineTotal(stop: VendorDeliveryForm, kind: 'broiler' | 'culls' | 'feed'): number {
    const weight = stop[`${kind}Weight`] ?? 0;
    const rate = stop[`${kind}Rate`] ?? 0;
    const total = weight * rate;
    return Number.isFinite(total) ? Math.round(total * 100) / 100 : 0;
  }

  deliveryStopTotal(stop: VendorDeliveryForm): number {
    return Math.round((this.deliveryLineTotal(stop, 'broiler') + this.deliveryLineTotal(stop, 'culls') + this.deliveryLineTotal(stop, 'feed')) * 100) / 100;
  }

  get deliveryGrandTotal(): number {
    return Math.round(this.deliveryStops.reduce((sum, stop) => sum + this.deliveryStopTotal(stop), 0) * 100) / 100;
  }

  quantityError(pickup: VendorPickupForm, kind: PickupKind): string {
    const quantity = pickup[kind].quantity;
    if (quantity === null) return '';
    if (!Number.isFinite(quantity) || quantity < 0) return 'Enter a non-negative quantity.';
    if (!Number.isSafeInteger(quantity)) {
      return 'Order quantities must be safe whole numbers for the backend.';
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

  weightError(pickup: VendorPickupForm, kind: PickupKind): string {
    const weight = pickup[kind].weight ?? null;
    if (weight === null) return '';
    if (!Number.isFinite(weight) || weight < 0) return 'Enter a non-negative weight.';
    const hundredths = weight * 100;
    return !Number.isFinite(hundredths) || Math.abs(hundredths - Math.round(hundredths)) > 1e-8
      ? 'Use no more than two decimal places.' : '';
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
      const weightError = this.weightError(pickup, kind);
      if (weightError) return weightError;
      if ((pickup[kind].quantity ?? 0) > 0 && (pickup[kind].weight ?? 0) <= 0) return `Enter a positive ${kind} weight in kilograms.`;
      if ((pickup[kind].quantity ?? 0) === 0 && (pickup[kind].weight ?? 0) > 0) return `Enter a ${kind} quantity for the recorded weight.`;
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
    if (!this.formOptions) {
      this.errorMessage = 'Trip reference data is unavailable. Reload the page before saving.';
      return;
    }
    if (!this.selectedVehicleId || !this.selectedDriverId || !this.route.trim() ||
    !this.tripDate ||
      !this.vendorPickups.length || this.hasPickupError || this.capacityError || this.financeError || !this.feedUnit ||
      !this.selectedSupervisorId || this.deliveryStopError) {
      this.errorMessage = 'Review the trip assignment, assigned supervisor, vendor destinations, and pickup details.';
      return;
    }
    if (!this.availableDrivers.some((d) => String(d['_demoId'] ?? d['id'] ?? '') === this.selectedDriverId)) {
      this.errorMessage = 'The selected driver is already assigned to an active trip.';
      return;
    }
    if (!this.availableSupervisors.some((s) => String(s['_demoId'] ?? s['id'] ?? '') === this.selectedSupervisorId)) {
      this.errorMessage = 'The selected supervisor is already assigned to an active trip.';
      return;
    }

    this.saving = true;
    try {
      const input = {
        tripDate: this.tripDate,
        vehicleId: this.selectedVehicleId,
        driverId: this.selectedDriverId,
        route: this.route,
        vendorPickups: this.vendorPickups,
        supervisorId: this.selectedSupervisorId,
        vendorDeliveries: this.deliveryStops.map(({ key: _key, ...stop }) => stop),
        payments: this.payments,
        expenses: this.expenses
      };
      if (this.editTripId) {
        await this.tripApi.updateTrip(this.editTripId, input, this.formOptions);
      } else {
        await this.tripApi.insertTrip(input, this.formOptions);
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
