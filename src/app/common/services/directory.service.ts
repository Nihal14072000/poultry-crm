import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BusinessDataService } from './business-data.service';
import { DirectoryResponse } from '../models/directory.model';

@Injectable({ providedIn: 'root' })
export class DirectoryService {
  constructor(private readonly data: BusinessDataService) {}

  getDirectory(resource: string): Observable<DirectoryResponse> {
    return this.data.get<DirectoryResponse>(resource);
  }

  createRecord(resource: string, record: Record<string, string | number>): Observable<Record<string, string | number>> {
    return this.data.create(resource, record);
  }

  updateRecord(resource: string, id: string, record: Record<string, string | number>): Observable<Record<string, string | number>> {
    return this.data.update(resource, id, record);
  }

  deleteRecord(resource: string, id: string): Observable<void> {
    return this.data.delete(resource, id);
  }
}
