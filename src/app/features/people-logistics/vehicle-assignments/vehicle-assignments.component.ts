import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { ColDef } from 'ag-grid-community';
import { DataGridComponent } from '../../../common/components/data-grid/data-grid.component';
import { GridActionsCellComponent } from '../../../common/components/data-grid/grid-actions-cell.component';
import { firstValueFrom } from 'rxjs';
import { DirectoryService } from '../../../common/services/directory.service';
import { RolePermissionService } from '../../../common/services/role-permission.service';

type FleetRecord = Record<string, string | number>;

function localDateString(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

@Component({
  selector: 'app-vehicle-assignments',
  standalone: true,
  imports: [CommonModule, DataGridComponent, FormsModule, NgSelectModule],
  templateUrl: './vehicle-assignments.component.html',
  styleUrl: './vehicle-assignments.component.css'
})
export class VehicleAssignmentsComponent implements OnInit {
  vehicles: FleetRecord[] = [];
  employees: FleetRecord[] = [];
  assignments: FleetRecord[] = [];
  selectedVehicleId = '';
  selectedDriverId = '';
  assignedDate = localDateString();
  loading = true;
  saving = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private readonly directories: DirectoryService,
    readonly rolePermissions: RolePermissionService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    try {
      const [vehicles, employees, assignments] = await Promise.all([
        firstValueFrom(this.directories.getDirectory('vehicles')),
        firstValueFrom(this.directories.getDirectory('employees')),
        firstValueFrom(this.directories.getDirectory('vehicle-assignments'))
      ]);
      this.vehicles = vehicles.records.filter((record) => this.rolePermissions.canAccessRecord('vehicles', record));
      this.employees = employees.records.filter((record) =>
        this.rolePermissions.canAccessRecord('employees', record) && this.isDriver(record)
      );
      this.assignments = assignments.records.filter((record) => this.rolePermissions.canAccessRecord('vehicle-assignments', record));
      this.errorMessage = '';
    } catch {
      this.errorMessage = 'Vehicle, driver, or assignment records could not be loaded. Please refresh to try again.';
    } finally {
      this.loading = false;
    }
  }

  get selectedVehicle(): FleetRecord | undefined {
    return this.vehicles.find((vehicle) => String(vehicle['_demoId'] ?? '') === this.selectedVehicleId);
  }

  get selectedDriver(): FleetRecord | undefined {
    return this.employees.find((employee) => String(employee['_demoId'] ?? '') === this.selectedDriverId);
  }

  get availableVehicles(): FleetRecord[] {
    const assignedIds = new Set(this.assignments
      .filter((assignment) => assignment['status'] === 'Assigned')
      .map((assignment) => String(assignment['vehicleId'] ?? '')));
    return this.vehicles.filter((vehicle) =>
      String(vehicle['status'] ?? '').toLowerCase() === 'active' &&
      !assignedIds.has(String(vehicle['_demoId'] ?? ''))
    );
  }

  get availableDrivers(): FleetRecord[] {
    const assignedIds = new Set(this.assignments
      .filter((assignment) => assignment['status'] === 'Assigned')
      .map((assignment) => String(assignment['employeeId'] ?? assignment['driverId'] ?? '')));
    return this.employees.filter((employee) =>
      String(employee['status'] ?? '').toLowerCase() === 'active' &&
      !assignedIds.has(String(employee['_demoId'] ?? ''))
    );
  }

  get assignmentGridRows(): object[] {
    return this.assignments.map((assignment) => {
      const vehicle = this.vehicleFor(assignment);
      const driver = this.driverFor(assignment);
      return {
        _demoId: assignment['_demoId'] ?? '',
        vehicle: vehicle?.['vehicle'] || 'Vehicle record unavailable',
        type: vehicle?.['type'] || '—',
        state: vehicle?.['state'] || '—',
        capacity: vehicle?.['capacityKg'] ? `${vehicle['capacityKg']} kg` : '—',
        driver: driver?.['employee'] || 'Driver employee record unavailable',
        licenseNo: driver?.['licenseNo'] || '—',
        licenseDue: driver?.['licenseDueDate'] || '—',
        assigned: assignment['assignedDate'] || '—',
        returned: assignment['returnedDate'] || '—',
        status: assignment['status'] ?? ''
      };
    });
  }

  get assignmentGridColumns(): ColDef[] {
    return [
      { field: 'vehicle', headerName: 'VEHICLE' },
      { field: 'type', headerName: 'TYPE' },
      { field: 'state', headerName: 'STATE' },
      { field: 'capacity', headerName: 'CAPACITY' },
      { field: 'driver', headerName: 'DRIVER' },
      { field: 'licenseNo', headerName: 'LICENSE NO.' },
      { field: 'licenseDue', headerName: 'LICENSE DUE' },
      { field: 'assigned', headerName: 'ASSIGNED' },
      { field: 'returned', headerName: 'RETURNED' },
      { field: 'status', headerName: 'STATUS' },
      {
        headerName: 'ACTION',
        sortable: false,
        filter: false,
        autoHeight: true,
        wrapText: true,
        cellRenderer: GridActionsCellComponent,
        valueGetter: (params) => params.data?.['status'] === 'Assigned' &&
          this.rolePermissions.can('vehicle-assignments', 'transition')
          ? [{ label: 'Return vehicle', action: 'return', disabled: this.saving }]
          : [{ label: '—', action: 'none', disabled: true }],
        cellRendererParams: {
          onAction: (action: string, row: Record<string, unknown>) => {
            if (action !== 'return') return;
            const assignment = this.assignments.find((item) => item['_demoId'] === row['_demoId']);
            if (assignment) void this.returnAssignment(assignment);
          }
        }
      }
    ];
  }

  vehicleFor(assignment: FleetRecord): FleetRecord | undefined {
    return this.vehicles.find((vehicle) => vehicle['_demoId'] === assignment['vehicleId']);
  }

  driverFor(assignment: FleetRecord): FleetRecord | undefined {
    const employeeId = assignment['employeeId'] ?? assignment['driverId'];
    return this.employees.find((employee) => employee['_demoId'] === employeeId);
  }

  async createAssignment(): Promise<void> {
    if (!this.rolePermissions.can('vehicle-assignments', 'create') || this.saving) return;
    const vehicle = this.availableVehicles.find((item) => item['_demoId'] === this.selectedVehicleId);
    const employee = this.availableDrivers.find((item) => item['_demoId'] === this.selectedDriverId);
    if (!vehicle || !employee || !this.assignedDate) {
      this.errorMessage = 'Select an available vehicle, an available driver, and an assignment date.';
      this.successMessage = '';
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      const saved = await firstValueFrom(this.directories.createRecord('vehicle-assignments', {
        vehicleId: String(vehicle['_demoId']),
        employeeId: String(employee['_demoId']),
        assignedDate: this.assignedDate,
        returnedDate: '',
        status: 'Assigned',
        location: String(vehicle['location'] ?? '')
      }));
      this.assignments = [...this.assignments, saved];
      this.selectedVehicleId = '';
      this.selectedDriverId = '';
      this.assignedDate = localDateString();
      this.successMessage = `${vehicle['vehicle']} assigned to ${employee['employee']}. Vehicle particulars are linked to the employee record.`;
    } catch {
      this.errorMessage = 'The vehicle assignment could not be saved. Please try again.';
    } finally {
      this.saving = false;
    }
  }

  async returnAssignment(assignment: FleetRecord): Promise<void> {
    const id = String(assignment['_demoId'] ?? '');
    if (!id || !this.rolePermissions.can('vehicle-assignments', 'transition') || this.saving) return;
    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      const returned = await firstValueFrom(this.directories.updateRecord('vehicle-assignments', id, {
        ...assignment,
        returnedDate: localDateString(),
        status: 'Returned'
      }));
      this.assignments = this.assignments.map((item) => item['_demoId'] === id ? returned : item);
      this.successMessage = 'Assignment closed. The vehicle and driver are available for another assignment.';
    } catch {
      this.errorMessage = 'The assignment could not be closed. Please try again.';
    } finally {
      this.saving = false;
    }
  }

  private isDriver(employee: FleetRecord): boolean {
    return String(employee['department'] ?? '').trim().toLowerCase() === 'driver' ||
      String(employee['designation'] ?? '').trim().toLowerCase() === 'driver';
  }
}
