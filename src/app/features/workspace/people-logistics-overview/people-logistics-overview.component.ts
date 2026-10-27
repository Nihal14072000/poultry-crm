import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TripRecord } from '../../../common/models/trip.model';
import { DriverDirectoryService } from '../../../common/services/driver-directory.service';
import { RolePermissionService } from '../../../common/services/role-permission.service';
import { TripApiService } from '../../../common/services/trip-api.service';
import { VehicleDirectoryService } from '../../../common/services/vehicle-directory.service';

type OverviewRecord = Record<string, string | number>;

@Component({
  selector: 'app-people-logistics-overview',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './people-logistics-overview.component.html',
  styleUrl: './people-logistics-overview.component.css'
})
export class PeopleLogisticsOverviewComponent implements OnInit {
  employees: OverviewRecord[] = [];
  vehicles: OverviewRecord[] = [];
  trips: TripRecord[] = [];
  loading = true;
  errorMessage = '';

  constructor(
    private readonly drivers: DriverDirectoryService,
    private readonly vehiclesService: VehicleDirectoryService,
    private readonly tripApi: TripApiService,
    readonly rolePermissions: RolePermissionService
  ) {}

  get canSeeEmployees(): boolean {
    return this.rolePermissions.canAccessRoute('employees');
  }

  get canSeeVehicles(): boolean {
    return this.rolePermissions.canAccessRoute('vehicles');
  }

  get canSeeTrips(): boolean {
    return this.rolePermissions.canAccessRoute('trips');
  }

  get activeEmployees(): number {
    return this.employees.filter((employee) => String(employee['status']).toLowerCase() === 'active').length;
  }

  get activeVehicles(): number {
    return this.vehicles.filter((vehicle) => String(vehicle['status']).toLowerCase() === 'active').length;
  }

  get activeTrips(): number {
    return this.trips.filter((trip) => !['completed', 'closed', 'deleted'].includes(String(trip['status']).toLowerCase())).length;
  }

  async ngOnInit(): Promise<void> {
    const requests: [
      Promise<{ records: OverviewRecord[] }>,
      Promise<{ records: OverviewRecord[] }>,
      Promise<TripRecord[]>
    ] = [
      this.canSeeEmployees ? firstValueFrom(this.drivers.getDirectory()) : Promise.resolve({ records: [] }),
      this.canSeeVehicles ? firstValueFrom(this.vehiclesService.getDirectory()) : Promise.resolve({ records: [] }),
      this.canSeeTrips ? this.tripApi.getTrips() : Promise.resolve([])
    ];

    try {
      const [employees, vehicles, trips] = await Promise.all(requests);
      this.employees = employees.records.filter((record) => this.rolePermissions.canAccessRecord('employees', record));
      this.vehicles = vehicles.records.filter((record) => this.rolePermissions.canAccessRecord('vehicles', record));
      this.trips = trips.filter((record) => this.rolePermissions.canAccessRecord('trips', record));
    } catch {
      this.errorMessage = 'People and logistics data could not be loaded. Please refresh to try again.';
    } finally {
      this.loading = false;
    }
  }
}
