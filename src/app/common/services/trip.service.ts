import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  CreateTripInput,
  TripLineInput,
  TripRecord,
  TripSummary,
  TripVendorPickup,
  VendorPickupInput
} from '../models/trip.model';
import { DirectoryService } from './directory.service';
import { RolePermissionService } from './role-permission.service';

function isValidDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

@Injectable({ providedIn: 'root' })
export class TripService {
  constructor(
    private readonly directories: DirectoryService,
    private readonly rolePermissions: RolePermissionService
  ) {}

  async getTrips(): Promise<TripRecord[]> {
    const response = await firstValueFrom(this.directories.getDirectory('trips'));
    return response.records.filter((record) => this.rolePermissions.canAccessRecord('trips', record));
  }

  async getTripDetails(id: string): Promise<{ trip: TripRecord; vendorPickups: TripVendorPickup[] }> {
    const trips = await this.getTrips();
    const trip = trips.find((record) => String(record['_demoId'] ?? '') === id);
    if (!trip) throw new Error('This trip could not be found or you do not have access to it.');
    return { trip, vendorPickups: this.readVendorPickups(trip) };
  }

  async createTrip(input: CreateTripInput, createdBy: string): Promise<TripRecord> {
    return this.saveTrip(input, createdBy);
  }

  async updateTrip(id: string, input: CreateTripInput, updatedBy: string): Promise<TripRecord> {
    return this.saveTrip(input, updatedBy, id);
  }

