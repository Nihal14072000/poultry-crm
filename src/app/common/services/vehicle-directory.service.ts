import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { DirectoryResponse } from '../models/directory.model';

interface VehicleApiRecord {
  id: number;
  name?: string | null;
  vehNumber?: string | null;
  registrationNo?: string | null;
  regValidity?: string | null;
  insuranceNo?: string | null;
  insuranceValidity?: string | null;
  isActive?: boolean;
  isDeleted?: boolean;
}

interface VehicleWriteRequest {
  name: string;
  vehNumber: string;
  registrationNo: string;
  regValidity: string | null;
  insuranceNo: string;
  insuranceValidity: string | null;
  isActive: boolean;
  id?: number;
}

@Injectable({ providedIn: 'root' })
export class VehicleDirectoryService {
  private readonly endpoint = 'http://localhost:8080/api/vehicles';

  constructor(private readonly http: HttpClient) {}

  getDirectory(): Observable<DirectoryResponse> {
    return this.http.get<VehicleApiRecord[]>(this.endpoint).pipe(map((vehicles) => {
      if (!Array.isArray(vehicles)) throw new Error('The vehicles API returned an invalid response.');
      return { records: vehicles.filter((vehicle) => !vehicle.isDeleted).map((vehicle) => this.toDirectoryRecord(vehicle)) };
    }));
  }

  createRecord(record: Record<string, string | number>): Observable<Record<string, string | number>> {
    return this.http.post<VehicleApiRecord>(this.endpoint, this.toRequest(record)).pipe(map((vehicle) => this.toDirectoryRecord(vehicle)));
  }

  updateRecord(id: string, record: Record<string, string | number>): Observable<Record<string, string | number>> {
    const vehicleId = this.parseId(id);
    return this.http.put<VehicleApiRecord>(`${this.endpoint}/${encodeURIComponent(id)}`, {
      ...this.toRequest(record),
      id: vehicleId
    }).pipe(map((vehicle) => this.toDirectoryRecord(vehicle)));
  }

  deleteRecord(id: string): Observable<void> {
    this.parseId(id);
    return this.http.delete<void>(`${this.endpoint}/${encodeURIComponent(id)}`);
  }

  private toDirectoryRecord(vehicle: VehicleApiRecord): Record<string, string | number> {
    if (!Number.isSafeInteger(vehicle.id) || vehicle.id < 1 || typeof vehicle.name !== 'string' ||
      typeof vehicle.vehNumber !== 'string' || typeof vehicle.isActive !== 'boolean') {
      throw new Error('The vehicles API returned an invalid vehicle record.');
    }
    return {
      _demoId: String(vehicle.id),
      vehicle: vehicle.vehNumber ?? '',
      type: vehicle.name ?? '',
      registrationNo: vehicle.registrationNo ?? '',
      registrationDueDate: vehicle.regValidity ?? '',
      insuranceNo: vehicle.insuranceNo ?? '',
      insuranceDueDate: vehicle.insuranceValidity ?? '',
      status: vehicle.isActive ? 'Active' : 'Inactive'
    };
  }

  private toRequest(record: Record<string, string | number>): VehicleWriteRequest {
    const vehicleNumber = String(record['vehicle'] ?? '').trim();
    const name = String(record['type'] ?? '').trim();
    const status = String(record['status'] ?? '').trim().toLowerCase();
    if (!vehicleNumber || !name || !['active', 'inactive'].includes(status)) {
      throw new Error('A vehicle number, vehicle name, and valid active status are required.');
    }
    return {
      name,
      vehNumber: vehicleNumber,
      registrationNo: String(record['registrationNo'] ?? '').trim(),
      regValidity: String(record['registrationDueDate'] ?? '').trim() || null,
      insuranceNo: String(record['insuranceNo'] ?? '').trim(),
      insuranceValidity: String(record['insuranceDueDate'] ?? '').trim() || null,
      isActive: status === 'active'
    };
  }

  private parseId(id: string): number {
    const parsed = Number(id);
    if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error('The vehicle ID is invalid.');
    return parsed;
  }
}
