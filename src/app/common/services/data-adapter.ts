import { Observable } from 'rxjs';

export abstract class DataAdapter {
  abstract get<T>(resource: string): Observable<T>;
  abstract create(resource: string, record: Record<string, string | number>): Observable<Record<string, string | number>>;
  abstract update(resource: string, id: string, record: Record<string, string | number>): Observable<Record<string, string | number>>;
  abstract delete(resource: string, id: string): Observable<void>;
}
