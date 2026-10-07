import { JsonFileAdapter } from './json-file.adapter';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

describe('JsonFileAdapter demo data restoration', () => {
  let adapter: JsonFileAdapter;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        JsonFileAdapter,
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    });
    adapter = TestBed.inject(JsonFileAdapter);
  });

  it('restores fixture rows from an empty legacy cache', () => {
    localStorage.setItem('flockwise.demo.farms', JSON.stringify([]));

    let records: Record<string, string | number>[] = [];
    adapter.get<{ records: Record<string, string | number>[] }>('farms').subscribe((response) => {
      records = response.records;
    });

    expect(records.length).toBeGreaterThan(0);
    expect(records[0]['name']).toBe('Greenfield North');
    expect(localStorage.getItem('flockwise.demo.initialized.farms')).toBe('true');
  });

  it('preserves an intentionally empty cache after it is marked initialized', () => {
    localStorage.setItem('flockwise.demo.farms', JSON.stringify([]));
    localStorage.setItem('flockwise.demo.initialized.farms', 'true');

    let records: Record<string, string | number>[] = [{ name: 'placeholder' }];
    adapter.get<{ records: Record<string, string | number>[] }>('farms').subscribe((response) => {
      records = response.records;
    });

    expect(records).toEqual([]);
  });

  it('migrates cached dollar values and USD currency settings to rupees', () => {
    localStorage.setItem('flockwise.demo.farms', JSON.stringify([
      { name: 'Greenfield North', total: '$4,280', currency: 'USD', _demoId: 'farms-1' }
    ]));

    let record: Record<string, string | number> | undefined;
    adapter.get<{ records: Record<string, string | number>[] }>('farms').subscribe((response) => {
      record = response.records[0];
    });

    expect(record?.['total']).toBe('₹4,280');
    expect(record?.['currency']).toBe('INR');
  });

  it('migrates saved fleet entries into linked vehicle, employee, and assignment records', () => {
    localStorage.setItem('flockwise.demo.fleet', JSON.stringify([
      {
        vehicle: 'MH-12-AB-4521',
        driver: 'S. Jadhav',
        capacity: '2,000 kg',
        location: 'Nashik',
        status: 'In transit',
        _demoId: 'fleet-1'
      }
    ]));

    let vehicle: Record<string, string | number> | undefined;
    let driverEmployee: Record<string, string | number> | undefined;
    let assignment: Record<string, string | number> | undefined;
    adapter.get<{ records: Record<string, string | number>[] }>('vehicles').subscribe((response) => {
      vehicle = response.records[0];
    });
    adapter.get<{ records: Record<string, string | number>[] }>('employees').subscribe((response) => {
      driverEmployee = response.records.find((record) => record['department'] === 'Driver');
    });
    adapter.get<{ records: Record<string, string | number>[] }>('vehicle-assignments').subscribe((response) => {
      assignment = response.records[0];
    });

    expect(vehicle?.['vehicle']).toBe('MH-12-AB-4521');
    expect(vehicle?.['capacityKg']).toBe(2000);
    expect(vehicle?.['driver']).toBeUndefined();
    expect(driverEmployee?.['employee']).toBe('S. Jadhav');
    expect(driverEmployee?.['designation']).toBe('Driver');
    expect(assignment?.['vehicleId']).toBe(vehicle?.['_demoId']);
    expect(assignment?.['employeeId']).toBe(driverEmployee?.['_demoId']);
  });

  it('merges saved driver records into employees and remaps assignments', () => {
    localStorage.setItem('flockwise.demo.drivers', JSON.stringify([
      { driver: 'Alex Driver', phone: '+91 98765 43210', licenseNo: 'MH1520990011223', licenseDueDate: '2027-08-31', status: 'Active', _demoId: 'drivers-1' }
    ]));
    localStorage.setItem('flockwise.demo.vehicle-assignments', JSON.stringify([
      { vehicleId: 'vehicles-1', driverId: 'drivers-1', assignedDate: '2026-09-01', status: 'Assigned', _demoId: 'vehicle-assignments-1' }
    ]));

    let driverEmployee: Record<string, string | number> | undefined;
    let assignment: Record<string, string | number> | undefined;
    adapter.get<{ records: Record<string, string | number>[] }>('employees').subscribe((response) => {
      driverEmployee = response.records.find((record) => record['employee'] === 'Alex Driver');
    });
    adapter.get<{ records: Record<string, string | number>[] }>('vehicle-assignments').subscribe((response) => {
      assignment = response.records[0];
    });

    expect(driverEmployee?.['department']).toBe('Driver');
    expect(driverEmployee?.['designation']).toBe('Driver');
    expect(driverEmployee?.['licenseNo']).toBe('MH1520990011223');
    expect(assignment?.['employeeId']).toBe(driverEmployee?.['_demoId']);
    expect(assignment?.['driverId']).toBeUndefined();
  });
});
