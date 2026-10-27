import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DriverDirectoryService } from './driver-directory.service';

describe('DriverDirectoryService', () => {
  let service: DriverDirectoryService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DriverDirectoryService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(DriverDirectoryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('maps backend employees to the directory and hides deleted employees', () => {
    let records: Record<string, string | number>[] = [];
    service.getDirectory().subscribe((response) => records = response.records);

    const request = http.expectOne('http://localhost:8080/api/employees');
    expect(request.request.method).toBe('GET');
    request.flush([
      {
        id: 12, name: 'Asha Patil', address: 'Nashik', number: 'DL-12', type: 'DRIVER', status: 'Active',
        isActive: true, isDeleted: false, createDate: '2026-10-01', updatedDate: '2026-10-02',
        createdBy: 'admin', updatedBy: 'admin'
      },
      {
        id: 13, name: 'Removed Driver', address: '', number: '', type: 'DRIVER', status: 'Active',
        isActive: true, isDeleted: true, createDate: null, updatedDate: null, createdBy: null, updatedBy: null
      }
    ]);

    expect(records).toEqual([{
      _demoId: '12',
      id: 12,
      name: 'Asha Patil',
      address: 'Nashik',
      number: 'DL-12',
      type: 'DRIVER',
      status: 'Active',
      createDate: '2026-10-01',
      updatedDate: '2026-10-02',
      createdBy: 'admin',
      updatedBy: 'admin'
    }]);
  });

  it('creates drivers through the driver endpoint without sending backend-assigned type', () => {
    service.createRecord({
      name: 'Asha Patil', address: 'Nashik', number: 'DL-12', type: 'DRIVER', status: 'Active'
    }).subscribe();
    const request = http.expectOne('http://localhost:8080/api/drivers');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'Asha Patil', address: 'Nashik', number: 'DL-12', status: 'ACTIVE',
      isActive: true
    });
    expect(request.request.body['id']).toBeUndefined();
    expect(request.request.body['createDate']).toBeUndefined();
    expect(request.request.body['updatedDate']).toBeUndefined();
    expect(request.request.body['createdBy']).toBeUndefined();
    expect(request.request.body['updatedBy']).toBeUndefined();
    request.flush({
      id: 12, name: 'Asha Patil', address: 'Nashik', number: 'DL-12', type: 'DRIVER', status: 'Active',
      isActive: true, isDeleted: false, createDate: null, updatedDate: null, createdBy: null, updatedBy: null
    });
  });

  it('uses the supervisor endpoint and keeps other employee types on the general endpoint', () => {
    service.createRecord({
      name: 'Meera Joshi', type: 'SUPERVISOR', status: 'Active'
    }).subscribe();
    const supervisor = http.expectOne('http://localhost:8080/api/supervisors');
    expect(supervisor.request.body['type']).toBeUndefined();
    supervisor.flush({
      id: 21, name: 'Meera Joshi', address: '', number: '', type: 'SUPERVISOR', status: 'Active',
      isActive: true, isDeleted: false, createDate: null, updatedDate: null, createdBy: null, updatedBy: null
    });

    service.createRecord({
      name: 'Ravi Patil', type: 'ACCOUNTANT', status: 'Active'
    }).subscribe();
    const employee = http.expectOne('http://localhost:8080/api/employees');
    expect(employee.request.body['type']).toBe('ACCOUNTANT');
    employee.flush({
      id: 22, name: 'Ravi Patil', address: '', number: '', type: 'ACCOUNTANT', status: 'Active',
      isActive: true, isDeleted: false, createDate: null, updatedDate: null, createdBy: null, updatedBy: null
    });
  });

  it('rejects employee names that cannot be used as initial Basic credentials', () => {
    let error = '';
    service.createRecord({
      name: 'Bad:Name', type: 'DRIVER', status: 'Active'
    }).subscribe({ error: (reason: Error) => error = reason.message });

    expect(error).toContain('cannot contain a colon');
    http.expectNone('http://localhost:8080/api/drivers');
  });

  it('updates and deletes drivers by backend ID', () => {
    service.updateRecord('12', {
      name: 'Asha Patil', type: 'SUPERVISOR', status: 'Inactive'
    }).subscribe();
    const update = http.expectOne('http://localhost:8080/api/employees/12');
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual({
      name: 'Asha Patil', address: '', number: '', type: 'SUPERVISOR',
      status: 'INACTIVE', isActive: false, id: 12
    });
    update.flush({
      id: 12, name: 'Asha Patil', address: '', number: '', type: 'DRIVER', status: 'Inactive',
      isActive: false, isDeleted: false, createDate: null, updatedDate: null, createdBy: null, updatedBy: null
    });

    service.deleteRecord('12').subscribe();
    const deletion = http.expectOne('http://localhost:8080/api/employees/12');
    expect(deletion.request.method).toBe('DELETE');
    deletion.flush(null);
  });
});
