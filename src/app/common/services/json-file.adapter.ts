import { Injectable } from '@angular/core';
import { Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of, throwError } from 'rxjs';
import { DataAdapter } from './data-adapter';
import dashboard from '../../../assets/mock-data/dashboard.json';
import farms from '../../../assets/mock-data/farms.json';
import batches from '../../../assets/mock-data/batches.json';
import sheds from '../../../assets/mock-data/sheds.json';
import inventory from '../../../assets/mock-data/inventory.json';
import customers from '../../../assets/mock-data/customers.json';
import sales from '../../../assets/mock-data/sales.json';
import procurement from '../../../assets/mock-data/procurement.json';
import feedHealth from '../../../assets/mock-data/feed-health.json';
import reports from '../../../assets/mock-data/reports.json';
import finance from '../../../assets/mock-data/finance.json';
import moduleFixtures from '../../../assets/mock-data/business-modules.json';

@Injectable()
export class JsonFileAdapter extends DataAdapter {
  private readonly browser: boolean;
  private readonly fixtures: Record<string, unknown> = {
    dashboard, farms, sheds, batches, inventory, customers, sales, procurement, 'feed-health': feedHealth, reports, finance,
    ...moduleFixtures
  };

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    super();
    this.browser = isPlatformBrowser(platformId);
  }

  override get<T>(resource: string): Observable<T> {
    try {
      const fixture = this.fixtures[resource];
      if (fixture === undefined) {
        return throwError(() => new Error(`No local fixture is configured for "${resource}".`));
      }
      const records = this.readRecords(resource);
      if (records) {
        const response = fixture as { [key: string]: unknown };
        return of({ ...response, records } as T);
      }
      return of(fixture as T);
    } catch (error) {
      return throwError(() => error);
    }
  }

  override create(resource: string, record: Record<string, string | number>): Observable<Record<string, string | number>> {
    try {
      const records = this.readRecords(resource);
      if (!records) return throwError(() => new Error(`Resource "${resource}" does not support local record changes.`));
      const created = { ...record, _demoId: this.newId() };
      this.writeRecords(resource, [...records, created]);
      return of(created);
    } catch (error) {
      return throwError(() => error);
    }
  }

  override update(resource: string, id: string, record: Record<string, string | number>): Observable<Record<string, string | number>> {
    try {
      const records = this.readRecords(resource);
      if (!records) return throwError(() => new Error(`Resource "${resource}" does not support local record changes.`));
      const index = records.findIndex((item) => this.recordId(item) === id);
      if (index < 0) return throwError(() => new Error(`Record "${id}" was not found in "${resource}".`));
      const updated = { ...record, _demoId: id };
      records[index] = updated;
      this.writeRecords(resource, records);
      return of(updated);
    } catch (error) {
      return throwError(() => error);
    }
  }

  override delete(resource: string, id: string): Observable<void> {
    try {
      const records = this.readRecords(resource);
      if (!records) return throwError(() => new Error(`Resource "${resource}" does not support local record changes.`));
      const nextRecords = records.filter((item) => this.recordId(item) !== id);
      if (nextRecords.length === records.length) {
        return throwError(() => new Error(`Record "${id}" was not found in "${resource}".`));
      }
      this.writeRecords(resource, nextRecords);
      return of(void 0);
    } catch (error) {
      return throwError(() => error);
    }
  }

  private readRecords(resource: string): Record<string, string | number>[] | null {
    if (!this.browser) return null;
    const stored = localStorage.getItem(this.storageKey(resource));
    if (stored !== null) {
      const parsed: unknown = JSON.parse(stored);
      if (!Array.isArray(parsed)) throw new Error(`Saved demo data for "${resource}" is invalid.`);
      const migrated = this.migrateCurrency(parsed as Record<string, string | number>[]);
      if (migrated.changed) this.writeRecords(resource, migrated.records);
      const wasInitialized = localStorage.getItem(this.initializedKey(resource)) === 'true';
      if (migrated.records.length === 0 && !wasInitialized) {
        const fixtureRecords = this.fixtureRecords(resource);
        if (fixtureRecords?.length) {
          const seeded = this.migrateResourceRecords(resource, this.seedRecords(resource, fixtureRecords));
          this.writeRecords(resource, seeded);
          return seeded;
        }
      }
      if (!wasInitialized) localStorage.setItem(this.initializedKey(resource), 'true');
      const resourceRecords = this.migrateResourceRecords(resource, migrated.records);
      if (resourceRecords !== migrated.records) this.writeRecords(resource, resourceRecords);
      return resourceRecords;
    }
    const migrated = this.migrateLegacyFleet(resource);
    if (migrated) {
      const resourceRecords = this.migrateResourceRecords(resource, migrated);
      this.writeRecords(resource, resourceRecords);
      return resourceRecords;
    }
    const fixtureRecords = this.fixtureRecords(resource);
    if (!fixtureRecords) return null;
    const seeded = this.migrateResourceRecords(resource, this.seedRecords(resource, fixtureRecords));
    this.writeRecords(resource, seeded);
    return seeded;
  }

  private writeRecords(resource: string, records: Record<string, string | number>[]): void {
    if (!this.browser) throw new Error('Local demo changes can only be saved in a browser.');
    localStorage.setItem(this.storageKey(resource), JSON.stringify(records));
    localStorage.setItem(this.initializedKey(resource), 'true');
  }

  private fixtureRecords(resource: string): Record<string, string | number>[] | undefined {
    const fixture = this.fixtures[resource] as { records?: Record<string, string | number>[] } | undefined;
    return fixture?.records;
  }

  private migrateLegacyFleet(resource: string): Record<string, string | number>[] | null {
    if (!['vehicles', 'drivers', 'vehicle-assignments'].includes(resource)) return null;
    const storedFleet = localStorage.getItem(this.storageKey('fleet'));
    if (storedFleet === null) return null;
    const parsed: unknown = JSON.parse(storedFleet);
    if (!Array.isArray(parsed)) throw new Error('Saved demo fleet data is invalid.');
    const fleet = parsed as Record<string, string | number>[];
    const vehicles = fleet.map((record, index) => {
      const vehicle: Record<string, string | number> = {
        ...record,
        _demoId: `vehicles-legacy-${index + 1}`,
        capacityKg: this.numberFromValue(record['capacity'])
      };
      delete vehicle['driver'];
      delete vehicle['driverPhone'];
      delete vehicle['licenseNo'];
      delete vehicle['licenseDueDate'];
      delete vehicle['capacity'];
      vehicle['status'] = String(record['status'] ?? '').toLowerCase() === 'sold' ? 'Sold' : 'Active';
      if (vehicle['rePassingDate'] !== undefined) {
        vehicle['rePassingDueDate'] = vehicle['rePassingDate'];
        delete vehicle['rePassingDate'];
      }
      return vehicle;
    });
    const names = [...new Set(fleet.map((record) => String(record['driver'] ?? '').trim()).filter(Boolean))];
    const drivers = names.map((name, index) => {
      const source = fleet.find((record) => String(record['driver'] ?? '').trim() === name) ?? {};
      return {
        employee: name,
        department: 'Driver',
        designation: 'Driver',
        phone: source['driverPhone'] ?? '',
        licenseNo: source['licenseNo'] ?? '',
        licenseDueDate: source['licenseDueDate'] ?? '',
        location: source['location'] ?? '',
        status: 'Active',
        _demoId: `drivers-legacy-${index + 1}`
      };
    });
    if (resource === 'vehicles') return vehicles;
    if (resource === 'drivers') return drivers;
    return fleet.flatMap((record, index) => {
      const driverIndex = names.indexOf(String(record['driver'] ?? '').trim());
      if (driverIndex < 0) return [];
      return [{
        vehicleId: `vehicles-legacy-${index + 1}`,
        employeeId: `drivers-legacy-${driverIndex + 1}`,
        assignedDate: record['assignedDate'] ?? '',
        returnedDate: '',
        status: 'Assigned',
        location: String(record['location'] ?? ''),
        _demoId: `vehicle-assignments-legacy-${index + 1}`
      }];
    });
  }

  private migrateResourceRecords(resource: string, records: Record<string, string | number>[]): Record<string, string | number>[] {
    if (resource === 'employees') return this.mergeLegacyDrivers(records);
    if (resource !== 'vehicle-assignments') return records;
    const mapping = this.readDriverEmployeeMap();
    let changed = false;
    const migrated = records.map((record) => {
      const legacyDriverId = String(record['driverId'] ?? '');
      const employeeId = String(record['employeeId'] ?? legacyDriverId);
      const mappedEmployeeId = mapping[employeeId] ?? employeeId;
      if (!employeeId || (record['employeeId'] === mappedEmployeeId && record['driverId'] === undefined)) return record;
      changed = true;
      const current = { ...record };
      delete current['driverId'];
      return {
        ...current,
        employeeId: mappedEmployeeId
      };
    });
    if (changed) this.writeRecords(resource, migrated);
    return migrated;
  }

  private mergeLegacyDrivers(employees: Record<string, string | number>[]): Record<string, string | number>[] {
    const migrationKey = 'flockwise.demo.drivers-merged';
    if (localStorage.getItem(migrationKey) === 'true') return employees;
    const storedDrivers = localStorage.getItem(this.storageKey('drivers'));
    const storedFleet = localStorage.getItem(this.storageKey('fleet'));
    if (storedDrivers === null && storedFleet === null) return employees;

    let legacyDrivers: Record<string, string | number>[];
    if (storedDrivers !== null) {
      const parsed: unknown = JSON.parse(storedDrivers);
      if (!Array.isArray(parsed)) throw new Error('Saved demo driver data is invalid.');
      legacyDrivers = parsed as Record<string, string | number>[];
    } else {
      const parsed: unknown = JSON.parse(storedFleet ?? '[]');
      if (!Array.isArray(parsed)) throw new Error('Saved demo fleet data is invalid.');
      const fleet = parsed as Record<string, string | number>[];
      const names = [...new Set(fleet.map((record) => String(record['driver'] ?? '').trim()).filter(Boolean))];
      legacyDrivers = names.map((name, index) => {
        const source = fleet.find((record) => String(record['driver'] ?? '').trim() === name) ?? {};
        return {
          employee: name,
          phone: source['driverPhone'] ?? '',
          licenseNo: source['licenseNo'] ?? '',
          licenseDueDate: source['licenseDueDate'] ?? '',
          location: source['location'] ?? '',
          status: 'Active',
          _demoId: `drivers-legacy-${index + 1}`
        };
      });
    }

    const nextEmployees = [...employees];
    const employeeIdsByLegacyId: Record<string, string> = {};
    legacyDrivers.forEach((legacyDriver, index) => {
      const name = String(legacyDriver['employee'] ?? legacyDriver['driver'] ?? '').trim();
      if (!name) return;
      const phone = String(legacyDriver['phone'] ?? legacyDriver['driverPhone'] ?? '').trim();
      const licenseNo = String(legacyDriver['licenseNo'] ?? '').trim();
      let existingIndex = nextEmployees.findIndex((employee) =>
        (phone && String(employee['phone'] ?? '').trim() === phone) ||
        (licenseNo && String(employee['licenseNo'] ?? '').trim() === licenseNo) ||
        String(employee['employee'] ?? '').trim().toLocaleLowerCase() === name.toLocaleLowerCase()
      );
      const legacyId = String(legacyDriver['_demoId'] ?? `drivers-legacy-${index + 1}`);
      if (existingIndex < 0) {
        nextEmployees.push({
          ...legacyDriver,
          employee: name,
          department: 'Driver',
          designation: 'Driver',
          phone,
          licenseNo,
          licenseDueDate: legacyDriver['licenseDueDate'] ?? '',
          _demoId: legacyId
        });
        existingIndex = nextEmployees.length - 1;
      } else {
        nextEmployees[existingIndex] = {
          ...nextEmployees[existingIndex],
          department: 'Driver',
          designation: 'Driver',
          licenseNo: nextEmployees[existingIndex]['licenseNo'] || licenseNo,
          licenseDueDate: nextEmployees[existingIndex]['licenseDueDate'] || legacyDriver['licenseDueDate'] || ''
        };
      }
      employeeIdsByLegacyId[legacyId] = String(nextEmployees[existingIndex]['_demoId'] ?? '');
    });
    localStorage.setItem('flockwise.demo.driver-employee-map', JSON.stringify(employeeIdsByLegacyId));
    localStorage.setItem(migrationKey, 'true');
    return nextEmployees;
  }

  private readDriverEmployeeMap(): Record<string, string> {
    const serialized = localStorage.getItem('flockwise.demo.driver-employee-map');
    if (!serialized) return {};
    const parsed: unknown = JSON.parse(serialized);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('Saved driver-to-employee migration data is invalid.');
    }
    return parsed as Record<string, string>;
  }

  private numberFromValue(value: string | number | undefined): number {
    const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private seedRecords(resource: string, records: Record<string, string | number>[]): Record<string, string | number>[] {
    return records.map((record, index) => ({ ...record, _demoId: `${resource}-${index + 1}` }));
  }

  private migrateCurrency(records: Record<string, string | number>[]): {
    records: Record<string, string | number>[];
    changed: boolean;
  } {
    let changed = false;
    const migrated = records.map((record) => {
      const next = Object.fromEntries(Object.entries(record).map(([key, value]) => {
        if (typeof value === 'string' && value.includes('$')) {
          changed = true;
          return [key, value.replace(/\$/g, '₹')];
        }
        if (key === 'currency' && value === 'USD') {
          changed = true;
          return [key, 'INR'];
        }
        return [key, value];
      }));
      return next as Record<string, string | number>;
    });
    return { records: migrated, changed };
  }

  private storageKey(resource: string): string {
    return `flockwise.demo.${resource}`;
  }

  private initializedKey(resource: string): string {
    return `flockwise.demo.initialized.${resource}`;
  }

  private recordId(record: Record<string, string | number>): string {
    return String(record['_demoId'] ?? '');
  }

  private newId(): string {
    return `demo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
