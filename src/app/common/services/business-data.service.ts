import { Inject, Injectable, InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { DataAdapter } from './data-adapter';

export const DATA_ADAPTER = new InjectionToken<DataAdapter>('DATA_ADAPTER');

@Injectable({ providedIn: 'root' })
export class BusinessDataService {
  constructor(@Inject(DATA_ADAPTER) private readonly adapter: DataAdapter) {}

  get<T>(resource: string): Observable<T> {
    return this.adapter.get<T>(resource);
  }

  create(resource: string, record: Record<string, string | number>): Observable<Record<string, string | number>> {
    return this.adapter.create(resource, record);
  }

  update(resource: string, id: string, record: Record<string, string | number>): Observable<Record<string, string | number>> {
    return this.adapter.update(resource, id, record);
  }

  delete(resource: string, id: string): Observable<void> {
    return this.adapter.delete(resource, id);
  }
}
