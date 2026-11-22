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

  it('normalizes snake_case payment fields for trip payment summaries', async () => {
    const payments = service.payments();
    const request = http.expectOne('http://localhost:8080/api/payments/retrieve');
    request.flush([{
      id: 41,
      trip_id: 12,
      type: 'buyer_receipt',
      amount: 250,
      status: 'completed',
      is_deleted: false,
      selling_party_id: 51,
      external_reference: 'RCPT-41'
    }]);

    await expectAsync(payments).toBeResolvedTo([jasmine.objectContaining({
      id: 41,
      tripId: 12,
      paymentType: 'BUYER_RECEIPT',
      amount: 250,
      status: 'COMPLETED',
      isDeleted: false,
      sellingPartyId: 51,
      partyId: 51,
      partyRole: 'SELLING',
      reference: 'RCPT-41'
    })]);
  });

  it('retrieves payments using the trip-scoped endpoint and normalizes the response', async () => {
    const payments = service.paymentsForTrip('12');
    const request = http.expectOne('http://localhost:8080/api/payments/trip/12/retrieve');
    expect(request.request.method).toBe('GET');
    request.flush([{
      id: 42, trip_id: 12, type: 'seller_payout', amount: 90,
      status: 'completed', buying_party_id: 31, external_reference: 'PAY-42'
    }]);

    await expectAsync(payments).toBeResolvedTo([jasmine.objectContaining({
      id: 42, tripId: 12, paymentType: 'SELLER_PAYOUT', amount: 90,
      status: 'COMPLETED', partyId: 31, partyRole: 'BUYING', reference: 'PAY-42'
    })]);
  });

  it('retrieves payments for a specific party using party type', async () => {
    const payments = service.paymentsForParty('25', 'S');
    const request = http.expectOne((req) =>
      req.url === 'http://localhost:8080/api/payments/retrieve' &&
      req.params.get('partyId') === '25' && req.params.get('partyTyp') === 'S'
    );
    expect(request.request.method).toBe('GET');
    request.flush([{ id: 43, party_id: 25, type: 'seller_payout', amount: 75, status: 'completed' }]);

    await expectAsync(payments).toBeResolvedTo([jasmine.objectContaining({
      id: 43, partyId: 25, paymentType: 'SELLER_PAYOUT', amount: 75, status: 'COMPLETED'
    })]);
  });

  it('retrieves the completed payment sum for a party', async () => {
    const total = service.sumCompletedPaymentsByParty('25', 'S');
    const request = http.expectOne((req) =>
      req.url === 'http://localhost:8080/api/payments/party/sum' &&
      req.params.get('partyId') === '25' && req.params.get('partyType') === 'S'
    );
    request.flush({ totalAmount: '1250.50' });

    await expectAsync(total).toBeResolvedTo(1250.5);
  });

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

  it('deletes a payment using the payment DELETE endpoint', async () => {
    const deleted = service.deletePayment('23');
    const request = http.expectOne('http://localhost:8080/api/payments/23');

    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toBeNull();
    request.flush(null);

    await expectAsync(deleted).toBeResolved();
  });

  it('loads the finance summary with optional party filters', async () => {
    const summary = service.summary({ buyingPartyId: '7', sellingPartyId: '9' });
    const request = http.expectOne('http://localhost:8080/api/finance/summary?buyingPartyId=7&sellingPartyId=9');

    expect(request.request.method).toBe('GET');
    request.flush({ totalReceived: 125, totalReceivable: 300, totalPaid: 40, totalPayable: 80 });

    await expectAsync(summary).toBeResolvedTo({
      totalReceived: 125,
      totalReceivable: 300,
      totalPaid: 40,
      totalPayable: 80
    });
  });
});
