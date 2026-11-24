import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DataAdapter } from './data-adapter';

@Injectable()
export class ApiDataAdapter extends DataAdapter {
  private readonly baseUrl = environment.apiUrl.replace(/\/+$/, '');

  constructor(private readonly http: HttpClient) {
    super();
  }

  override get<T>(resource: string): Observable<T> {
    return this.http.get<unknown>(this.resourceUrl(resource)).pipe(
      map((response) => Array.isArray(response) ? ({ records: response } as T) : response as T)
    );
  }

  override create(resource: string, record: Record<string, string | number>): Observable<Record<string, string | number>> {
    return this.http.post<Record<string, string | number>>(this.resourceUrl(resource), record);
  }

  override update(resource: string, id: string, record: Record<string, string | number>): Observable<Record<string, string | number>> {
    return this.http.put<Record<string, string | number>>(
      `${this.resourceUrl(resource)}/${encodeURIComponent(id)}`, record
    );
  }

  override delete(resource: string, id: string): Observable<void> {
    return this.http.delete<void>(`${this.resourceUrl(resource)}/${encodeURIComponent(id)}`);
  }

  private resourceUrl(resource: string): string {
    const normalized = resource.trim().toLowerCase();
    if (!/^[a-z][a-z0-9-]{0,63}$/i.test(normalized)) {
      throw new Error('A valid API resource name is required.');
    }
    return `${this.baseUrl}/data/${encodeURIComponent(normalized)}`;
  }
}