  private async saveTrip(input: CreateTripInput, updatedBy: string, tripId?: string): Promise<TripRecord> {
    const action = tripId ? 'update' : 'create';
    if (!this.rolePermissions.can('trips', action)) {
      throw new Error(`You do not have permission to ${action} trips.`);
    }
    const [vehicles, employees, suppliers, products, trips] = await Promise.all([
      this.directories.getDirectory('vehicles'),
      this.directories.getDirectory('employees'),
      this.directories.getDirectory('suppliers'),
      this.directories.getDirectory('products'),
      this.directories.getDirectory('trips')
    ].map((request) => firstValueFrom(request)));
    const existingTrip = tripId
      ? trips.records.find((record) => String(record['_demoId'] ?? '') === tripId)
      : undefined;
    if (tripId && (!existingTrip || !this.rolePermissions.canAccessRecord('trips', existingTrip))) {
      throw new Error('This trip could not be found or you do not have access to it.');
    }

    const vehicle = vehicles.records.find((record) => String(record['_demoId'] ?? '') === input.vehicleId);
    if (!vehicle || !this.rolePermissions.canAccessRecord('vehicles', vehicle) ||
      String(vehicle['status'] ?? '').toLowerCase() !== 'active') {
      throw new Error('Choose an active vehicle you are allowed to use.');
    }

    const driver = employees.records.find((record) => String(record['_demoId'] ?? '') === input.driverId);
    if (!driver || !this.rolePermissions.canAccessRecord('employees', driver) ||
      String(driver['status'] ?? '').toLowerCase() !== 'active' || !this.isDriver(driver)) {
      throw new Error('Choose an active driver employee you are allowed to use.');
    }

    const feedUnits = [...new Set(products.records.filter((record) =>
      String(record['category'] ?? '').toLowerCase() === 'feed' &&
      String(record['status'] ?? '').toLowerCase() === 'active' &&
      String(record['unit'] ?? '').trim()
    ).map((record) => String(record['unit']).trim()))];
    if (feedUnits.length !== 1) {
      throw new Error('Configure active feed products with one consistent unit before creating a trip.');
    }
    const feedUnit = feedUnits[0];
    this.validateTripInput(input);

    if (!Array.isArray(input.vendorPickups) || !input.vendorPickups.length) {
      throw new Error('Add at least one vendor pickup.');
    }
    if (!input.vendorPickups.every((pickup) =>
      pickup !== null && typeof pickup === 'object' && typeof pickup.vendorId === 'string'
    )) {
      throw new Error('Each vendor pickup must have a valid vendor and item details.');
    }
    const vendorIds = input.vendorPickups.map((pickup) => String(pickup.vendorId ?? '').trim());
    if (vendorIds.some((id) => !id)) throw new Error('Select a vendor for each pickup.');
    if (new Set(vendorIds).size !== vendorIds.length) {
      throw new Error('Select each vendor only once per trip.');
    }
    const vendorPickups = input.vendorPickups.map((pickup, index) => {
      const vendor = suppliers.records.find((record) => String(record['_demoId'] ?? '') === vendorIds[index]);
      if (!vendor || !this.rolePermissions.canAccessRecord('suppliers', vendor) ||
        String(vendor['status'] ?? '').toLowerCase() !== 'active') {
        throw new Error('Choose active vendors you are allowed to use.');
      }
      return this.validatePickup({ ...pickup, vendorId: vendorIds[index] }, feedUnit, String(vendor['name'] ?? ''));
    });

    const totalBroiler = this.sum(vendorPickups.map((pickup) => pickup.broiler.quantity));
    const totalCulls = this.sum(vendorPickups.map((pickup) => pickup.culls.quantity));
    const totalFeed = this.sum(vendorPickups.map((pickup) => pickup.feed.quantity));
    const totalBirds = totalBroiler + totalCulls;
    const grandTotal = this.sum(vendorPickups.map((pickup) => pickup.total));
    if (!Number.isSafeInteger(totalBirds) || !Number.isFinite(grandTotal)) {
      throw new Error('Pickup quantities and totals exceed the supported range.');
    }
    if (![totalBroiler, totalCulls, totalFeed].every(Number.isFinite)) {
      throw new Error('Pickup quantities and totals exceed the supported range.');
    }
    this.validateCapacity(vehicle, totalBirds);

    const now = new Date().toISOString();
    const firstPickup = vendorPickups[0];
    const tripRecord: Record<string, string | number> = {
      tripNumber: String(existingTrip?.['tripNumber'] ?? this.nextTripNumber(trips.records)),
      tripDate: input.tripDate,
      vehicleId: input.vehicleId,
      vehicleName: String(vehicle['vehicle'] ?? ''),
      vehicleType: String(vehicle['type'] ?? ''),
      driverId: input.driverId,
      driverName: String(driver['employee'] ?? ''),
      route: input.route.trim(),
      vendorId: firstPickup.vendorId,
      vendorName: firstPickup.vendorName,
      vendorIds: JSON.stringify(vendorPickups.map((pickup) => pickup.vendorId)),
      vendorNames: vendorPickups.map((pickup) => pickup.vendorName).join(', '),
      vendorCount: vendorPickups.length,
      vendorPickups: JSON.stringify(vendorPickups),
      location: String(vehicle['location'] ?? ''),
      broilerQuantity: totalBroiler,
      broilerRate: firstPickup.broiler.rate,
      broilerTotal: this.sum(vendorPickups.map((pickup) => pickup.broiler.total)),
      cullsQuantity: totalCulls,
      cullsRate: firstPickup.culls.rate,
      cullsTotal: this.sum(vendorPickups.map((pickup) => pickup.culls.total)),
      feedQuantity: totalFeed,
      feedUnit,
      feedRate: firstPickup.feed.rate,
      feedTotal: this.sum(vendorPickups.map((pickup) => pickup.feed.total)),
      totalBroiler,
      totalCulls,
      totalFeed,
      totalBirds,
      grandTotal,
      status: String(existingTrip?.['status'] ?? 'Assigned'),
      createdBy: String(existingTrip?.['createdBy'] ?? updatedBy),
      createdAt: String(existingTrip?.['createdAt'] ?? now),
      updatedBy,
      updatedAt: now
    };
    return tripId
      ? firstValueFrom(this.directories.updateRecord('trips', tripId, { ...existingTrip, ...tripRecord }))
      : firstValueFrom(this.directories.createRecord('trips', tripRecord));
  }

  private validateTripInput(input: CreateTripInput): void {
    if (!isValidDateOnly(input.tripDate)) {
      throw new Error('Enter a valid trip date.');
    }
    const route = typeof input.route === 'string' ? input.route.trim() : '';
    if (!route || route.length > 120) {
      throw new Error('Enter a route name of 120 characters or fewer.');
    }
  }

