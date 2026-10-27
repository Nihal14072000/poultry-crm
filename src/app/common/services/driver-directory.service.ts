import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DirectoryResponse, Employee } from '../models/directory.model';

interface DriverWriteRequest {
  name: string;
  address: string;
  number: string;
  type?: string;
  status: string;
  isActive: boolean;
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
    const request = this.toRequest(record);
    if (request.name.length > 100 || request.name.includes(':')) {
      return throwError(() => new Error('Employee name must be at most 100 characters and cannot contain a colon.'));
    }
    const endpoint = request.type === 'DRIVER'
      ? `${environment.apiUrl}/drivers`
      : request.type === 'SUPERVISOR'
        ? `${environment.apiUrl}/supervisors`
        : this.endpoint;
    if (request.type === 'DRIVER' || request.type === 'SUPERVISOR') delete request.type;
    return this.http.post<Employee>(endpoint, request).pipe(map((employee) => this.toDirectoryRecord(employee)));
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
      status: employee.status.toLowerCase() === 'active'
        ? 'Active'
        : employee.status.toLowerCase() === 'inactive' ? 'Inactive' : employee.status,
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
      status: status === 'active' ? 'ACTIVE' : 'INACTIVE',
      isActive: status === 'active'
    };
  }

  private parseId(id: string): number {
    const parsed = Number(id);
    if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error('The employee ID is invalid.');
    return parsed;
  }

}
