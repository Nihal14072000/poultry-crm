import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CreateTripInput } from '../models/trip.model';
import { TripFormOptions, TripApiService } from './trip-api.service';

describe('TripApiService', () => {
  let service: TripApiService;
  let http: HttpTestingController;

  const options: TripFormOptions = {
    vehicles: [{ _demoId: '21', vehicle: 'MH-12-AB-4521', type: 'Truck', status: 'Active' }],
    drivers: [{ _demoId: '12', name: 'Asha Patil', address: 'Nashik', number: 'DL-12', status: 'Active' }],
    suppliers: [{ _demoId: '31', name: 'Farm Vendor', contact: 'Vendor Desk', location: 'Nashik', status: 'Active' }],
    supervisors: [{ _demoId: '41', name: 'Supervisor One', address: 'Pune', number: 'SUP-41', status: 'Active' }],
    deliveryVendors: [{ _demoId: '51', name: 'Market Vendor', contact: 'Receiving', location: 'Pune', status: 'Active' }],
    trips: [],
    orderTypeIds: { broiler: 1, culls: 2, feed: 3 }
  };

  const input: CreateTripInput = {
    tripDate: '2026-10-23',
    vehicleId: '21',
    driverId: '12',
    supervisorId: '41',
    route: 'Nashik to Pune',
    vendorPickups: [{
      vendorId: '31',
      broiler: { quantity: 10, weight: 22.5, rate: 100 },
      culls: { quantity: 2, weight: 3, rate: 40 },
      feed: { quantity: 5, weight: 5, rate: 20 }
    }],
    vendorDeliveries: [{
      vendorDestinationId: '51',
      broilerQuantity: 8, broilerWeight: 18, broilerRate: 110,
      cullsQuantity: 1, cullsWeight: 1.5, cullsRate: 45,
      feedQuantity: 2, feedWeight: 2, feedRate: 25
    }]
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TripApiService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(TripApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads unified drivers and supervisors from their existing endpoints', async () => {
    const result = service.getFormOptions();
    http.expectOne('http://localhost:8080/api/vehicles').flush([]);
    http.expectOne('http://localhost:8080/api/drivers').flush([{
      id: 12, name: 'Asha Patil', address: 'Nashik', number: 'DL-12', type: 'DRIVER', status: 'Active',
      isActive: true, isDeleted: false, createDate: null, updatedDate: null, createdBy: null, updatedBy: null
    }]);
    http.expectOne('http://localhost:8080/api/buying-parties').flush([]);
    http.expectOne('http://localhost:8080/api/supervisors').flush([{
      id: 41, name: 'Supervisor One', address: 'Pune', number: 'SUP-41', type: 'SUPERVISOR', status: 'Active',
      isActive: true, isDeleted: false, createDate: null, updatedDate: null, createdBy: null, updatedBy: null
    }]);
    http.expectOne('http://localhost:8080/api/selling-parties').flush([]);
    http.expectOne('http://localhost:8080/api/trips').flush([]);
    http.expectOne('http://localhost:8080/api/order-types').flush([
      { id: 1, name: 'Broiler', isActive: true, isDeleted: false },
      { id: 2, name: 'Culls', isActive: true, isDeleted: false },
      { id: 3, name: 'Feed', isActive: true, isDeleted: false }
    ]);

    const options = await result;
    expect(options.drivers).toEqual([{
      _demoId: '12', name: 'Asha Patil', address: 'Nashik', number: 'DL-12', status: 'Active'
    }]);
    expect(options.supervisors).toEqual([{
      _demoId: '41', name: 'Supervisor One', address: 'Pune', number: 'SUP-41', status: 'Active'
    }]);
  });

  it('inserts the trip and all nested orders with one API request', async () => {
    const result = service.insertTrip(input, options);
    const request = http.expectOne('http://localhost:8080/api/trips/insert');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      vehicle: {
        id: 21, name: 'Truck', vehNumber: 'MH-12-AB-4521', registrationNo: '',
        regValidity: null, insuranceNo: '', insuranceValidity: null, isActive: true, isDeleted: false
      },
      driver: {
        id: 12, name: 'Asha Patil', address: 'Nashik', number: 'DL-12', status: 'Active',
        isActive: true, isDeleted: false
      },
      supervisor: {
        id: 41, name: 'Supervisor One', address: 'Pune', number: 'SUP-41', status: 'Active',
        isActive: true, isDeleted: false
      },
      buyingParties: [{
        id: 31, name: 'Farm Vendor', contact: 'Vendor Desk', location: 'Nashik',
        isActive: true, isDeleted: false,
        order: [
          { orderTypeId: 1, qty: 10, weight: 22.5, rate: 100, total: 2250, isActive: true, isDeleted: false },
          { orderTypeId: 2, qty: 2, weight: 3, rate: 40, total: 120, isActive: true, isDeleted: false },
          { orderTypeId: 3, qty: 5, weight: 5, rate: 20, total: 100, isActive: true, isDeleted: false }
        ]
      }],
      sellingParties: [{
        id: 51, name: 'Market Vendor', contact: 'Receiving', location: 'Pune',
        isActive: true, isDeleted: false,
        order: [
          { orderTypeId: 1, qty: 8, weight: 18, rate: 110, total: 1980, isActive: true, isDeleted: false },
          { orderTypeId: 2, qty: 1, weight: 1.5, rate: 45, total: 67.5, isActive: true, isDeleted: false },
          { orderTypeId: 3, qty: 2, weight: 2, rate: 25, total: 50, isActive: true, isDeleted: false }
        ]
      }],
      route: 'Nashik to Pune',
      date: '2026-10-23',
      status: 'Assigned'
    });
    expect(request.request.body['driver']['type']).toBeUndefined();
    expect(request.request.body['supervisor']['type']).toBeUndefined();
    request.flush({ tripId: 107, date: '2026-10-23', route: 'Nashik to Pune', status: 'Assigned' });

    await expectAsync(result).toBeResolvedTo(jasmine.objectContaining({ _demoId: '107', tripDate: '2026-10-23' }));
  });

  it('loads delivery details and actual entries from backend delivery APIs', async () => {
    const result = service.getDeliveryData('12', [], ['84']);
    http.expectOne('http://localhost:8080/api/trips/12/retrieve').flush({
      tripId: 12,
      date: '2026-10-25',
      route: 'Nashik to Pune',
      status: 'In transit',
      vehicle: { id: 21, name: 'Truck', vehNumber: 'MH-12-AB-4521' },
      driver: { id: 12, name: 'Asha Patil' },
      supervisor: { id: 41, name: 'Supervisor One' },
      buyingParties: [{
        id: 31,
        name: 'Farm Vendor',
        order: [
          { orderTypeId: 1, qty: 10, weight: 22, rate: 100, total: 2200 },
          { orderTypeId: 2, qty: 0, weight: 0, rate: 40, total: 0 },
          { orderTypeId: 3, qty: 5, weight: 5, rate: 20, total: 100 }
        ]
      }],
      sellingParties: [{
        id: 51,
        name: 'Market Vendor',
        location: 'Pune',
        order: [
          { orderTypeId: 1, qty: 8, weight: 18, rate: 110, total: 1980 },
          { orderTypeId: 2, qty: 0, weight: 0, rate: 45, total: 0 },
          { orderTypeId: 3, qty: 0, weight: 0, rate: 25, total: 0 }
        ]
      }]
    });
    http.match('http://localhost:8080/api/order-types').forEach((request) => request.flush([
      { id: 1, name: 'Broiler', isActive: true },
      { id: 2, name: 'Culls', isActive: true },
      { id: 3, name: 'Feed', isActive: true }
    ]));
    http.expectOne('http://localhost:8080/api/deliveries').flush([{ id: 75, tripId: 12, isActive: true }]);
    await Promise.resolve();
    await Promise.resolve();
    http.expectOne('http://localhost:8080/api/mortalities').flush([{
      id: 91, tripId: 12, combinedMortality: 1, reason: 'Transit loss', isActive: true
    }]);
    http.expectOne('http://localhost:8080/api/deliveries/75/retrieve').flush({
      id: 75,
      supplierPickup: { id: 81 },
      vendorDeliveries: [{
        id: 82,
        sellingParty: { id: 51, name: 'Market Vendor' },
        actualOrders: [{ orderTypeId: 1, qty: 8, weight: 18, rate: 110, total: 1980 }],
        note: 'Received by vendor'
      }]
    });
    await Promise.resolve();
    await Promise.resolve();
    http.expectOne('http://localhost:8080/api/supplier-pickups/81/retrieve').flush({
      id: 81,
      buyingPartyId: 31,
      actualOrders: [
        { orderTypeId: 1, qty: 9, weight: 20, rate: 100, total: 2000 },
        { orderTypeId: 3, qty: 4, weight: 4, rate: 20, total: 80 }
      ]
    });
    http.expectOne('http://localhost:8080/api/vendor-deliveries/84').flush({
      id: 84, sellingPartyId: 51, note: 'Second delivery'
    });
    http.expectOne('http://localhost:8080/api/vendor-deliveries/84/orders').flush([
      { orderTypeId: 1, qty: 1, weight: 2, rate: 110, total: 220 }
    ]);

    const data = await result;
    expect(data.trip['_demoId']).toBe('12');
    expect(data.supplierReceipts[0]['broilerQuantity']).toBe(9);
    expect(data.supplierReceipts[0]['vendorId']).toBe('31');
    expect(data.destinations[0]['_demoId']).toBe('51');
    expect(data.deliveries[0]['vendorDestinationId']).toBe('51');
    expect(data.deliveries[0]['broiler']).toBe(8);
    expect(data.deliveries[1]['_demoId']).toBe('84');
    expect(data.deliveries[1]['broiler']).toBe(1);
    expect(data.mortality?.['quantity']).toBe(1);
    expect(data.loadedBirds).toBe(9);
  });

  it('creates supplier pickups with actual orders in the create request', async () => {
    const result = service.saveSupplierPickup('31', {
      broiler: 9, broilerWeight: 20, broilerRate: 100,
      culls: 0, cullsWeight: 0, cullsRate: 40,
      feed: 4, feedWeight: 4, feedRate: 20,
      note: 'Received at farm'
    });
    http.expectOne('http://localhost:8080/api/order-types').flush([
      { id: 1, name: 'Broiler', isActive: true },
      { id: 2, name: 'Culls', isActive: true },
      { id: 3, name: 'Feed', isActive: true }
    ]);

    const createPickup = http.expectOne('http://localhost:8080/api/supplier-pickups');
    expect(createPickup.request.method).toBe('POST');
    expect(createPickup.request.body).toEqual({
      buyingPartyId: 31,
      actualOrders: [
        { orderTypeId: 1, qty: 9, weight: 20, rate: 100, total: 2000, isActive: true, isDeleted: false },
        { orderTypeId: 3, qty: 4, weight: 4, rate: 20, total: 80, isActive: true, isDeleted: false }
      ],
      note: 'Received at farm',
      isActive: true,
      isDeleted: false
    });
    createPickup.flush({ id: 81 });

    http.expectNone('http://localhost:8080/api/deliveries');
    http.expectNone('http://localhost:8080/api/supplier-pickups/81/orders');
    await expectAsync(result).toBeResolvedTo('81');
  });

  it('links pending supplier pickup IDs to the trip only when finalizing', async () => {
    const result = service.linkSupplierPickups('12', ['81', '82']);
    http.expectOne('http://localhost:8080/api/deliveries').flush([
      { id: 75, tripId: 12, supplierPickupId: 81, isActive: true, isDeleted: false }
    ]);
    const link = http.expectOne('http://localhost:8080/api/deliveries');
    expect(link.request.method).toBe('POST');
    expect(link.request.body).toEqual({
      tripId: 12, supplierPickupId: 82, isActive: true, isDeleted: false
    });
    link.flush({ id: 75 });
    await expectAsync(result).toBeResolved();
  });

  it('persists a vendor delivery through the documented entity and order endpoints', async () => {
    const result = service.saveVendorDelivery('51', {
      broiler: 2, broilerWeight: 5.5, broilerRate: 110,
      culls: 0, cullsWeight: 0, cullsRate: 45,
      feed: 0, feedWeight: 0, feedRate: 25,
      note: 'Shortage noted'
    });
    http.expectOne('http://localhost:8080/api/order-types').flush([
      { id: 1, name: 'Broiler', isActive: true },
      { id: 2, name: 'Culls', isActive: true },
      { id: 3, name: 'Feed', isActive: true }
    ]);
    const createVendor = http.expectOne('http://localhost:8080/api/vendor-deliveries');
    expect(createVendor.request.method).toBe('POST');
    expect(createVendor.request.body).toEqual({
      sellingPartyId: 51, note: 'Shortage noted', isActive: true, isDeleted: false
    });
    createVendor.flush({ id: 83 });
    const orders = http.expectOne('http://localhost:8080/api/vendor-deliveries/83/orders');
    expect(orders.request.method).toBe('PUT');
    expect(orders.request.body).toEqual([{
      orderTypeId: 1, qty: 2, weight: 5.5, rate: 110, total: 605,
      isActive: true, isDeleted: false
    }]);
    orders.flush([]);
    http.expectNone('http://localhost:8080/api/deliveries');
    await expectAsync(result).toBeResolvedTo('83');
  });

  it('links pending vendor delivery IDs to the trip only when finalizing', async () => {
    const result = service.linkVendorDeliveries('12', ['83', '84']);
    http.expectOne('http://localhost:8080/api/deliveries').flush([
      { id: 75, tripId: 12, vendorDelieveryId: 83, isActive: true, isDeleted: false }
    ]);
    const link = http.expectOne('http://localhost:8080/api/deliveries');
    expect(link.request.method).toBe('POST');
    expect(link.request.body).toEqual({
      tripId: 12, vendorDelieveryId: 84, isActive: true, isDeleted: false
    });
    link.flush({ id: 75 });
    await expectAsync(result).toBeResolved();
  });

  it('rejects fractional order quantities rather than silently truncating them', async () => {
    const invalidInput: CreateTripInput = {
      ...input,
      vendorPickups: [{
        ...input.vendorPickups[0],
        feed: { quantity: 1.5, weight: 1.5, rate: 20 }
      }]
    };

    await expectAsync(service.insertTrip(invalidInput, options))
      .toBeRejectedWithError('The backend order API requires whole-number quantities.');
    http.expectNone('http://localhost:8080/api/trips/insert');
  });
});
