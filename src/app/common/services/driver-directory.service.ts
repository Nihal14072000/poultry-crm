import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DirectoryResponse, Employee } from '../models/directory.model';

interface DriverWriteRequest {
  name: string;
  address: string;
  number: string;
  type: string;
  status: string;
  isActive: boolean;
  isDeleted: boolean;
}

@Injectable({ providedIn: 'root' })
export class DriverDirectoryService {
  private readonly endpoint = `${environment.apiUrl}/employees`;

  constructor(private readonly http: HttpClient) {}

  getDirectory(): Observable<DirectoryResponse> {
    return this.http.get<Employee[]>(this.endpoint).pipe(map((employees) => {
      if (!Array.isArray(employees)) throw new Error('The employees API returned an invalid response.');
      return { records: employees.filter((employee) => !employee.isDeleted).map((employee) => this.toDirectoryRecord(employee)) };
    }));
  }

  createRecord(record: Record<string, string | number>): Observable<Record<string, string | number>> {
    return this.http.post<Employee>(this.endpoint, this.toRequest(record)).pipe(map((employee) => this.toDirectoryRecord(employee)));
  }

  updateRecord(id: string, record: Record<string, string | number>): Observable<Record<string, string | number>> {
    const employeeId = this.parseId(id);
    return this.http.put<Employee>(`${this.endpoint}/${encodeURIComponent(id)}`, {
      ...this.toRequest(record),
      id: employeeId
    }).pipe(map((employee) => this.toDirectoryRecord(employee)));
  }

  deleteRecord(id: string): Observable<void> {
    this.parseId(id);
    return this.http.delete<void>(`${this.endpoint}/${encodeURIComponent(id)}`);
  }

  private toDirectoryRecord(employee: Employee): Record<string, string | number> {
    if (!Number.isSafeInteger(employee.id) || employee.id < 1 || typeof employee.name !== 'string' ||
      typeof employee.address !== 'string' || typeof employee.number !== 'string' || typeof employee.type !== 'string' ||
      typeof employee.status !== 'string' || typeof employee.isActive !== 'boolean' ||
      typeof employee.isDeleted !== 'boolean') {
      throw new Error('The employees API returned an invalid employee record.');
    }
    return {
      _demoId: String(employee.id),
      id: employee.id,
      name: employee.name,
      address: employee.address,
      number: employee.number,
      type: employee.type,
      status: employee.status,
      createDate: employee.createDate ?? '',
      updatedDate: employee.updatedDate ?? '',
      createdBy: employee.createdBy ?? '',
      updatedBy: employee.updatedBy ?? ''
    };
  }

  private toRequest(record: Record<string, string | number>): DriverWriteRequest {
    const name = String(record['name'] ?? '').trim();
    const type = String(record['type'] ?? '').trim().toUpperCase();
    const status = String(record['status'] ?? '').trim().toLowerCase();
    if (!name || !['DRIVER', 'SUPERVISOR', 'ACCOUNTANT'].includes(type) || !['active', 'inactive'].includes(status)) {
      throw new Error('An employee name, valid type, and active status are required.');
    }
    return {
      name,
      address: String(record['address'] ?? '').trim(),
      number: String(record['number'] ?? '').trim(),
      type,
      status: status === 'active' ? 'Active' : 'Inactive',
      isActive: status === 'active',
      isDeleted: false
    };
  }

  private parseId(id: string): number {
    const parsed = Number(id);
    if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error('The employee ID is invalid.');
    return parsed;
  }
}
