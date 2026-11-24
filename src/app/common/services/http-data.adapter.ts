import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DataAdapter } from './data-adapter';

@Injectable()
export class HttpDataAdapter extends DataAdapter {
  private readonly baseUrl = environment.apiUrl.replace(/\/+$/, '');

  constructor(private readonly http: HttpClient) {
    super();
  }

  override get<T>(resource: string): Observable<T> {
    return this.http.get<unknown>(this.resourceUrl(resource)).pipe(
      map((response) => {
        if (Array.isArray(response)) {
          return { records: response } as T;
        }
        return response as T;
      })
    );
  }

  override create(
    resource: string,
    record: Record<string, string | number>
  ): Observable<Record<string, string | number>> {
    return this.http.post<Record<string, string | number>>(this.resourceUrl(resource), record);
  }

  override update(
    resource: string,
    id: string,
    record: Record<string, string | number>
  ): Observable<Record<string, string | number>> {
    return this.http.put<Record<string, string | number>>(
      \`\${this.resourceUrl(resource)}/\${encodeURIComponent(id)}\`,
      record
    );
  }

  override delete(resource: string, id: string): Observable<void> {
    return this.http.delete<void>(
      \`\${this.resourceUrl(resource)}/\${encodeURIComponent(id)}\`
    );
  }

  private resourceUrl(resource: string): string {
    const normalizedResource = resource.trim().replace(/^\/+|\/+$/g, '');
    if (!normalizedResource || normalizedResource.includes('..')) {
      throw new Error('A valid API resource name is required.');
    }
    return \`\${this.baseUrl}/\${normalizedResource.split('/').map(encodeURIComponent).join('/')}\`;
  }
}
