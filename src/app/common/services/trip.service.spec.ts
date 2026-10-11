import { of } from 'rxjs';
import { CreateTripInput } from '../models/trip.model';
import { DirectoryService } from './directory.service';
import { RolePermissionService } from './role-permission.service';
import { summarizeTrip, TripService } from './trip.service';

describe('TripService', () => {
  let service: TripService;
  let directories: jasmine.SpyObj<DirectoryService>;
  const records: Record<string, Record<string, string | number>[]> = {
    vehicles: [{ _demoId: 'vehicles-1', vehicle: 'MH-12-AB-4521', type: 'Truck', status: 'Active', birdCapacity: 100 }],
    employees: [{ _demoId: 'employees-1', employee: 'S. Jadhav', department: 'Driver', status: 'Active' }],
    suppliers: [
      { _demoId: 'suppliers-1', name: 'Farm Vendor', status: 'Active' },
      { _demoId: 'suppliers-2', name: 'Second Farm Vendor', status: 'Active' }
    ],
    products: [{ _demoId: 'products-1', product: 'Feed', category: 'Feed', unit: 'kg', status: 'Active' }],
    trips: []
  };
  const input: CreateTripInput = {
    tripDate: '2026-10-11',
    vehicleId: 'vehicles-1',
    driverId: 'employees-1',
    route: 'Nashik pickup',
    vendorPickups: [{
      vendorId: 'suppliers-1',
      broiler: { quantity: 12, rate: 100 },
      culls: { quantity: 2, rate: 30 },
      feed: { quantity: 10, rate: 20 }
    }]
  };

  beforeEach(() => {
    records.trips = [];
    directories = jasmine.createSpyObj<DirectoryService>('DirectoryService', ['getDirectory', 'createRecord', 'updateRecord']);
    directories.getDirectory.and.callFake((resource: string) => of({ records: records[resource] ?? [] }));
    directories.createRecord.and.callFake((_resource, record) => of({ ...record, _demoId: 'trips-1' }));
    directories.updateRecord.and.callFake((_resource, id, record) => of({ ...record, _demoId: id }));
    const permissions = jasmine.createSpyObj<RolePermissionService>('RolePermissionService', ['can', 'canAccessRecord']);
    permissions.can.and.returnValue(true);
    permissions.canAccessRecord.and.returnValue(true);
    service = new TripService(directories, permissions);
  });

  it('recalculates and persists pickup totals for multiple vendors', async () => {
    const summary = summarizeTrip(input);
    expect(summary).toEqual({ vendors: 1, broiler: 12, culls: 2, feed: 10, birds: 14, grandTotal: 1460 });

    const multiVendorInput: CreateTripInput = {
      ...input,
      vendorPickups: [
        ...input.vendorPickups,
        {
          vendorId: 'suppliers-2',
          broiler: { quantity: 8, rate: 110 },
          culls: { quantity: 1, rate: 25 },
          feed: { quantity: 5, rate: 22 }
        }
      ]
    };
    const multiSummary = summarizeTrip(multiVendorInput);
    expect(multiSummary).toEqual({ vendors: 2, broiler: 20, culls: 3, feed: 15, birds: 23, grandTotal: 2475 });

    const created = await service.createTrip(multiVendorInput, 'Sales Manager');

    expect(created['tripNumber']).toBe('TR-0001');
    expect(created['vendorId']).toBe('suppliers-1');
    expect(created['vendorCount']).toBe(2);
    expect(created['vendorNames']).toBe('Farm Vendor, Second Farm Vendor');
    expect(JSON.parse(String(created['vendorPickups'])).length).toBe(2);
    expect(created['broilerTotal']).toBe(2080);
    expect(created['cullsTotal']).toBe(85);
    expect(created['feedTotal']).toBe(310);
    expect(created['totalBirds']).toBe(23);
    expect(created['grandTotal']).toBe(2475);
    expect(created['feedUnit']).toBe('kg');
    expect(created['status']).toBe('Assigned');
  });

  it('updates an existing trip without changing its trip number, status, or creation metadata', async () => {
    records.trips = [{
      _demoId: 'trips-existing',
      tripNumber: 'TR-0007',
      status: 'Assigned',
      createdBy: 'Original creator',
      createdAt: '2026-10-01T10:00:00.000Z'
    }];

    const updated = await service.updateTrip('trips-existing', input, 'Sales Manager');

    expect(directories.updateRecord).toHaveBeenCalled();
    expect(updated['_demoId']).toBe('trips-existing');
    expect(updated['tripNumber']).toBe('TR-0007');
    expect(updated['status']).toBe('Assigned');
    expect(updated['createdBy']).toBe('Original creator');
    expect(updated['createdAt']).toBe('2026-10-01T10:00:00.000Z');
    expect(updated['grandTotal']).toBe(1460);
  });

  it('rejects selecting the same vendor more than once', async () => {
    const duplicateVendors: CreateTripInput = {
      ...input,
      vendorPickups: [...input.vendorPickups, { ...input.vendorPickups[0] }]
    };

    await expectAsync(service.createTrip(duplicateVendors, 'Sales Manager'))
      .toBeRejectedWithError('Select each vendor only once per trip.');
    expect(directories.createRecord).not.toHaveBeenCalled();
  });

  it('loads saved trip data and individual vendor pickups for details', async () => {
    const storedPickup = {
      vendorId: 'suppliers-1',
      vendorName: 'Farm Vendor',
      broiler: { quantity: 12, rate: 100, total: 1200 },
      culls: { quantity: 2, rate: 30, total: 60 },
      feed: { quantity: 10, rate: 20, total: 200 },
      total: 1460
    };
    records.trips = [{
      _demoId: 'demo-trip-1',
      tripNumber: 'TR-0001',
      vendorPickups: JSON.stringify([storedPickup])
    }];

    const details = await service.getTripDetails('demo-trip-1');

    expect(details.trip['tripNumber']).toBe('TR-0001');
    expect(details.vendorPickups).toEqual([storedPickup]);
    records.trips = [];
  });

  it('rejects bird capacity overflow and fractional bird counts', async () => {
    await expectAsync(service.createTrip({
      ...input,
      vendorPickups: [{
        ...input.vendorPickups[0],
        broiler: { quantity: 100, rate: 1 }
      }]
    }, 'Sales Manager')).toBeRejectedWithError(/exceed this vehicle's capacity/);

    await expectAsync(service.createTrip({
      ...input,
      vendorPickups: [{
        ...input.vendorPickups[0],
        broiler: { quantity: 1.5, rate: 1 }
      }]
    }, 'Sales Manager')).toBeRejectedWithError('Broiler quantity must be a non-negative whole number.');
  });

  it('shows empty and invalid totals as finite non-negative values', () => {
    const summary = summarizeTrip({
      ...input,
      vendorPickups: [{
        ...input.vendorPickups[0],
        broiler: { quantity: -1, rate: 5 },
        culls: { quantity: null, rate: Number.POSITIVE_INFINITY },
        feed: { quantity: Number.NaN, rate: 2 }
      }]
    });

    expect(Object.values(summary).every((value) => Number.isFinite(value) && value >= 0)).toBeTrue();
  });
});