  private validatePickup(pickup: VendorPickupInput, feedUnit: string, vendorName: string): ValidatedVendorPickup {
    if (!pickup.broiler || !pickup.culls || !pickup.feed) {
      throw new Error(`Complete all pickup item details for ${vendorName}.`);
    }
    const broiler = this.validateLine(pickup.broiler, 'Broiler', true);
    const culls = this.validateLine(pickup.culls, 'Culls', true);
    const feed = this.validateLine(pickup.feed, 'Feed', false);
    if (feedUnit.toLowerCase() === 'kg') {
      const cents = feed.quantity * 100;
      if (!Number.isFinite(cents) || Math.abs(cents - Math.round(cents)) > 1e-8) {
        throw new Error('Feed quantity in kilograms must use no more than two decimal places.');
      }
    }
    if (broiler.quantity + culls.quantity + feed.quantity <= 0) {
      throw new Error(`Enter a pickup quantity for ${vendorName}.`);
    }
    return {
      vendorId: pickup.vendorId,
      vendorName,
      broiler,
      culls,
      feed,
      total: broiler.total + culls.total + feed.total
    };
  }

  private validateLine(line: TripLineInput, label: string, whole: boolean): ValidatedPickupLine {
    if (!line || typeof line !== 'object') {
      throw new Error(`Enter valid ${label.toLowerCase()} quantities and rates.`);
    }
    const quantity = this.quantity(line.quantity, `${label} quantity`, whole);
    const rate = this.rate(line.rate, `${label} rate`);
    return { quantity, rate, total: this.lineTotal(quantity, rate, label) };
  }

  private validateCapacity(vehicle: TripRecord, birds: number): void {
    const birdCapacity = vehicle['birdCapacity'];
    const capacityValue = birdCapacity === undefined || birdCapacity === ''
      ? vehicle['capacityBirds']
      : birdCapacity;
    if (capacityValue === undefined || capacityValue === '') return;
    const capacity = Number(capacityValue);
    if (Number.isFinite(capacity) && capacity >= 0 && birds > capacity) {
      throw new Error(`Total birds (${birds}) exceed this vehicle's capacity of ${capacity}.`);
    }
  }

  private quantity(value: number | null, label: string, whole: boolean): number {
    const quantity = value ?? 0;
    if (!Number.isFinite(quantity) || quantity < 0 ||
      (whole && (!Number.isSafeInteger(quantity) || !Number.isInteger(quantity)))) {
      throw new Error(`${label} must be a non-negative ${whole ? 'whole number' : 'number'}.`);
    }
    return quantity;
  }

  private rate(value: number | null, label: string): number {
    const rate = value ?? 0;
    const cents = rate * 100;
    if (!Number.isFinite(rate) || rate < 0 || !Number.isFinite(cents) ||
      Math.abs(cents - Math.round(cents)) > 1e-8) {
      throw new Error(`${label} must be a non-negative amount with no more than two decimal places.`);
    }
    return rate;
  }

  private lineTotal(quantity: number | null, rate: number | null, label: string): number {
    const rawTotal = this.quantity(quantity, `${label} quantity`, label !== 'Feed') *
      this.rate(rate, `${label} rate`);
    if (!Number.isFinite(rawTotal)) throw new Error(`${label} total is outside the supported range.`);
    const total = Math.round(rawTotal * 100) / 100;
    if (!Number.isFinite(total)) throw new Error(`${label} total is outside the supported range.`);
    return total;
  }

  private sum(values: number[]): number {
    const total = values.reduce((sum, value) => sum + value, 0);
    if (!Number.isFinite(total)) throw new Error('Pickup quantities and totals exceed the supported range.');
    return Math.round(total * 100) / 100;
  }

  private nextTripNumber(trips: TripRecord[]): string {
    const highest = trips.reduce((max, trip) => {
      const match = String(trip['tripNumber'] ?? '').match(/^TR-(\d+)$/i);
      const number = match ? Number(match[1]) : 0;
      return Number.isSafeInteger(number) ? Math.max(max, number) : max;
    }, 0);
    return `TR-${String(highest + 1).padStart(4, '0')}`;
  }

