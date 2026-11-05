import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FinanceApiService } from './finance-api.service';

describe('FinanceApiService', () => {
  let service: FinanceApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [FinanceApiService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(FinanceApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('maps editable payment fields to the payment update API contract', async () => {
    const updated = service.updatePayment('12', {
      paymentType: 'BUYER_RECEIPT',
      partyId: 7,
      amount: 150,
      paymentDate: '2026-11-05',
      paymentMethod: 'BANK_TRANSFER',
      reference: 'REF-12',
      status: 'PENDING'
    });
    const request = http.expectOne('http://localhost:8080/api/payments/12');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      paymentType: 'BUYER_RECEIPT',
      amount: 150,
      paymentDate: '2026-11-05',
      paymentMethod: 'BANK_TRANSFER',
      status: 'PENDING',
      buyingPartyId: 7,
      externalReference: 'REF-12'
    });
    request.flush({ id: 12, externalReference: 'REF-12', buyingPartyId: 7 });

    await expectAsync(updated).toBeResolvedTo({
      id: 12, externalReference: 'REF-12', buyingPartyId: 7, reference: 'REF-12', partyId: 7
    });
  });
});
