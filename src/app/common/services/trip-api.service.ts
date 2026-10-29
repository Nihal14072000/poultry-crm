import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Employee } from '../models/directory.model';
import { CreateTripInput, TripRecord, TripVendorPickup } from '../models/trip.model';

type OrderKind = 'broiler' | 'culls' | 'feed';

interface ApiEntity extends Record<string, unknown> {
  id: number;
  name?: string;
  isActive?: boolean;
  isDeleted?: boolean;
}

interface ApiOrder extends Record<string, unknown> {
  orderTypeId: number;
  qty: number;
  weight: number;
  rate: number;
  total: number;
}

interface ApiParty extends ApiEntity {
  contact?: string;
  location?: string;
  order?: ApiOrder[];
}

interface ApiTrip extends Record<string, unknown> {
  tripId?: number;
  id?: number;
  vehicle?: ApiEntity;
  driver?: Employee;
  supervisor?: Employee;
  buyingParties?: ApiParty[];
  sellingParties?: ApiParty[];
  route?: string;
  date?: string;
  status?: string;
}

interface ApiDelivery extends Record<string, unknown> {
  id?: number;
  tripId?: number;
  supplierPickupId?: number;
  vendorDelieveryId?: number;
  mortalityId?: number;
  isActive?: boolean;
  isDeleted?: boolean;
}

interface ApiActualOrder extends ApiOrder {
  id?: number;
  isActive?: boolean;
  isDeleted?: boolean;
}

interface ApiSupplierPickup extends Record<string, unknown> {
  id?: number;
  buyingPartyId?: number;
  buyingParty?: ApiParty;
  actualOrders?: ApiActualOrder[];
  note?: string;
  isDeleted?: boolean;
}

interface ApiVendorDelivery extends Record<string, unknown> {
  id?: number;
  sellingParty?: ApiParty;
  sellingPartyId?: number;
  actualOrders?: ApiActualOrder[];
  note?: string;
  createDate?: string;
  isDeleted?: boolean;
}

interface ApiMortality extends Record<string, unknown> {
  id?: number;
  tripId?: number;
  combinedMortality?: number;
  reason?: string;
  createDate?: string;
  isDeleted?: boolean;
}

interface ApiDeliveryDetails extends ApiDelivery {
  supplierPickup?: ApiSupplierPickup;
  vendorDeliveries?: ApiVendorDelivery[];
}

export interface TripDeliveryData {
  trip: TripRecord;
  supplierPickups: TripVendorPickup[];
  supplierReceipts: TripRecord[];
  destinations: TripRecord[];
  deliveries: TripRecord[];
  mortality?: TripRecord;
  loadedBroiler: number;
  loadedCulls: number;
  loadedBirds: number;
}

export interface TripFormOptions {
  vehicles: TripRecord[];
  drivers: TripRecord[];
  suppliers: TripRecord[];
  supervisors: TripRecord[];
  deliveryVendors: TripRecord[];
  trips: TripRecord[];
  orderTypeIds: Record<OrderKind, number>;
}

export interface TripDetailsResponse {
  trip: TripRecord;
  vendorPickups: TripVendorPickup[];
  supplierReceipts: TripRecord[];
  vendorDestinations: TripRecord[];
  deliveryEntries: TripRecord[];
}