  private readVendorPickups(trip: TripRecord): TripVendorPickup[] {
    const stored = trip['vendorPickups'];
    if (typeof stored === 'string' && stored) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(stored);
      } catch {
        throw new Error('The saved vendor pickup details are invalid. Contact an administrator.');
      }
      if (!Array.isArray(parsed) || !parsed.every((pickup) => this.isTripVendorPickup(pickup))) {
        throw new Error('The saved vendor pickup details are incomplete. Contact an administrator.');
      }
      return parsed;
    }

    if (typeof trip['vendorId'] === 'string' && trip['vendorId']) {
      const quantity = (key: string): number => Number(trip[key] ?? 0);
      const rate = (key: string): number => Number(trip[key] ?? 0);
      const total = (key: string, quantityKey: string, rateKey: string): number =>
        Number(trip[key] ?? quantity(quantityKey) * rate(rateKey));
      const broiler = {
        quantity: quantity('broilerQuantity'),
        rate: rate('broilerRate'),
        total: total('broilerTotal', 'broilerQuantity', 'broilerRate')
      };
      const culls = {
        quantity: quantity('cullsQuantity'),
        rate: rate('cullsRate'),
        total: total('cullsTotal', 'cullsQuantity', 'cullsRate')
      };
      const feed = {
        quantity: quantity('feedQuantity'),
        rate: rate('feedRate'),
        total: total('feedTotal', 'feedQuantity', 'feedRate')
      };
      return [{
        vendorId: String(trip['vendorId']),
        vendorName: String(trip['vendorName'] ?? 'Vendor'),
        broiler,
        culls,
        feed,
        total: broiler.total + culls.total + feed.total
      }];
    }
    return [];
  }

  private isTripVendorPickup(value: unknown): value is TripVendorPickup {
    if (!value || typeof value !== 'object') return false;
    const pickup = value as Record<string, unknown>;
    const validLine = (line: unknown): boolean => {
      if (!line || typeof line !== 'object') return false;
      const item = line as Record<string, unknown>;
      return ['quantity', 'rate', 'total'].every((key) =>
        typeof item[key] === 'number' && Number.isFinite(item[key]) && Number(item[key]) >= 0
      );
    };
    return typeof pickup['vendorId'] === 'string' &&
      typeof pickup['vendorName'] === 'string' &&
      validLine(pickup['broiler']) &&
      validLine(pickup['culls']) &&
      validLine(pickup['feed']) &&
      typeof pickup['total'] === 'number' &&
      Number.isFinite(pickup['total']) &&
      pickup['total'] >= 0;
  }

  private isDriver(employee: TripRecord): boolean {
    return String(employee['department'] ?? '').trim().toLowerCase() === 'driver' ||
      String(employee['designation'] ?? '').trim().toLowerCase() === 'driver';
  }
}

interface ValidatedPickupLine {
  quantity: number;
  rate: number;
  total: number;
}

interface ValidatedVendorPickup {
  vendorId: string;
  vendorName: string;
  broiler: ValidatedPickupLine;
  culls: ValidatedPickupLine;
  feed: ValidatedPickupLine;
  total: number;
}

export function summarizeTrip(input: CreateTripInput): TripSummary {
  const pickups = Array.isArray(input.vendorPickups) ? input.vendorPickups : [];
  const safeValue = (value: number | null): number =>
    value !== null && Number.isFinite(value) && value >= 0 ? value : 0;
  const broiler = pickups.reduce((sum, pickup) => sum + safeValue(pickup.broiler.quantity), 0);
  const culls = pickups.reduce((sum, pickup) => sum + safeValue(pickup.culls.quantity), 0);
  const feed = pickups.reduce((sum, pickup) => sum + safeValue(pickup.feed.quantity), 0);
  const birds = broiler + culls;
  const lineTotal = (quantity: number, rate: number): number => {
    const amount = quantity * rate;
    const rounded = Math.round(amount * 100) / 100;
    return Number.isFinite(rounded) ? rounded : 0;
  };
  const grandTotal = pickups.reduce((sum, pickup) =>
    sum + lineTotal(safeValue(pickup.broiler.quantity), safeValue(pickup.broiler.rate)) +
      lineTotal(safeValue(pickup.culls.quantity), safeValue(pickup.culls.rate)) +
      lineTotal(safeValue(pickup.feed.quantity), safeValue(pickup.feed.rate)), 0);
  return {
    vendors: new Set(pickups.map((pickup) => pickup.vendorId).filter(Boolean)).size,
    broiler,
    culls,
    feed,
    birds: Number.isFinite(birds) ? birds : 0,
    grandTotal: Number.isFinite(grandTotal) ? grandTotal : 0
  };
}
