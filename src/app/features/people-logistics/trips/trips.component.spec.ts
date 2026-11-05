import { Router } from '@angular/router';
import { TripRecord } from '../../../common/models/trip.model';
import { RolePermissionService } from '../../../common/services/role-permission.service';
import { SessionAuthService } from '../../../common/services/session-auth.service';
import { TripApiService } from '../../../common/services/trip-api.service';
import { TripService } from '../../../common/services/trip.service';
import { TripsComponent } from './trips.component';

describe('TripsComponent', () => {
  let component: TripsComponent;
  let tripRecords: jasmine.SpyObj<TripService>;
  let rolePermissions: jasmine.SpyObj<RolePermissionService>;

  beforeEach(() => {
    const tripApi = jasmine.createSpyObj<TripApiService>('TripApiService', ['getTrips']);
    tripRecords = jasmine.createSpyObj<TripService>('TripService', ['softDeleteTrip']);
    const router = jasmine.createSpyObj<Router>('Router', ['getCurrentNavigation']);
    router.getCurrentNavigation.and.returnValue(null);
    rolePermissions = jasmine.createSpyObj<RolePermissionService>('RolePermissionService', ['can']);
    rolePermissions.can.and.returnValue(true);
    const auth = jasmine.createSpyObj<SessionAuthService>('SessionAuthService', [], { currentUser: null });
    component = new TripsComponent(tripApi, tripRecords, router, rolePermissions, auth);
  });

  it('confirms trip deletion and updates the list after the service succeeds', async () => {
    const trip: TripRecord = { _demoId: 'trip-12', status: 'Assigned' };
    spyOn(window, 'confirm').and.returnValue(true);
    tripRecords.softDeleteTrip.and.resolveTo();

    await component.deleteTrip(trip);

    expect(tripRecords.softDeleteTrip).toHaveBeenCalledWith('trip-12');
    expect(trip['status']).toBe('Deleted');
    expect(component.successMessage).toBe('Trip deleted successfully.');
  });
});
