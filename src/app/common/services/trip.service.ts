import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  CreateTripInput,
  TripLineInput,
  TripRecord,
  TripSummary,
  TripVendorPickup,
  VendorDeliveryInput,
  VendorPickupInput
} from '../models/trip.model';
import { DirectoryService } from './directory.service';
import { RolePermissionService } from './role-permission.service';
import { SessionAuthService } from './session-auth.service';

function isValidDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function newestTripFirst(left: TripRecord, right: TripRecord): number {
  return String(right['tripDate'] ?? '').localeCompare(String(left['tripDate'] ?? '')) ||
    String(right['createdAt'] ?? '').localeCompare(String(left['createdAt'] ?? ''));
}

@Injectable({ providedIn: 'root' })
export class TripService {
  constructor(
    private readonly directories: DirectoryService,
    private readonly rolePermissions: RolePermissionService,
    private readonly auth: SessionAuthService
  ) {}

  async getTrips(): Promise<TripRecord[]> {
    const response = await firstValueFrom(this.directories.getDirectory('trips'));
    return response.records.filter((record) => this.rolePermissions.canAccessRecord('trips', record)).sort(newestTripFirst);
  }

  async getTripDetails(id: string): Promise<{ trip: TripRecord; vendorPickups: TripVendorPickup[]; supplierReceipts: TripRecord[]; vendorDestinations: TripRecord[]; deliveryEntries: TripRecord[] }> {
    const trips = await this.getTrips();
    const trip = trips.find((record) => String(record['_demoId'] ?? '') === id && record['status'] !== 'Deleted');
    if (!trip) throw new Error('This trip could not be found or you do not have access to it.');
    const vendorPickups = this.readVendorPickups(trip);
    const vendorDestinations = this.readVendorDestinations(trip);
    const destinationIds = new Set(vendorDestinations.map((destination) => String(destination['vendorDestinationId'])));
    const [deliveryResponse, pickupResponse] = await Promise.all([
      firstValueFrom(this.directories.getDirectory('trip-deliveries')),
      firstValueFrom(this.directories.getDirectory('trip-pickups'))
    ]);
    const deliveryEntries = deliveryResponse.records.filter((record) => String(record['tripId'] ?? '') === id && destinationIds.has(String(record['vendorDestinationId'] ?? '')));
    const supplierIds = new Set(vendorPickups.map((pickup) => pickup.vendorId));
    const supplierReceipts = pickupResponse.records.filter((record) => String(record['tripId'] ?? '') === id && supplierIds.has(String(record['vendorId'] ?? '')));
    return { trip, vendorPickups, supplierReceipts, vendorDestinations, deliveryEntries };
  }

