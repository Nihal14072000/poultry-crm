import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiDataAdapter } from './api-data.adapter';
import { environment } from '../../../environments/environment';

describe('ApiDataAdapter', () => {
  let adapter: ApiDataAdapter;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ApiDataAdapter]
    });
    adapter = TestBed.inject(ApiDataAdapter);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads tenant-scoped resource records from the API', () => {
    let result: { records: Record<string, string | number>[] } | undefined;
    adapter.get<{ records: Record<string, string | number>[] }>('farms').subscribe(value => result = value);

    const request = http.expectOne(`${environment.apiUrl}/data/farms`);
    expect(request.request.method).toBe('GET');
    request.flush({ records: [{ _demoId: 'farm-1', name: 'North Farm' }] });
    expect(result?.records[0]['name']).toBe('North Farm');
  });

  it('uses the resource and record identifier for updates', () => {
    adapter.update('farms', 'farm/1', { name: 'Updated Farm' }).subscribe();

    const request = http.expectOne(`${environment.apiUrl}/data/farms/farm%2F1`);
    expect(request.request.method).toBe('PUT');
    request.flush({ _demoId: 'farm/1', name: 'Updated Farm' });
  });

  it('rejects malformed resource names before making a request', () => {
    expect(() => adapter.get('farms/../users')).toThrowError('A valid API resource name is required.');
    http.expectNone(() => true);
  });
});
