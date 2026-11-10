import { of } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { DirectoryService } from '../../../common/services/directory.service';
import { RolePermissionService } from '../../../common/services/role-permission.service';
import { SessionAuthService } from '../../../common/services/session-auth.service';
import { TripApiService, TripFormOptions } from '../../../common/services/trip-api.service';
import { CreateTripComponent } from './create-trip.component';

describe('CreateTripComponent draft persistence', () => {
  const options: TripFormOptions = {
    vehicles: [],
    drivers: [],
    suppliers: [],
    supervisors: [],
    deliveryVendors: [],
    trips: [],
    orderTypeIds: { broiler: 1, culls: 2, feed: 3 }
  };
  let tripApi: jasmine.SpyObj<TripApiService>;
  let directories: jasmine.SpyObj<DirectoryService>;
  let permissions: jasmine.SpyObj<RolePermissionService>;
  let auth: jasmine.SpyObj<SessionAuthService>;
  let route: ActivatedRoute;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    window.sessionStorage.clear();
    tripApi = jasmine.createSpyObj<TripApiService>('TripApiService', ['getFormOptions', 'getTripDetails']);
    tripApi.getFormOptions.and.resolveTo(options);
    directories = jasmine.createSpyObj<DirectoryService>('DirectoryService', ['getDirectory']);
    directories.getDirectory.and.returnValue(of({ records: [{ category: 'feed', status: 'active', unit: 'kg' }] }));
    permissions = jasmine.createSpyObj<RolePermissionService>('RolePermissionService', ['can', 'canAccessRecord']);
    permissions.can.and.returnValue(true);
    permissions.canAccessRecord.and.returnValue(true);
    auth = jasmine.createSpyObj<SessionAuthService>('SessionAuthService', [], ['currentUser']);
    Object.defineProperty(auth, 'currentUser', {
      get: () => ({ id: 7, email: 'user@example.test' })
    });
    route = { snapshot: { paramMap: { get: () => null } } } as unknown as ActivatedRoute;
    router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
  });

  afterEach(() => window.sessionStorage.clear());

  it('restores trip form fields and nested rows after component recreation', async () => {
    const first = new CreateTripComponent(directories, tripApi, route, router, permissions, auth);
    await first.ngOnInit();
    first.selectedVehicleId = '21';
    first.selectedDriverId = '12';
    first.selectedSupervisorId = '41';
    first.route = 'Nashik to Pune';
    first.tripDate = '2026-11-10';
    first.vendorPickups = [{
      key: 3,
      vendorId: '31',
      broiler: { quantity: 10, weight: 20, rate: 100 },
      culls: { quantity: null, weight: null, rate: null },
      feed: { quantity: null, weight: null, rate: null }
    }];
    first.deliveryStops = [{
      key: 4, vendorDestinationId: '51', broilerQuantity: 8, broilerWeight: 18, broilerRate: 110,
      cullsQuantity: null, cullsWeight: null, cullsRate: null,
      feedQuantity: null, feedWeight: null, feedRate: null
    }];
    first.payments = [{
      paymentType: 'BUYER_RECEIPT', partyId: '51', amount: 250, paymentDate: '2026-11-10', paymentMethod: 'UPI'
    }];
    first.expenses = [{ category: 'Fuel', amount: 100, expenseDate: '2026-11-10', note: 'Route fuel' }];
    first.ngDoCheck();

    const restored = new CreateTripComponent(directories, tripApi, route, router, permissions, auth);
    await restored.ngOnInit();

    expect(restored.selectedVehicleId).toBe('21');
    expect(restored.selectedDriverId).toBe('12');
    expect(restored.selectedSupervisorId).toBe('41');
    expect(restored.route).toBe('Nashik to Pune');
    expect(restored.tripDate).toBe('2026-11-10');
    expect(restored.vendorPickups).toEqual(first.vendorPickups);
    expect(restored.deliveryStops).toEqual(first.deliveryStops);
    expect(restored.payments).toEqual(first.payments);
    expect(restored.expenses).toEqual(first.expenses);
  });
});