@Injectable({ providedIn: 'root' })
export class TripApiService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  async getFormOptions(): Promise<TripFormOptions> {
    const [vehicles, drivers, suppliers, supervisors, deliveryVendors, trips, orderTypes] = await Promise.all([
      firstValueFrom(this.http.get<ApiEntity[]>(`${this.baseUrl}/vehicles`)),
      firstValueFrom(this.http.get<Employee[]>(`${this.baseUrl}/drivers`)),
      firstValueFrom(this.http.get<ApiParty[]>(`${this.baseUrl}/buying-parties`)),
      firstValueFrom(this.http.get<Employee[]>(`${this.baseUrl}/supervisors`)),
      firstValueFrom(this.http.get<ApiParty[]>(`${this.baseUrl}/selling-parties`)),
      firstValueFrom(this.http.get<ApiTrip[]>(`${this.baseUrl}/trips`)),
      firstValueFrom(this.http.get<ApiEntity[]>(`${this.baseUrl}/order-types`))
    ]);
    const orderTypeIds = this.getOrderTypeIds(orderTypes);
    const vehicleById = new Map(vehicles.filter(this.isActive).map((vehicle) => [String(vehicle.id), vehicle]));
    const driverById = new Map(drivers.filter(this.isActive).map((driver) => [String(driver.id), driver]));
    return {
      vehicles: vehicles.filter(this.isActive).map((vehicle) => this.vehicleRecord(vehicle)),
      drivers: drivers.filter(this.isActive).map((driver) => this.driverRecord(driver)),
      suppliers: suppliers.filter(this.isActive).map((party) => this.partyRecord(party)),
      supervisors: supervisors.filter(this.isActive).map((supervisor) => this.supervisorRecord(supervisor)),
      deliveryVendors: deliveryVendors.filter(this.isActive).map((party) => this.partyRecord(party)),
      trips: trips.filter((trip) => !trip['isDeleted']).map((trip) => this.tripRecord(trip, vehicleById, driverById)),
      orderTypeIds
    };
  }

  async getTrips(): Promise<TripRecord[]> {
    const [trips, vehicles, drivers] = await Promise.all([
      firstValueFrom(this.http.get<ApiTrip[]>(`${this.baseUrl}/trips`)),
      firstValueFrom(this.http.get<ApiEntity[]>(`${this.baseUrl}/vehicles`)),
      firstValueFrom(this.http.get<Employee[]>(`${this.baseUrl}/drivers`))
    ]);
    const vehicleById = new Map(vehicles.map((vehicle) => [String(vehicle.id), vehicle]));
    const driverById = new Map(drivers.map((driver) => [String(driver.id), driver]));
    return trips.filter((trip) => !trip['isDeleted'])
      .map((trip) => this.tripRecord(trip, vehicleById, driverById))
      .sort((left, right) => String(right['tripDate'] ?? '').localeCompare(String(left['tripDate'] ?? '')));
  }

  async getTripDetails(id: string): Promise<TripDetailsResponse> {
    const tripId = this.parseId(id);
    const [response, orderTypes] = await Promise.all([
      firstValueFrom(this.http.get<ApiTrip>(`${this.baseUrl}/trips/${tripId}/retrieve`)),
      firstValueFrom(this.http.get<ApiEntity[]>(`${this.baseUrl}/order-types`))
    ]);
    const orderNames = this.getOrderTypeNames(orderTypes);
    const vendorPickups = (response.buyingParties ?? []).filter((party) => !party.isDeleted)
      .map((party) => this.mapPickup(party, orderNames));
    const vendorDestinations = (response.sellingParties ?? []).filter((party) => !party.isDeleted)
      .map((party, index) => ({ ...this.mapDestination(party, orderNames), routeSequence: index + 1 }));
    const trip = this.tripRecord(response, new Map(), new Map());
    trip['supervisorId'] = this.optionalEntityId(response.supervisor);
    trip['supervisorName'] = String(response.supervisor?.['name'] ?? '');
    trip['feedUnit'] = 'qty';
    trip['vendorCount'] = vendorPickups.length;
    trip['vendorNames'] = vendorPickups.map((pickup) => pickup.vendorName).join(', ');
    trip['vendorPickups'] = JSON.stringify(vendorPickups);
    trip['vendorDeliveries'] = JSON.stringify(vendorDestinations);
    trip['totalBroiler'] = vendorPickups.reduce((sum, pickup) => sum + pickup.broiler.quantity, 0);
    trip['totalCulls'] = vendorPickups.reduce((sum, pickup) => sum + pickup.culls.quantity, 0);
    trip['totalFeed'] = vendorPickups.reduce((sum, pickup) => sum + pickup.feed.quantity, 0);
    trip['totalBirds'] = Number(trip['totalBroiler']) + Number(trip['totalCulls']);
    trip['grandTotal'] = vendorPickups.reduce((sum, pickup) => sum + pickup.total, 0);
    return { trip, vendorPickups, supplierReceipts: [], vendorDestinations, deliveryEntries: [] };
  }

  async getDeliveryData(id: string, pendingSupplierPickupIds: string[] = [], pendingVendorDeliveryIds: string[] = []): Promise<TripDeliveryData> {
    const tripId = this.parseId(id);
    const [details, links, orderTypes] = await Promise.all([
      this.getTripDetails(id),
      firstValueFrom(this.http.get<ApiDelivery[]>(`${this.baseUrl}/deliveries`)),
      firstValueFrom(this.http.get<ApiEntity[]>(`${this.baseUrl}/order-types`))
    ]);
    const orderNames = this.getOrderTypeNames(orderTypes);
    const related = links.filter((delivery) => Number(delivery.tripId) === tripId && delivery.isDeleted !== true);
    const [deliveryDetails, mortalities] = await Promise.all([
      Promise.all(related.map((delivery) =>
        firstValueFrom(this.http.get<ApiDeliveryDetails>(`${this.baseUrl}/deliveries/${this.parseId(String(delivery.id))}/retrieve`))
      )),
      firstValueFrom(this.http.get<ApiMortality[]>(`${this.baseUrl}/mortalities`))
    ]);
    const linkedSupplierPickupIds = deliveryDetails
      .map((delivery) => delivery.supplierPickup?.id)
      .filter((pickupId): pickupId is number => Number.isSafeInteger(pickupId) && Number(pickupId) > 0);
    const supplierPickupIds = [...new Set([...linkedSupplierPickupIds, ...pendingSupplierPickupIds.map((pickupId) => this.parseId(pickupId))])];
    const actualPickups = await Promise.all(supplierPickupIds.map((pickupId) =>
      firstValueFrom(this.http.get<ApiSupplierPickup>(`${this.baseUrl}/supplier-pickups/${this.parseId(String(pickupId))}/retrieve`))
    ));
    const plannedSupplierIds = new Set(details.vendorPickups.map((pickup) => pickup.vendorId));
    for (const pickup of actualPickups) {
      if (!plannedSupplierIds.has(String(pickup.buyingParty?.id ?? pickup.buyingPartyId ?? ''))) {
        throw new Error('A saved supplier pickup does not belong to this trip.');
      }
    }
    const supplierReceipts = actualPickups
      .filter((pickup) => pickup.isDeleted !== true)
      .map((pickup) => this.actualPickupRecord(pickup, orderNames));
    const linkedVendorDeliveries = deliveryDetails.flatMap((delivery) => delivery.vendorDeliveries ?? []);
    const pendingVendorDeliveries = await Promise.all(pendingVendorDeliveryIds.map(async (deliveryId) => {
      const id = this.parseId(deliveryId);
      const [delivery, actualOrders] = await Promise.all([
        firstValueFrom(this.http.get<ApiVendorDelivery>(`${this.baseUrl}/vendor-deliveries/${id}`)),
        firstValueFrom(this.http.get<ApiActualOrder[]>(`${this.baseUrl}/vendor-deliveries/${id}/orders`))
      ]);
      return { ...delivery, actualOrders };
    }));
    const destinationsById = new Map(details.vendorDestinations.map((destination) =>
      [String(destination['vendorDestinationId']), destination] as const
    ));
    const deliveriesById = new Map<string, TripRecord>();
    for (const delivery of [...linkedVendorDeliveries, ...pendingVendorDeliveries]) {
      if (delivery.isDeleted === true) continue;
      const sellingPartyId = String(delivery.sellingParty?.id ?? delivery.sellingPartyId ?? '');
      const destination = destinationsById.get(sellingPartyId);
      if (!destination) {
        throw new Error('A saved vendor delivery does not belong to this trip.');
      }
      deliveriesById.set(String(delivery.id ?? ''), this.actualDeliveryRecord({
        ...delivery,
        sellingParty: delivery.sellingParty ?? { id: Number(sellingPartyId), name: String(destination['vendorName'] ?? '') }
      }, orderNames));
    }
    const deliveries = [...deliveriesById.values()];
    const mortalityRecord = mortalities.find((item) => Number(item.tripId) === tripId && item.isDeleted !== true);
    const mortality = mortalityRecord ? {
      _demoId: String(mortalityRecord.id ?? ''),
      quantity: Number(mortalityRecord.combinedMortality ?? 0),
      remarks: String(mortalityRecord.reason ?? ''),
      recordedAt: String(mortalityRecord.createDate ?? '')
    } : undefined;
    const loadedBroiler = supplierReceipts.reduce((sum, receipt) => sum + Number(receipt['broilerQuantity'] ?? 0), 0);
    const loadedCulls = supplierReceipts.reduce((sum, receipt) => sum + Number(receipt['cullsQuantity'] ?? 0), 0);
    return {
      trip: details.trip,
      supplierPickups: details.vendorPickups,
      supplierReceipts,
      destinations: details.vendorDestinations,
      deliveries,
      mortality,
      loadedBroiler,
      loadedCulls,
      loadedBirds: loadedBroiler + loadedCulls
    };
  }

  async saveSupplierPickup(
    vendorId: string,
    input: { broiler: number; broilerWeight: number; broilerRate: number; culls: number; cullsWeight: number; cullsRate: number; feed: number; feedWeight: number; feedRate: number; note: string },
    existingId?: string
  ): Promise<string> {
    const supplierId = this.parseId(vendorId);
    const orders = await this.actualOrders([
      { kind: 'broiler', quantity: input.broiler, weight: input.broilerWeight, rate: input.broilerRate },
      { kind: 'culls', quantity: input.culls, weight: input.cullsWeight, rate: input.cullsRate },
      { kind: 'feed', quantity: input.feed, weight: input.feedWeight, rate: input.feedRate }
    ]);
    const note = input.note.trim();
    let pickupId: number;
    if (existingId) {
      pickupId = this.parseId(existingId);
      await firstValueFrom(this.http.put(`${this.baseUrl}/supplier-pickups/${pickupId}`, {
        id: pickupId, buyingPartyId: supplierId, note, isActive: true, isDeleted: false
      }));
      await firstValueFrom(this.http.put(`${this.baseUrl}/supplier-pickups/${pickupId}/orders`, orders));
    } else {
      const pickup = await firstValueFrom(this.http.post<{ id: number }>(`${this.baseUrl}/supplier-pickups`, {
        buyingPartyId: supplierId, actualOrders: orders, note, isActive: true, isDeleted: false
      }));
      pickupId = this.parseId(String(pickup.id));
    }
    return String(pickupId);
  }

  async linkSupplierPickups(tripId: string, supplierPickupIds: string[]): Promise<void> {
    const trip = this.parseId(tripId);
    const existingLinks = await firstValueFrom(this.http.get<ApiDelivery[]>(`${this.baseUrl}/deliveries`));
    const linkedIds = new Set(existingLinks
      .filter((delivery) => Number(delivery.tripId) === trip && delivery.isDeleted !== true)
      .map((delivery) => Number(delivery.supplierPickupId))
      .filter((pickupId) => Number.isSafeInteger(pickupId) && pickupId > 0));
    for (const pickupId of new Set(supplierPickupIds.map((id) => this.parseId(id)))) {
      if (linkedIds.has(pickupId)) continue;
      await firstValueFrom(this.http.post(`${this.baseUrl}/deliveries`, {
        tripId: trip, supplierPickupId: pickupId, isActive: true, isDeleted: false
      }));
    }
  }

  async linkVendorDeliveries(tripId: string, vendorDeliveryIds: string[]): Promise<void> {
    const trip = this.parseId(tripId);
    const existingLinks = await firstValueFrom(this.http.get<ApiDelivery[]>(`${this.baseUrl}/deliveries`));
    const linkedIds = new Set(existingLinks
      .filter((delivery) => Number(delivery.tripId) === trip && delivery.isDeleted !== true)
      .map((delivery) => Number(delivery.vendorDelieveryId))
      .filter((deliveryId) => Number.isSafeInteger(deliveryId) && deliveryId > 0));
    for (const deliveryId of new Set(vendorDeliveryIds.map((id) => this.parseId(id)))) {
      if (linkedIds.has(deliveryId)) continue;
      await firstValueFrom(this.http.post(`${this.baseUrl}/deliveries`, {
        tripId: trip, vendorDelieveryId: deliveryId, isActive: true, isDeleted: false
      }));
    }
  }

  async saveVendorDelivery(
    vendorId: string,
    input: { broiler: number; broilerWeight: number; broilerRate: number; culls: number; cullsWeight: number; cullsRate: number; feed: number; feedWeight: number; feedRate: number; note: string }
  ): Promise<string> {
    const sellingPartyId = this.parseId(vendorId);
    const orders = await this.actualOrders([
      { kind: 'broiler', quantity: input.broiler, weight: input.broilerWeight, rate: input.broilerRate },
      { kind: 'culls', quantity: input.culls, weight: input.cullsWeight, rate: input.cullsRate },
      { kind: 'feed', quantity: input.feed, weight: input.feedWeight, rate: input.feedRate }
    ]);
    const vendorDelivery = await firstValueFrom(this.http.post<{ id: number }>(`${this.baseUrl}/vendor-deliveries`, {
      sellingPartyId, note: input.note.trim(), isActive: true, isDeleted: false
    }));
    const vendorDeliveryId = this.parseId(String(vendorDelivery.id));
    await firstValueFrom(this.http.put(`${this.baseUrl}/vendor-deliveries/${vendorDeliveryId}/orders`, orders));
    return String(vendorDeliveryId);
  }

  async saveMortality(tripId: string, quantity: number, reason: string, existingId?: string): Promise<void> {
    const mortality = {
      tripId: this.parseId(tripId),
      combinedMortality: quantity,
      reason: reason.trim(),
      isActive: true,
      isDeleted: false
    };
    if (existingId) {
      const id = this.parseId(existingId);
      await firstValueFrom(this.http.put(`${this.baseUrl}/mortalities/${id}`, { ...mortality, id }));
    } else {
      await firstValueFrom(this.http.post(`${this.baseUrl}/mortalities`, mortality));
    }
  }

  async updateTripStatus(id: string, status: string): Promise<void> {
    const tripId = this.parseId(id);
    const trip = await firstValueFrom(this.http.get<ApiTrip>(`${this.baseUrl}/trips/${tripId}`));
    await firstValueFrom(this.http.put(`${this.baseUrl}/trips/${tripId}`, { ...trip, tripId, status }));
  }

  async insertTrip(input: CreateTripInput, options: TripFormOptions): Promise<TripRecord> {
    const response = await firstValueFrom(this.http.post<ApiTrip>(`${this.baseUrl}/trips/insert`, this.toRequest(input, options)));
    return this.tripRecord(response, new Map(), new Map());
  }

  async updateTrip(id: string, input: CreateTripInput, options: TripFormOptions): Promise<TripRecord> {
    const tripId = this.parseId(id);
    const existing = await firstValueFrom(this.http.get<ApiTrip>(`${this.baseUrl}/trips/${tripId}`));
    if (existing.status !== 'Assigned') {
      throw new Error('Trip assignments are locked after the trip leaves Assigned status.');
    }
    const response = await firstValueFrom(this.http.put<ApiTrip>(
      `${this.baseUrl}/trips/${tripId}/update`,
      { ...this.toRequest(input, options, String(tripId)), tripId }
    ));
    return this.tripRecord(response, new Map(), new Map());
  }

  private toRequest(input: CreateTripInput, options: TripFormOptions, currentTripId?: string): Record<string, unknown> {
    if (!input.route.trim() || input.route.trim().length > 120 || !this.isValidDate(input.tripDate)) {
      throw new Error('Enter a valid trip date and route.');
    }
    const vehicle = this.selected(options.vehicles, input.vehicleId, 'vehicle');
    const driver = this.selected(options.drivers, input.driverId, 'driver');
    const supervisor = this.selected(options.supervisors, String(input.supervisorId ?? ''), 'supervisor');
    const activeTrips = (options.trips ?? []).filter((t) => {
      const isCurrent = !!currentTripId && (
        String(t['_demoId'] ?? '') === String(currentTripId) ||
        String(t['tripId'] ?? '') === String(currentTripId) ||
        String(t['tripNumber'] ?? '') === String(currentTripId)
      );
      if (isCurrent) return false;
      const status = String(t['status'] ?? '').toLowerCase();
      return status !== 'completed' && status !== 'deleted';
    });
    if (activeTrips.some((t) => String(t['driverId'] ?? '') === input.driverId)) {
      throw new Error('The selected driver is already assigned to an active trip.');
    }
    if (input.supervisorId && activeTrips.some((t) => String(t['supervisorId'] ?? '') === String(input.supervisorId))) {
      throw new Error('The selected supervisor is already assigned to an active trip.');
    }
    if (!Array.isArray(input.vendorPickups) || !input.vendorPickups.length) {
      throw new Error('Add at least one supplier pickup.');
    }
    const vendorIds = input.vendorPickups.map((pickup) => pickup.vendorId);
    if (new Set(vendorIds).size !== vendorIds.length) throw new Error('Select each supplier only once per trip.');
    const buyingParties = input.vendorPickups.map((pickup) => {
      const party = this.selected(options.suppliers, pickup.vendorId, 'supplier');
      return this.partyPayload(party, [
        this.createOrder(pickup.broiler.quantity, pickup.broiler.weight, pickup.broiler.rate, options.orderTypeIds.broiler),
        this.createOrder(pickup.culls.quantity, pickup.culls.weight, pickup.culls.rate, options.orderTypeIds.culls),
        this.createOrder(pickup.feed.quantity, pickup.feed.weight, pickup.feed.rate, options.orderTypeIds.feed)
      ]);
    });
    const deliveryInputs = input.vendorDeliveries ?? [];
    const deliveryIds = deliveryInputs.map((stop) => stop.vendorDestinationId);
    if (!deliveryInputs.length || new Set(deliveryIds).size !== deliveryIds.length) {
      throw new Error('Add a different selling party for each delivery destination.');
    }
    const sellingParties = deliveryInputs.map((stop) => {
      const party = this.selected(options.deliveryVendors, stop.vendorDestinationId, 'selling party');
      return this.partyPayload(party, [
        this.createOrder(stop.broilerQuantity, stop.broilerWeight, stop.broilerRate, options.orderTypeIds.broiler),
        this.createOrder(stop.cullsQuantity, stop.cullsWeight, stop.cullsRate, options.orderTypeIds.culls),
        this.createOrder(stop.feedQuantity, stop.feedWeight, stop.feedRate, options.orderTypeIds.feed)
      ]);
    });
    return {
      vehicle: this.vehiclePayload(vehicle),
      driver: this.driverPayload(driver),
      supervisor: this.supervisorPayload(supervisor),
      buyingParties,
      sellingParties,
      ...(input.payments?.length ? {
        payments: input.payments.map(({ partyId, reference, ...payment }) => ({
          ...payment,
          status: 'COMPLETED',
          ...(payment.paymentType === 'BUYER_RECEIPT' ? { buyingPartyId: this.parseId(partyId) } : { sellingPartyId: this.parseId(partyId) }),
          externalReference: reference
        }))
      } : {}),
      ...(input.expenses?.length ? { expenses: input.expenses } : {}),
      route: input.route.trim(),
      date: input.tripDate,
      status: 'Assigned'
    };
  }

  private createOrder(quantity: number | null | undefined, weight: number | null | undefined, rate: number | null | undefined, orderTypeId: number): ApiOrder | null {
    const qty = quantity ?? 0;
    const orderWeight = weight ?? 0;
    const orderRate = rate ?? 0;
    if (qty === 0 && orderWeight === 0) return null;
    if (!Number.isSafeInteger(qty) || qty < 0) {
      throw new Error('The backend order API requires whole-number quantities.');
    }
    if ((qty > 0 && orderWeight <= 0) || (qty === 0 && orderWeight > 0)) {
      throw new Error('Enter a positive quantity and weight together for each order.');
    }
    if (![orderWeight, orderRate].every((value) => Number.isFinite(value) && value >= 0 &&
      Math.abs(value * 100 - Math.round(value * 100)) <= 1e-8)) {
      throw new Error('Order weights and rates must be non-negative amounts with no more than two decimal places.');
    }
    const total = Math.round(orderWeight * orderRate * 100) / 100;
    if (!Number.isFinite(total)) throw new Error('The order total exceeds the supported range.');
    return { orderTypeId, qty, weight: orderWeight, rate: orderRate, total, isActive: true, isDeleted: false };
  }

  private partyPayload(party: TripRecord, orders: (ApiOrder | null)[]): Record<string, unknown> {
    return {
      id: this.parseId(String(party['_demoId'] ?? '')),
      name: String(party['name'] ?? ''),
      contact: String(party['contact'] ?? ''),
      location: String(party['location'] ?? ''),
      order: orders.filter((order): order is ApiOrder => order !== null),
      isActive: true,
      isDeleted: false
    };
  }

  private vehiclePayload(vehicle: TripRecord): Record<string, unknown> {
    return {
      id: this.parseId(String(vehicle['_demoId'] ?? '')),
      name: String(vehicle['type'] ?? ''),
      vehNumber: String(vehicle['vehicle'] ?? ''),
      registrationNo: String(vehicle['registrationNo'] ?? ''),
      regValidity: vehicle['registrationDueDate'] || null,
      insuranceNo: String(vehicle['insuranceNo'] ?? ''),
      insuranceValidity: vehicle['insuranceDueDate'] || null,
      isActive: true,
      isDeleted: false
    };
  }

  private driverPayload(driver: TripRecord): Record<string, unknown> {
    return {
      id: this.parseId(String(driver['_demoId'] ?? '')),
      name: String(driver['name'] ?? ''),
      address: String(driver['address'] ?? ''),
      number: String(driver['number'] ?? ''),
      status: String(driver['status'] ?? ''),
      isActive: true,
      isDeleted: false
    };
  }

  private supervisorPayload(supervisor: TripRecord): Record<string, unknown> {
    return {
      id: this.parseId(String(supervisor['_demoId'] ?? '')),
      name: String(supervisor['name'] ?? ''),
      address: String(supervisor['address'] ?? ''),
      number: String(supervisor['number'] ?? ''),
      status: String(supervisor['status'] ?? ''),
      isActive: true,
      isDeleted: false
    };
  }

  private mapPickup(party: ApiParty, orderNames: Map<number, OrderKind>): TripVendorPickup {
    const lines = this.mapOrders(party.order ?? [], orderNames);
    return {
      vendorId: String(party.id),
      vendorName: String(party.name ?? ''),
      broiler: lines.broiler,
      culls: lines.culls,
      feed: lines.feed,
      total: lines.broiler.total + lines.culls.total + lines.feed.total
    };
  }

  private mapDestination(party: ApiParty, orderNames: Map<number, OrderKind>): TripRecord {
    const lines = this.mapOrders(party.order ?? [], orderNames);
    return {
      _demoId: String(party.id),
      vendorDestinationId: String(party.id),
      vendorName: String(party.name ?? ''),
      address: String(party.location ?? ''),
      contact: String(party.contact ?? ''),
      phone: '',
      orderedBroiler: lines.broiler.quantity,
      orderedBroilerWeight: lines.broiler.weight ?? 0,
      broilerRate: lines.broiler.rate,
      broilerTotal: lines.broiler.total,
      orderedCulls: lines.culls.quantity,
      orderedCullsWeight: lines.culls.weight ?? 0,
      cullsRate: lines.culls.rate,
      cullsTotal: lines.culls.total,
      orderedFeed: lines.feed.quantity,
      orderedFeedWeight: lines.feed.weight ?? 0,
      feedRate: lines.feed.rate,
      feedTotal: lines.feed.total,
      deliveryTotal: lines.broiler.total + lines.culls.total + lines.feed.total
    };
  }

  private mapOrders(orders: ApiOrder[], orderNames: Map<number, OrderKind>): Record<OrderKind, { quantity: number; weight: number; rate: number; total: number }> {
    const result: Record<OrderKind, { quantity: number; weight: number; rate: number; total: number }> = {
      broiler: { quantity: 0, weight: 0, rate: 0, total: 0 },
      culls: { quantity: 0, weight: 0, rate: 0, total: 0 },
      feed: { quantity: 0, weight: 0, rate: 0, total: 0 }
    };
    for (const order of orders) {
      const kind = orderNames.get(order.orderTypeId);
      if (!kind || order['isDeleted'] === true) continue;
      result[kind] = {
        quantity: Number(order.qty ?? 0),
        weight: Number(order.weight ?? 0),
        rate: Number(order.rate ?? 0),
        total: Number(order.total ?? 0)
      };
    }
    return result;
  }

  private actualPickupRecord(pickup: ApiSupplierPickup, orderNames: Map<number, OrderKind>): TripRecord {
    const orders = this.mapOrders(pickup.actualOrders ?? [], orderNames);
    return this.actualOrderRecord(String(pickup.id ?? ''), String(pickup.buyingParty?.id ?? pickup.buyingPartyId ?? ''), String(pickup.buyingParty?.name ?? ''), orders, String(pickup.note ?? ''));
  }

  private actualDeliveryRecord(delivery: ApiVendorDelivery, orderNames: Map<number, OrderKind>): TripRecord {
    const orders = this.mapOrders(delivery.actualOrders ?? [], orderNames);
    return {
      ...this.actualOrderRecord(String(delivery.id ?? ''), String(delivery.sellingParty?.id ?? ''), String(delivery.sellingParty?.name ?? ''), orders, String(delivery.note ?? '')),
      deliveredAt: String(delivery.createDate ?? '')
    };
  }

  private actualOrderRecord(id: string, partyId: string, partyName: string, orders: Record<OrderKind, { quantity: number; weight: number; rate: number; total: number }>, note: string): TripRecord {
    return {
      _demoId: id,
      vendorId: partyId,
      vendorDestinationId: partyId,
      vendorName: partyName,
      broiler: orders.broiler.quantity,
      broilerQuantity: orders.broiler.quantity,
      broilerWeight: orders.broiler.weight,
      broilerRate: orders.broiler.rate,
      broilerTotal: orders.broiler.total,
      culls: orders.culls.quantity,
      cullsQuantity: orders.culls.quantity,
      cullsWeight: orders.culls.weight,
      cullsRate: orders.culls.rate,
      cullsTotal: orders.culls.total,
      feed: orders.feed.quantity,
      feedQuantity: orders.feed.quantity,
      feedWeight: orders.feed.weight,
      feedRate: orders.feed.rate,
      feedTotal: orders.feed.total,
      total: orders.broiler.total + orders.culls.total + orders.feed.total,
      deliveryTotal: orders.broiler.total + orders.culls.total + orders.feed.total,
      remarks: note,
      reason: note
    };
  }

  private async actualOrders(lines: Array<{ kind: OrderKind; quantity: number; weight: number; rate: number }>): Promise<ApiActualOrder[]> {
    const orderTypes = await firstValueFrom(this.http.get<ApiEntity[]>(`${this.baseUrl}/order-types`));
    const ids = this.getOrderTypeIds(orderTypes);
    for (const line of lines) {
      if (!Number.isSafeInteger(line.quantity) || line.quantity < 0 || !Number.isFinite(line.weight) || line.weight < 0 ||
        !Number.isFinite(line.rate) || line.rate < 0) {
        throw new Error('Delivery quantities, weights, and rates must be non-negative valid numbers.');
      }
    }
    return lines.filter((line) => line.quantity > 0 || line.weight > 0).map((line) => {
      return {
        orderTypeId: ids[line.kind],
        qty: line.quantity,
        weight: line.weight,
        rate: line.rate,
        total: this.roundMoney(line.weight * line.rate),
        isActive: true,
        isDeleted: false
      };
    });
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private getOrderTypeIds(orderTypes: ApiEntity[]): Record<OrderKind, number> {
    const ids = {} as Record<OrderKind, number>;
    for (const [id, kind] of this.getOrderTypeNames(orderTypes.filter(this.isActive))) {
      ids[kind] = id;
    }
    if (!ids.broiler || !ids.culls || !ids.feed) {
      throw new Error('Configure active backend order types for Broiler, Culls, and Feed before creating trips.');
    }
    return ids;
  }

  private getOrderTypeNames(orderTypes: ApiEntity[]): Map<number, OrderKind> {
    const names = new Map<number, OrderKind>();
    for (const orderType of orderTypes) {
      if (orderType.isDeleted || !Number.isSafeInteger(orderType.id) || orderType.id < 1) continue;
      const name = String(orderType.name ?? '').trim().toLowerCase();
      const kind = name.includes('broiler') ? 'broiler' : name.includes('cull') ? 'culls' : name.includes('feed') ? 'feed' : undefined;
      if (kind) names.set(orderType.id, kind);
    }
    return names;
  }

  private vehicleRecord(vehicle: ApiEntity): TripRecord {
    return {
      _demoId: String(vehicle.id),
      vehicle: String(vehicle['vehNumber'] ?? ''),
      type: String(vehicle.name ?? ''),
      registrationNo: String(vehicle['registrationNo'] ?? ''),
      registrationDueDate: String(vehicle['regValidity'] ?? ''),
      insuranceNo: String(vehicle['insuranceNo'] ?? ''),
      insuranceDueDate: String(vehicle['insuranceValidity'] ?? ''),
      status: vehicle.isActive ? 'Active' : 'Inactive'
    };
  }

  private driverRecord(driver: Employee): TripRecord {
    return {
      _demoId: String(driver.id),
      name: String(driver.name ?? ''),
      address: String(driver.address ?? ''),
      number: String(driver.number ?? ''),
      status: String(driver.status ?? (driver.isActive ? 'Active' : 'Inactive'))
    };
  }

  private partyRecord(party: ApiParty): TripRecord {
    return {
      _demoId: String(party.id),
      name: String(party.name ?? ''),
      contact: String(party.contact ?? ''),
      location: String(party.location ?? ''),
      address: String(party.location ?? ''),
      phone: '',
      status: party.isActive ? 'Active' : 'Inactive'
    };
  }

  private supervisorRecord(supervisor: Employee): TripRecord {
    return {
      _demoId: String(supervisor.id),
      name: String(supervisor.name ?? ''),
      address: String(supervisor.address ?? ''),
      number: String(supervisor.number ?? ''),
      status: String(supervisor.status ?? (supervisor.isActive ? 'Active' : 'Inactive'))
    };
  }

  private tripRecord(trip: ApiTrip, vehicles: Map<string, ApiEntity>, drivers: Map<string, ApiEntity>): TripRecord {
    const id = trip.tripId ?? trip.id;
    if (!Number.isSafeInteger(id) || !id || typeof trip.date !== 'string' || typeof trip.route !== 'string') {
      throw new Error('The trips API returned an invalid trip record.');
    }
    const vehicleId = trip.vehicle?.['id'] ?? trip['vehicleId'];
    const driverId = trip.driver?.['id'] ?? trip['driverId'];
    const vehicle = trip.vehicle ?? vehicles.get(String(vehicleId));
    const driver = trip.driver ?? drivers.get(String(driverId));
    return {
      _demoId: String(id),
      tripNumber: `TR-${String(id).padStart(4, '0')}`,
      tripDate: trip.date,
      vehicleId: String(vehicleId ?? ''),
      vehicleName: String(vehicle?.['vehNumber'] ?? ''),
      vehicleType: String(vehicle?.['name'] ?? ''),
      driverId: String(driverId ?? ''),
      driverName: String(driver?.['name'] ?? ''),
      supervisorId: String(trip.supervisor?.['id'] ?? trip['supervisorId'] ?? ''),
      supervisorName: String(trip.supervisor?.['name'] ?? ''),
      route: trip.route,
      status: String(trip.status ?? 'Assigned'),
      createdBy: String(trip['createdBy'] ?? ''),
      createdAt: String(trip['createDate'] ?? ''),
      updatedAt: String(trip['updatedDate'] ?? '')
    };
  }

  private selected(records: TripRecord[], id: string, label: string): TripRecord {
    const record = records.find((item) => String(item['_demoId'] ?? '') === id);
    if (!record) throw new Error(`Select an available ${label}.`);
    return record;
  }

  private optionalEntityId(entity: Pick<Employee, 'id'> | undefined): string {
    return entity?.id ? String(entity.id) : '';
  }

  private isActive(record: ApiEntity): boolean {
    return record.isActive === true && record.isDeleted !== true;
  }

  private parseId(id: string): number {
    const parsed = Number(id);
    if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error('The trip or related record ID is invalid.');
    return parsed;
  }

  private isValidDate(value: string): boolean {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return false;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return date.getUTCFullYear() === Number(match[1]) &&
      date.getUTCMonth() === Number(match[2]) - 1 &&
      date.getUTCDate() === Number(match[3]);
  }
}
