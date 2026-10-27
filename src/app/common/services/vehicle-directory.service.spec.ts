import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { VehicleDirectoryService } from './vehicle-directory.service';

describe('VehicleDirectoryService', () => {
  let service: VehicleDirectoryService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [VehicleDirectoryService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(VehicleDirectoryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('maps backend vehicles to the vehicle directory and hides deleted vehicles', () => {
    let records: Record<string, string | number>[] = [];
    service.getDirectory().subscribe((response) => records = response.records);

    const request = http.expectOne('http://localhost:8080/api/vehicles');
    expect(request.request.method).toBe('GET');
    request.flush([
      { id: 21, name: 'Refrigerated truck', vehNumber: 'MH-12-AB-4521', registrationNo: 'REG-4521', regValidity: '2027-06-01', insuranceNo: 'INS-4521', insuranceValidity: '2027-07-01', isActive: true },
      { id: 22, name: 'Deleted vehicle', isActive: true, isDeleted: true }
    ]);

    expect(records).toEqual([{
      _demoId: '21',
      vehicle: 'MH-12-AB-4521',
      type: 'Refrigerated truck',
      registrationNo: 'REG-4521',
      registrationDueDate: '2027-06-01',
      insuranceNo: 'INS-4521',
      insuranceDueDate: '2027-07-01',
      status: 'Active'
    }]);
  });

  it('creates, updates, and deletes vehicles using backend fields and IDs', () => {
    const record = {
      vehicle: 'MH-12-AB-4521',
      type: 'Refrigerated truck',
      registrationNo: 'REG-4521',
      registrationDueDate: '2027-06-01',
      insuranceNo: 'INS-4521',
      insuranceDueDate: '2027-07-01',
      status: 'Active'
    };
    service.createRecord(record).subscribe();
    const create = http.expectOne('http://localhost:8080/api/vehicles');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({
      name: 'Refrigerated truck',
      vehNumber: 'MH-12-AB-4521',
      registrationNo: 'REG-4521',
      regValidity: '2027-06-01',
      insuranceNo: 'INS-4521',
      insuranceValidity: '2027-07-01',
      isActive: true
    });
    create.flush({ id: 21, name: 'Refrigerated truck', vehNumber: 'MH-12-AB-4521', isActive: true });

    service.updateRecord('21', { ...record, status: 'Inactive' }).subscribe();
    const update = http.expectOne('http://localhost:8080/api/vehicles/21');
    expect(update.request.method).toBe('PUT');
    expect(update.request.body.id).toBe(21);
    expect(update.request.body.isActive).toBeFalse();
    update.flush({ id: 21, name: 'Refrigerated truck', vehNumber: 'MH-12-AB-4521', isActive: false });

    service.deleteRecord('21').subscribe();
    const deletion = http.expectOne('http://localhost:8080/api/vehicles/21');
    expect(deletion.request.method).toBe('DELETE');
    deletion.flush(null);
  });

  it('sends omitted validity dates as null and maps inactive vehicles', () => {
    service.createRecord({ vehicle: 'MH-12-AB-4521', type: 'Truck', status: 'Inactive' }).subscribe();
    const request = http.expectOne('http://localhost:8080/api/vehicles');
    expect(request.request.body.regValidity).toBeNull();
    expect(request.request.body.insuranceValidity).toBeNull();
    request.flush({ id: 21, name: 'Truck', vehNumber: 'MH-12-AB-4521', isActive: false });
  });
});
