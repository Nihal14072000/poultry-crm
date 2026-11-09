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
      id: 12, externalReference: 'REF-12', buyingPartyId: 7, reference: 'REF-12', partyId: 7, partyRole: 'BUYING'
    });
  });

  it('uses the selected party entity for seller payout payments', async () => {
    const created = service.createPayment({
      paymentType: 'SELLER_PAYOUT',
      partyId: 31,
      partyRole: 'BUYING',
      amount: 80,
      paymentDate: '2026-11-05',
      paymentMethod: 'CASH',
      status: 'COMPLETED',
      tripId: 12
    });
    const request = http.expectOne('http://localhost:8080/api/payments');

    expect(request.request.body).toEqual({
      paymentType: 'SELLER_PAYOUT',
      amount: 80,
      paymentDate: '2026-11-05',
      paymentMethod: 'CASH',
      status: 'COMPLETED',
      tripId: 12,
      buyingPartyId: 31,
      externalReference: undefined
    });
    request.flush({ id: 21, buyingPartyId: 31 });

    await expectAsync(created).toBeResolvedTo(jasmine.objectContaining({ partyRole: 'BUYING', partyId: 31 }));
  });

  it('updates seller payout payments with the selected selling party ID', async () => {
    const updated = service.updatePayment('22', {
      paymentType: 'SELLER_PAYOUT',
      partyId: 51,
      partyRole: 'SELLING'
    });
    const request = http.expectOne('http://localhost:8080/api/payments/22');

    expect(request.request.body).toEqual({
      paymentType: 'SELLER_PAYOUT',
      sellingPartyId: 51
    });
    request.flush({ id: 22, sellingPartyId: 51 });

    await expectAsync(updated).toBeResolvedTo(jasmine.objectContaining({ partyRole: 'SELLING', partyId: 51 }));
  });

  it('marks a payment deleted without sending a status', async () => {
    const updated = service.updatePayment('23', { isDeleted: true, isActive: false });
    const request = http.expectOne('http://localhost:8080/api/payments/23');

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ isDeleted: true, isActive: false });
    request.flush({ id: 23, isDeleted: true, isActive: false });

    await expectAsync(updated).toBeResolvedTo(jasmine.objectContaining({ id: 23, isDeleted: true, isActive: false }));
  });
});
