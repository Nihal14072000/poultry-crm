import { of } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { DriverDirectoryService } from '../../../common/services/driver-directory.service';
import { RolePermissionService } from '../../../common/services/role-permission.service';
import { TripApiService } from '../../../common/services/trip-api.service';
import { VehicleDirectoryService } from '../../../common/services/vehicle-directory.service';
import { PeopleLogisticsOverviewComponent } from './people-logistics-overview.component';

describe('PeopleLogisticsOverviewComponent', () => {
  it('loads permitted backend records and summarizes active people, vehicles, and trips', async () => {
    TestBed.configureTestingModule({
      imports: [PeopleLogisticsOverviewComponent],
      providers: [
        {
          provide: DriverDirectoryService,
          useValue: { getDirectory: () => of({ records: [
            { _demoId: 'employee-1', name: 'Ravi', status: 'Active' },
            { _demoId: 'employee-2', name: 'Nisha', status: 'Inactive' },
            { _demoId: 'employee-3', name: 'Hidden', status: 'Hidden' }
          ] }) }
        },
        {
          provide: VehicleDirectoryService,
          useValue: { getDirectory: () => of({ records: [
            { _demoId: 'vehicle-1', status: 'Active' },
            { _demoId: 'vehicle-2', status: 'Inactive' }
          ] }) }
        },
        {
          provide: TripApiService,
          useValue: { getTrips: async () => [
            { _demoId: 'trip-1', status: 'In progress' },
            { _demoId: 'trip-2', status: 'Completed' }
          ] }
        },
        {
          provide: RolePermissionService,
          useValue: {
            canAccessRoute: () => true,
            canAccessRecord: (_resource: string, record: Record<string, string | number>) => record['status'] !== 'Hidden'
          }
        }
      ]
    });

    const fixture = TestBed.createComponent(PeopleLogisticsOverviewComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.employees.length).toBe(2);
    expect(fixture.componentInstance.activeEmployees).toBe(1);
    expect(fixture.componentInstance.activeVehicles).toBe(1);
    expect(fixture.componentInstance.activeTrips).toBe(1);
  });
});