  async softDeleteTrip(id: string): Promise<void> {
    if (!this.rolePermissions.can('trips', 'delete')) throw new Error('You do not have permission to delete trips.');
    const trip = (await this.getTrips()).find((record) => String(record['_demoId'] ?? '') === id);
    if (!trip) throw new Error('This trip could not be found or you do not have access to it.');
    if (trip['status'] === 'Deleted') throw new Error('This trip has already been deleted.');
    if (trip['status'] !== 'Assigned') throw new Error('Only trips that have not started can be deleted.');
    const resources = ['trip-deliveries', 'trip-pickups', 'trip-mortality', 'trip-payments'];
    const records = await Promise.all(resources.map((resource) => firstValueFrom(this.directories.getDirectory(resource))));
    if (records.some((response) => response.records.some((record) => String(record['tripId'] ?? '') === id))) {
      throw new Error('This trip already has operational records and cannot be deleted.');
    }
    await firstValueFrom(this.directories.updateRecord('trips', id, {
      ...trip, status: 'Deleted', deletedAt: new Date().toISOString(), deletedBy: this.auth.currentUser?.name ?? ''
    }));
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
    const [vehicles, employees, suppliers, products, trips, vendorDestinations, users] = await Promise.all([
      this.directories.getDirectory('vehicles'),
      this.directories.getDirectory('employees'),
      this.directories.getDirectory('suppliers'),
      this.directories.getDirectory('products'),
      this.directories.getDirectory('trips'),
      this.directories.getDirectory('vendor-destinations'),
      this.directories.getDirectory('users-roles')
    ].map((request) => firstValueFrom(request)));
    const existingTrip = tripId
      ? trips.records.find((record) => String(record['_demoId'] ?? '') === tripId)
      : undefined;
    if (tripId && (!existingTrip || !this.rolePermissions.canAccessRecord('trips', existingTrip))) {
      throw new Error('This trip could not be found or you do not have access to it.');
    }
    if (existingTrip && String(existingTrip['status'] ?? '') !== 'Assigned') {
      throw new Error('Trip assignments are locked after the trip leaves Assigned status.');
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
      throw new Error('Add at least one supplier pickup.');
    }
    if (!input.vendorPickups.every((pickup) =>
      pickup !== null && typeof pickup === 'object' && typeof pickup.vendorId === 'string'
    )) {
      throw new Error('Each supplier pickup must have a valid supplier and item details.');
    }
    const vendorIds = input.vendorPickups.map((pickup) => String(pickup.vendorId ?? '').trim());
    if (vendorIds.some((id) => !id)) throw new Error('Select a supplier for each pickup.');
    if (new Set(vendorIds).size !== vendorIds.length) {
      throw new Error('Select each vendor only once per trip.');
    }
    const vendorPickups = input.vendorPickups.map((pickup, index) => {
      const vendor = suppliers.records.find((record) => String(record['_demoId'] ?? '') === vendorIds[index]);
      if (!vendor || !this.rolePermissions.canAccessRecord('suppliers', vendor) ||
        String(vendor['status'] ?? '').toLowerCase() !== 'active') {
      throw new Error('Choose active suppliers you are allowed to use.');
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

    const vendorDeliveries = this.validateVendorDeliveries(input.vendorDeliveries ?? [], vendorDestinations.records, feedUnit);
    const supervisorEmail = String(input.supervisorEmail ?? existingTrip?.['supervisorEmail'] ?? '').trim().toLowerCase();
    if (supervisorEmail) {
      const supervisor = users.records.find((record) => String(record['email'] ?? '').trim().toLowerCase() === supervisorEmail);
      if (!supervisor || String(supervisor['status'] ?? '').toLowerCase() !== 'active' ||
        !['farm supervisor', 'supervisor'].includes(String(supervisor['role'] ?? '').toLowerCase())) {
        throw new Error('Choose an active Supervisor user.');
      }
    }

    const now = new Date().toISOString();
    const firstPickup = vendorPickups[0];
    const tripRecord: Record<string, string | number> = {
      tripNumber: String(existingTrip?.['tripNumber'] ?? this.nextTripNumber(trips.records)),
      tripDate: input.tripDate,
      vehicleId: input.vehicleId,
      vehicleName: String(vehicle['vehicle'] ?? ''),
      vehicleType: String(vehicle['type'] ?? ''),
      vehicleCapacityKg: Number(vehicle['capacityKg'] ?? 0),
      driverId: input.driverId,
      driverName: String(driver['employee'] ?? ''),
      route: input.route.trim(),
      supervisorEmail,
      supervisorName: String(users.records.find((record) => String(record['email'] ?? '').trim().toLowerCase() === supervisorEmail)?.['name'] ?? ''),
      vendorDeliveries: JSON.stringify(vendorDeliveries),
      deliveryVendorNames: vendorDeliveries.map((stop) => String(stop['vendorName'] ?? '')).join(', '),
      deliveryGrandTotal: vendorDeliveries.reduce((sum, stop) => sum + Number(stop['deliveryTotal'] ?? 0), 0),
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

  async getAssignedTrips(): Promise<TripRecord[]> {
    const email = this.auth.currentUser?.email.toLowerCase();
    const role = this.auth.currentUser?.role ?? '';
    if (!email || (!['farm supervisor', 'supervisor', 'sales manager'].includes(role.toLowerCase()) && role !== 'Organization Admin')) {
      throw new Error('Trip delivery entry is available to assigned Supervisors, Sales Managers, and Organization Admins.');
    }
    const response = await firstValueFrom(this.directories.getDirectory('trips'));
    const activeTrips = response.records.filter((trip) => trip['status'] !== 'Deleted');
    if (role === 'Organization Admin') return activeTrips.sort(newestTripFirst);
    if (role.toLowerCase() === 'sales manager') {
      return activeTrips.filter((trip) => this.rolePermissions.canAccessRecord('trips', trip)).sort(newestTripFirst);
    }
    return activeTrips.filter((trip) => String(trip['supervisorEmail'] ?? '').toLowerCase() === email).sort(newestTripFirst);
  }

  async getDeliveryData(tripId: string): Promise<{ trip: TripRecord; supplierPickups: TripVendorPickup[]; supplierReceipts: TripRecord[]; destinations: TripRecord[]; deliveries: TripRecord[]; payments: TripRecord[]; mortality?: TripRecord; loadedBroiler: number; loadedCulls: number; loadedBirds: number }> {
    const trips = await this.getAssignedTrips();
    const trip = trips.find((item) => String(item['_demoId'] ?? '') === tripId && item['status'] !== 'Deleted');
    if (!trip) throw new Error('This trip is not assigned to your account.');
    const [deliveryResponse, mortalityResponse, paymentResponse, pickupResponse] = await Promise.all([
      firstValueFrom(this.directories.getDirectory('trip-deliveries')),
      firstValueFrom(this.directories.getDirectory('trip-mortality')),
      firstValueFrom(this.directories.getDirectory('trip-payments')),
      firstValueFrom(this.directories.getDirectory('trip-pickups'))
    ]);
    const supplierPickups = this.readVendorPickups(trip);
    const supplierIds = new Set(supplierPickups.map((pickup) => pickup.vendorId));
    const supplierReceipts = pickupResponse.records.filter((record) => String(record['tripId'] ?? '') === tripId && supplierIds.has(String(record['vendorId'] ?? '')));
    const loadedBroiler = supplierReceipts.reduce((sum, pickup) => sum + Number(pickup['broilerQuantity'] ?? 0), 0);
    const loadedCulls = supplierReceipts.reduce((sum, pickup) => sum + Number(pickup['cullsQuantity'] ?? 0), 0);
    const loadedBirds = loadedBroiler + loadedCulls;
    const destinations = this.readVendorDestinations(trip);
    const destinationIds = new Set(destinations.map((destination) => String(destination['vendorDestinationId'] ?? '')));
    const deliveries = deliveryResponse.records.filter((record) =>
      String(record['tripId'] ?? '') === tripId && destinationIds.has(String(record['vendorDestinationId'] ?? ''))
    );
    const payments = paymentResponse.records.filter((record) =>
      String(record['tripId'] ?? '') === tripId && destinationIds.has(String(record['vendorDestinationId'] ?? ''))
    );
    const mortality = mortalityResponse.records.find((record) => String(record['tripId'] ?? '') === tripId);
    return { trip, supplierPickups, supplierReceipts, destinations, deliveries, payments, mortality, loadedBroiler, loadedCulls, loadedBirds };
  }

  async saveSupplierPickup(tripId: string, vendorId: string, input: { broiler: number; broilerWeight: number; culls: number; cullsWeight: number; feed: number; feedWeight: number; reason: string }): Promise<void> {
    const data = await this.getDeliveryData(tripId);
    if (String(data.trip['status']) === 'Completed') throw new Error('Completed trip records are read-only.');
    const planned = data.supplierPickups.find((pickup) => pickup.vendorId === vendorId);
    if (!planned) throw new Error('This supplier is not assigned to the trip.');
    if (input.broiler <= 0 || input.broilerWeight <= 0) throw new Error('Actual broiler quantity and weight are required.');
    const feedUnit = String(data.trip['feedUnit'] ?? '');
    const actual = this.validatePickup({ vendorId, broiler: { quantity: input.broiler, weight: input.broilerWeight, rate: planned.broiler.rate },
      culls: { quantity: input.culls, weight: input.cullsWeight, rate: planned.culls.rate },
      feed: { quantity: input.feed, weight: input.feedWeight, rate: planned.feed.rate } }, feedUnit, planned.vendorName);
    const record: TripRecord = { tripId, vendorId, vendorName: planned.vendorName,
      broilerQuantity: actual.broiler.quantity, broilerWeight: actual.broiler.weight, broilerRate: actual.broiler.rate, broilerTotal: actual.broiler.total,
      cullsQuantity: actual.culls.quantity, cullsWeight: actual.culls.weight, cullsRate: actual.culls.rate, cullsTotal: actual.culls.total,
      feedQuantity: actual.feed.quantity, feedWeight: actual.feed.weight, feedRate: actual.feed.rate, feedTotal: actual.feed.total,
      total: actual.total, reason: input.reason.trim(), receivedAt: new Date().toISOString(), receivedBy: this.auth.currentUser?.name ?? '' };
    const existing = data.supplierReceipts.find((receipt) => String(receipt['vendorId'] ?? '') === vendorId);
    if (existing) await firstValueFrom(this.directories.updateRecord('trip-pickups', String(existing['_demoId'] ?? ''), record));
    else await firstValueFrom(this.directories.createRecord('trip-pickups', record));
  }

  async saveVendorPayment(tripId: string, vendorDestinationId: string, amountReceived: number, paymentMethod: string): Promise<void> {
    const data = await this.getDeliveryData(tripId);
    const destination = data.destinations.find((item) => String(item['vendorDestinationId']) === vendorDestinationId);
    if (!destination) throw new Error('This vendor destination is not assigned to the trip.');
    const delivered = data.deliveries.filter((item) => String(item['vendorDestinationId']) === vendorDestinationId);
    const deliveredBirds = delivered.reduce((sum, item) => sum + Number(item['broiler'] ?? 0) + Number(item['culls'] ?? 0), 0);
    const plannedBirds = Number(destination['orderedBroiler'] ?? 0) + Number(destination['orderedCulls'] ?? 0);
    if (!delivered.length || delivered[delivered.length - 1]['failedDelivery'] === 'true' || deliveredBirds < plannedBirds) {
      throw new Error('Record payment after this vendor delivery is complete.');
    }
    const amountInPaise = amountReceived * 100;
    if (!Number.isFinite(amountInPaise) || amountReceived <= 0 || Math.abs(amountInPaise - Math.round(amountInPaise)) > 1e-8) {
      throw new Error('Enter an amount received greater than zero with up to two decimal places.');
    }
    const method = paymentMethod.trim();
    if (!['Cash', 'UPI', 'Bank transfer', 'Cheque', 'Other'].includes(method)) throw new Error('Select a valid payment method.');
    const record: TripRecord = {
      tripId, vendorDestinationId, vendorName: String(destination['vendorName'] ?? ''), amountReceived,
      paymentMethod: method, receivedAt: new Date().toISOString(), receivedBy: this.auth.currentUser?.name ?? ''
    };
    await firstValueFrom(this.directories.createRecord('trip-payments', record));
  }

  async updateDeliveredDestination(tripId: string, vendorDestinationId: string, details: { vendorName: string; address: string; contact: string; phone: string }): Promise<void> {
    const data = await this.getDeliveryData(tripId);
    const email = this.auth.currentUser?.email.toLowerCase();
    if (!['farm supervisor', 'supervisor'].includes((this.auth.currentUser?.role ?? '').toLowerCase()) ||
      !email || String(data.trip['supervisorEmail'] ?? '').toLowerCase() !== email) {
      throw new Error('Only the assigned Supervisor can edit this vendor destination.');
    }
    const destination = data.destinations.find((item) => String(item['vendorDestinationId']) === vendorDestinationId);
    if (!destination) throw new Error('This vendor destination is not assigned to the trip.');
    const entries = data.deliveries.filter((item) => String(item['vendorDestinationId']) === vendorDestinationId);
    const planned = Number(destination['orderedBroiler'] ?? 0) + Number(destination['orderedCulls'] ?? 0);
    const delivered = entries.reduce((sum, item) => sum + Number(item['broiler'] ?? 0) + Number(item['culls'] ?? 0), 0);
    if (delivered !== planned || !entries.length || entries[entries.length - 1]['failedDelivery'] === 'true') {
      throw new Error('The destination can be edited only when its bird delivery balance is exactly zero.');
    }
    const vendorName = details.vendorName.trim();
    const address = details.address.trim();
    const contact = details.contact.trim();
    const phone = details.phone.trim();
    if (!vendorName || vendorName.length > 120 || address.length > 240 || contact.length > 120 || phone.length > 40) {
      throw new Error('Enter a vendor name and keep destination details within their length limits.');
    }
    const stops: unknown = JSON.parse(String(data.trip['vendorDeliveries'] ?? '[]'));
    if (!Array.isArray(stops)) throw new Error('Saved vendor delivery stops are invalid. Contact an administrator.');
    const updatedStops = stops.map((item) => item && typeof item === 'object' &&
      String((item as Record<string, unknown>)['vendorDestinationId'] ?? '') === vendorDestinationId
      ? { ...(item as Record<string, unknown>), vendorName, address, contact, phone }
      : item);
    await firstValueFrom(this.directories.updateRecord('trips', tripId, {
      ...data.trip,
      vendorDeliveries: JSON.stringify(updatedStops),
      deliveryVendorNames: updatedStops.map((item) => String((item as Record<string, unknown>)?.['vendorName'] ?? '')).filter(Boolean).join(', ')
    }));
  }

  async updateVendorPayment(tripId: string, vendorDestinationId: string, paymentId: string, amountReceived: number, paymentMethod: string): Promise<void> {
    const data = await this.getDeliveryData(tripId);
    const payment = data.payments.find((item) => String(item['_demoId'] ?? '') === paymentId && String(item['vendorDestinationId'] ?? '') === vendorDestinationId);
    if (!payment) throw new Error('This vendor payment could not be found.');
    const amountInPaise = amountReceived * 100;
    if (!Number.isFinite(amountInPaise) || amountReceived <= 0 || Math.abs(amountInPaise - Math.round(amountInPaise)) > 1e-8) {
      throw new Error('Enter an amount received greater than zero with up to two decimal places.');
    }
    const method = paymentMethod.trim();
    if (!['Cash', 'UPI', 'Bank transfer', 'Cheque', 'Other'].includes(method)) throw new Error('Select a valid payment method.');
    await firstValueFrom(this.directories.updateRecord('trip-payments', paymentId, { ...payment, amountReceived, paymentMethod: method, updatedAt: new Date().toISOString(), updatedBy: this.auth.currentUser?.name ?? '' }));
  }

  async saveDelivery(tripId: string, vendorDestinationId: string, input: { broiler: number; broilerWeight: number; culls: number; cullsWeight: number; feed: number; feedWeight: number; deliveredAt: string; remarks: string; reason: string; confirmed: boolean; failed: boolean; approveExcess: boolean }): Promise<void> {
    const data = await this.getDeliveryData(tripId);
    if (data.supplierPickups.some((pickup) => !data.supplierReceipts.some((receipt) => String(receipt['vendorId'] ?? '') === pickup.vendorId))) throw new Error('Record actual receipts for every supplier before entering vendor deliveries.');
    if (!['In transit', 'Delivery in progress'].includes(String(data.trip['status']))) throw new Error('This trip is not open for delivery entry.');
    const destination = data.destinations.find((item) => String(item['vendorDestinationId']) === vendorDestinationId);
    if (!destination) throw new Error('This delivery vendor is not assigned to the trip.');
    const prior = data.deliveries.filter((item) => String(item['vendorDestinationId']) === vendorDestinationId);
    const validQuantity = (n: number) => Number.isSafeInteger(n) && n >= 0;
    if (!validQuantity(input.broiler) || !validQuantity(input.culls) || (!input.failed && input.broiler + input.culls <= 0)) throw new Error('Enter at least one positive whole bird quantity.');
    const broilerWeight = this.weight(input.broilerWeight, 'Broiler delivered weight');
    const cullsWeight = this.weight(input.cullsWeight, 'Culls delivered weight');
    const feedUnit = String(data.trip['feedUnit'] ?? '');
    const feed = this.quantity(input.feed, 'Feed delivered quantity', feedUnit.toLowerCase() !== 'kg');
    const feedWeight = this.weight(input.feedWeight, 'Feed delivered weight');
    if (feedUnit.toLowerCase() === 'kg' && Math.abs(feed * 100 - Math.round(feed * 100)) > 1e-8) throw new Error('Feed quantity in kilograms must use no more than two decimal places.');
    if ((feed > 0 && feedWeight <= 0) || (feed === 0 && feedWeight > 0)) throw new Error('Enter feed weight for a positive feed quantity.');
    if ((input.broiler > 0 && broilerWeight <= 0) || (input.culls > 0 && cullsWeight <= 0) ||
      (input.broiler === 0 && broilerWeight > 0) || (input.culls === 0 && cullsWeight > 0)) {
      throw new Error('Enter a positive weight for each delivered bird type and leave weight blank when quantity is zero.');
    }
    if (input.failed && (input.broiler + input.culls !== 0 || broilerWeight + cullsWeight + feedWeight !== 0 || feed !== 0)) throw new Error('A failed delivery must record zero quantities and zero weights.');
    const cumulativeBroiler = prior.reduce((sum, item) => sum + Number(item['broiler'] ?? 0), 0) + input.broiler;
    const cumulativeCulls = prior.reduce((sum, item) => sum + Number(item['culls'] ?? 0), 0) + input.culls;
    const orderedBroiler = Number(destination['orderedBroiler'] ?? 0);
    const orderedCulls = Number(destination['orderedCulls'] ?? 0);
    const plannedTotal = orderedBroiler + orderedCulls;
    const deliveredTotal = cumulativeBroiler + cumulativeCulls;
    const shortage = deliveredTotal < plannedTotal;
    const excess = deliveredTotal > plannedTotal;
    if ((shortage || excess || input.failed) && !input.reason.trim()) throw new Error('Add a reason for the shortage, excess, or failed delivery.');
    if (excess && (!this.rolePermissions.can('trips', 'approve') || !input.approveExcess)) {
      throw new Error('Excess delivery requires explicit approval from an Organization Admin.');
    }
    if (!input.failed && !input.confirmed) throw new Error('Confirm the delivered quantities with the receiving vendor before saving.');
    const broilerRate = Number(destination['broilerRate'] ?? 0);
    const cullsRate = Number(destination['cullsRate'] ?? 0);
    const feedRate = Number(destination['feedRate'] ?? 0);
    const broilerTotal = this.lineTotal(broilerWeight, broilerRate, 'Broiler delivery');
    const cullsTotal = this.lineTotal(cullsWeight, cullsRate, 'Culls delivery');
    const feedTotal = this.lineTotal(feedWeight, feedRate, 'Feed delivery');
    const entry: TripRecord = { tripId, vendorDestinationId, vendorName: String(destination['vendorName'] ?? ''), broiler: input.broiler, broilerWeight, broilerRate, broilerTotal, culls: input.culls, cullsWeight, cullsRate, cullsTotal, feed, feedWeight, feedRate, feedTotal,
      deliveryTotal: broilerTotal + cullsTotal + feedTotal,
      deliveredAt: input.deliveredAt, remarks: input.remarks, reason: input.reason, failedDelivery: input.failed ? 'true' : 'false', confirmed: input.confirmed ? 'true' : 'false', recordedBy: this.auth.currentUser?.name ?? '',
      approvedException: excess ? 'true' : 'false', approvedBy: excess ? this.auth.currentUser?.name ?? '' : '',
      idempotencyKey: `${tripId}:${vendorDestinationId}:${input.deliveredAt}:${input.broiler}:${broilerWeight}:${input.culls}:${cullsWeight}:${feed}:${feedWeight}` };
    if (data.deliveries.some((item) => item['idempotencyKey'] === entry['idempotencyKey'])) throw new Error('This delivery entry has already been saved.');
    await firstValueFrom(this.directories.createRecord('trip-deliveries', entry));
    if (String(data.trip['status']) === 'In transit') await firstValueFrom(this.directories.updateRecord('trips', tripId, { ...data.trip, status: 'Delivery in progress' }));
  }

  async startAssignedTrip(tripId: string): Promise<void> {
    const data = await this.getDeliveryData(tripId);
    if (String(data.trip['status']) !== 'Assigned') throw new Error('Only an assigned trip can be started.');
    await firstValueFrom(this.directories.updateRecord('trips', tripId, {
      ...data.trip, status: 'In transit', dispatchAt: new Date().toISOString(), dispatchConfirmedBy: this.auth.currentUser?.name ?? ''
    }));
  }

  async saveTripMortality(tripId: string, quantity: number, recordedAt: string, remarks: string): Promise<void> {
    const data = await this.getDeliveryData(tripId);
    if (String(data.trip['status']) === 'Completed') throw new Error('Completed trip records are read-only.');
    if (data.supplierPickups.some((pickup) => !data.supplierReceipts.some((receipt) => String(receipt['vendorId'] ?? '') === pickup.vendorId))) throw new Error('Record actual receipts for every supplier before entering mortality.');
    if (!Number.isSafeInteger(quantity) || quantity < 0) throw new Error('Mortality must be a non-negative whole number.');
    const birdsLoaded = data.loadedBirds;
    const birdsDelivered = data.deliveries.reduce((sum, item) => sum + Number(item['broiler'] ?? 0) + Number(item['culls'] ?? 0), 0);
    if (quantity > birdsLoaded - birdsDelivered) throw new Error('Mortality cannot exceed the remaining loaded bird quantity.');
    const history: Record<string, string | number>[] = data.mortality
      ? (() => { try { const parsed: unknown = JSON.parse(String(data.mortality?.['changeHistory'] ?? '[]')); return Array.isArray(parsed) ? parsed as Record<string, string | number>[] : []; } catch { return []; } })()
      : [];
    if (data.mortality) history.push({ quantity: Number(data.mortality['quantity'] ?? 0), recordedAt: String(data.mortality['recordedAt'] ?? ''), remarks: String(data.mortality['remarks'] ?? ''), changedAt: new Date().toISOString(), changedBy: this.auth.currentUser?.name ?? '' });
    const record: TripRecord = { tripId, quantity, recordedAt, remarks, recordedBy: this.auth.currentUser?.name ?? '', changeHistory: JSON.stringify(history) };
    if (data.mortality) await firstValueFrom(this.directories.updateRecord('trip-mortality', String(data.mortality['_demoId']), record));
    else await firstValueFrom(this.directories.createRecord('trip-mortality', record));
  }

  async submitForReconciliation(tripId: string, approval: { approveDiscrepancy: boolean; reason: string }): Promise<'submitted' | 'completed'> {
    const data = await this.getDeliveryData(tripId);
    if (String(data.trip['status']) === 'Completed') throw new Error('This trip has already been completed.');
    if (!data.destinations.length) throw new Error('Assign at least one vendor destination before completion.');
    if (data.supplierPickups.some((pickup) => !data.supplierReceipts.some((receipt) => String(receipt['vendorId'] ?? '') === pickup.vendorId))) throw new Error('Record actual receipts for every supplier before submitting reconciliation.');
    if (!data.mortality) throw new Error('Record trip mortality or explicitly confirm zero.');
    if (data.destinations.some((destination) => !data.deliveries.some((item) => String(item['vendorDestinationId']) === String(destination['vendorDestinationId'])))) {
      throw new Error('Record a delivery or a failed-delivery entry for every vendor destination before submitting.');
    }
    const delivered = data.deliveries.reduce((sum, item) => sum + Number(item['broiler'] ?? 0) + Number(item['culls'] ?? 0), 0);
    const discrepancy = data.loadedBirds - delivered - Number(data.mortality['quantity'] ?? 0);
    const destinationFailure = data.destinations.some((destination) => {
      const entries = data.deliveries.filter((item) => String(item['vendorDestinationId']) === String(destination['vendorDestinationId']));
      return entries[entries.length - 1]['failedDelivery'] === 'true';
    });
    const hasDiscrepancy = destinationFailure || discrepancy !== 0;
    const now = new Date().toISOString();
    if (hasDiscrepancy && this.auth.currentUser?.role !== 'Organization Admin') {
      if (String(data.trip['status']) === 'Pending reconciliation') throw new Error('This trip is awaiting Organization Admin reconciliation approval.');
      await firstValueFrom(this.directories.updateRecord('trips', tripId, {
        ...data.trip, status: 'Pending reconciliation', reconciliationSubmittedAt: now,
        reconciliationSubmittedBy: this.auth.currentUser?.name ?? '', reconciliationDifference: discrepancy
      }));
      return 'submitted';
    }
    if (hasDiscrepancy && (!approval.approveDiscrepancy || !approval.reason.trim())) {
      throw new Error('Review the bird discrepancy, check the approval box, and enter an approval reason to complete this trip.');
    }
    await firstValueFrom(this.directories.updateRecord('trips', tripId, {
      ...data.trip, status: 'Completed', completedAt: now, completedBy: this.auth.currentUser?.name ?? '',
      reconciliationException: hasDiscrepancy ? 'true' : 'false',
      reconciliationReason: hasDiscrepancy ? approval.reason.trim() : '',
      reconciliationApprovedBy: hasDiscrepancy ? this.auth.currentUser?.name ?? '' : ''
    }));
    return 'completed';
  }

  private validateVendorDeliveries(input: VendorDeliveryInput[], destinations: TripRecord[], feedUnit: string): TripRecord[] {
    if (!Array.isArray(input) || input.length === 0) throw new Error('Add at least one delivery vendor stop.');
    const ids = input.map((stop) => String(stop?.vendorDestinationId ?? '').trim());
    if (ids.some((id) => !id) || new Set(ids).size !== ids.length) throw new Error('Select a different delivery vendor for each stop.');
    return input.map((stop, index) => {
      const vendor = destinations.find((item) => String(item['_demoId'] ?? '') === ids[index]);
      if (!vendor || String(vendor['status'] ?? '').toLowerCase() !== 'active') throw new Error('Choose active delivery vendors.');
      const broiler = stop.broilerQuantity ?? 0;
      const culls = stop.cullsQuantity ?? 0;
      const broilerWeight = this.weight(stop.broilerWeight === undefined ? broiler : stop.broilerWeight, 'Broiler weight');
      const cullsWeight = this.weight(stop.cullsWeight === undefined ? culls : stop.cullsWeight, 'Culls weight');
      const broilerRate = stop.broilerRate ?? 0;
      const cullsRate = stop.cullsRate ?? 0;
      const feed = this.quantity(stop.feedQuantity ?? 0, 'Feed quantity', feedUnit.toLowerCase() !== 'kg');
      const feedWeight = this.weight(stop.feedWeight ?? 0, 'Feed weight');
      const feedRate = this.rate(stop.feedRate ?? 0, 'Feed rate');
      if (feedUnit.toLowerCase() === 'kg' && Math.abs(feed * 100 - Math.round(feed * 100)) > 1e-8) throw new Error('Feed quantity in kilograms must use no more than two decimal places.');
      if (!Number.isSafeInteger(broiler) || broiler < 0 || !Number.isSafeInteger(culls) || culls < 0 || broiler + culls <= 0) {
        throw new Error(`Enter positive whole-bird quantities for ${vendor['name']}.`);
      }
      if (![broilerRate, cullsRate].every((rate) => Number.isFinite(rate) && rate >= 0 && Math.abs(rate * 100 - Math.round(rate * 100)) <= 1e-8)) {
        throw new Error(`Enter valid non-negative rates with up to two decimal places for ${vendor['name']}.`);
      }
      if ((broiler > 0 && broilerWeight <= 0) || (culls > 0 && cullsWeight <= 0) ||
        (broiler === 0 && broilerWeight > 0) || (culls === 0 && cullsWeight > 0) ||
        (feed > 0 && feedWeight <= 0) || (feed === 0 && feedWeight > 0)) {
        throw new Error(`Enter positive weights in kilograms for ${vendor['name']}.`);
      }
      const broilerTotal = this.lineTotal(broilerWeight, broilerRate, 'Broiler');
      const cullsTotal = this.lineTotal(cullsWeight, cullsRate, 'Culls');
      const feedTotal = this.lineTotal(feedWeight, feedRate, 'Feed');
      return {
        vendorDestinationId: ids[index], vendorName: String(vendor['name'] ?? ''),
        address: String(vendor['address'] ?? ''), contact: String(vendor['contact'] ?? ''), phone: String(vendor['phone'] ?? ''),
        orderedBroiler: broiler, orderedBroilerWeight: broilerWeight, broilerRate, broilerTotal,
        orderedCulls: culls, orderedCullsWeight: cullsWeight, cullsRate, cullsTotal,
        orderedFeed: feed, orderedFeedWeight: feedWeight, feedRate, feedTotal,
        deliveryTotal: broilerTotal + cullsTotal + feedTotal, routeSequence: index + 1
      };
    });
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
    const weight = this.weight(line.weight === undefined ? quantity : line.weight, `${label} weight`);
    if (quantity > 0 && weight <= 0) throw new Error(`${label} weight must be greater than zero.`);
    if (quantity === 0 && weight > 0) throw new Error(`${label} quantity is required for the entered weight.`);
    const rate = this.rate(line.rate, `${label} rate`);
    return { quantity, weight, rate, total: this.lineTotal(weight, rate, label) };
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

  private weight(value: number | null, label: string): number {
    const weight = this.quantity(value, label, false);
    const hundredths = weight * 100;
    if (!Number.isFinite(hundredths) || Math.abs(hundredths - Math.round(hundredths)) > 1e-8) {
      throw new Error(`${label} must use no more than two decimal places.`);
    }
    return weight;
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
    const rawTotal = this.weight(quantity, `${label} weight`) * this.rate(rate, `${label} rate`);
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

  private readVendorDestinations(trip: TripRecord): TripRecord[] {
    let stops: unknown;
    try { stops = JSON.parse(String(trip['vendorDeliveries'] ?? '[]')); }
    catch { throw new Error('Saved vendor delivery stops are invalid. Contact an administrator.'); }
    if (!Array.isArray(stops)) throw new Error('Saved vendor delivery stops are invalid. Contact an administrator.');
    return stops.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const stop = item as Record<string, unknown>;
      const id = String(stop['vendorDestinationId'] ?? '');
      if (!id) return [];
      return [{
        _demoId: id, vendorDestinationId: id, vendorName: String(stop['vendorName'] ?? ''),
        address: String(stop['address'] ?? ''), contact: String(stop['contact'] ?? ''), phone: String(stop['phone'] ?? ''),
        routeSequence: Number(stop['routeSequence'] ?? 0), orderedBroiler: Number(stop['orderedBroiler'] ?? 0),
        orderedBroilerWeight: stop['orderedBroilerWeight'] === undefined ? '—' : Number(stop['orderedBroilerWeight']),
        broilerRate: Number(stop['broilerRate'] ?? 0), broilerTotal: Number(stop['broilerTotal'] ?? 0),
        orderedCulls: Number(stop['orderedCulls'] ?? 0), cullsRate: Number(stop['cullsRate'] ?? 0),
        orderedCullsWeight: stop['orderedCullsWeight'] === undefined ? '—' : Number(stop['orderedCullsWeight']),
        cullsTotal: Number(stop['cullsTotal'] ?? 0), orderedFeed: Number(stop['orderedFeed'] ?? 0),
        orderedFeedWeight: stop['orderedFeedWeight'] === undefined ? '—' : Number(stop['orderedFeedWeight']),
        feedRate: Number(stop['feedRate'] ?? 0), feedTotal: Number(stop['feedTotal'] ?? 0),
        deliveryTotal: Number(stop['deliveryTotal'] ?? 0)
      }];
    });
  }

  private readVendorPickups(trip: TripRecord): TripVendorPickup[] {
    const stored = trip['vendorPickups'];
    if (typeof stored === 'string' && stored) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(stored);
      } catch {
        throw new Error('The saved supplier pickup details are invalid. Contact an administrator.');
      }
      if (!Array.isArray(parsed) || !parsed.every((pickup) => this.isTripVendorPickup(pickup))) {
        throw new Error('The saved supplier pickup details are incomplete. Contact an administrator.');
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
      const hasValidWeight = item['weight'] === undefined ||
        (typeof item['weight'] === 'number' && Number.isFinite(item['weight']) && Number(item['weight']) >= 0);
      return hasValidWeight && ['quantity', 'rate', 'total'].every((key) =>
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
  weight: number;
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
  const lineTotal = (weight: number, rate: number): number => {
    const amount = weight * rate;
    const rounded = Math.round(amount * 100) / 100;
    return Number.isFinite(rounded) ? rounded : 0;
  };
  const lineWeight = (line: TripLineInput): number => safeValue(line.weight === undefined ? line.quantity : line.weight);
  const grandTotal = pickups.reduce((sum, pickup) =>
    sum + lineTotal(lineWeight(pickup.broiler), safeValue(pickup.broiler.rate)) +
      lineTotal(lineWeight(pickup.culls), safeValue(pickup.culls.rate)) +
      lineTotal(lineWeight(pickup.feed), safeValue(pickup.feed.rate)), 0);
  return {
    vendors: new Set(pickups.map((pickup) => pickup.vendorId).filter(Boolean)).size,
    broiler,
    culls,
    feed,
    birds: Number.isFinite(birds) ? birds : 0,
    grandTotal: Number.isFinite(grandTotal) ? grandTotal : 0
  };
}
