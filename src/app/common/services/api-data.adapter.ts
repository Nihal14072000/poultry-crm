import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DataAdapter } from './data-adapter';

@Injectable()
export class ApiDataAdapter extends DataAdapter {
  constructor(private readonly http: HttpClient) {
    super();
  }

  override get<T>(resource: string): Observable<T> {
    return this.http.get<T>(`/api/v1/${resource}`, { params: new HttpParams() });
  }

  override create(resource: string, record: Record<string, string | number>): Observable<Record<string, string | number>> {
    return this.http.post<Record<string, string | number>>(`/api/v1/${resource}`, record);
  }

  override update(resource: string, id: string, record: Record<string, string | number>): Observable<Record<string, string | number>> {
    return this.http.put<Record<string, string | number>>(`/api/v1/${resource}/${encodeURIComponent(id)}`, record);
  }

  override delete(resource: string, id: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/${resource}/${encodeURIComponent(id)}`);
  }
}
