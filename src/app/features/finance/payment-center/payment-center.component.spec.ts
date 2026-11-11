import { ActivatedRoute, Router } from '@angular/router';
import { FinanceApiService, FinanceRecord } from '../../../common/services/finance-api.service';
import { RolePermissionService } from '../../../common/services/role-permission.service';
import { TripApiService } from '../../../common/services/trip-api.service';
import { PaymentCenterComponent } from './payment-center.component';

describe('PaymentCenterComponent payment actions', () => {
  let component: PaymentCenterComponent;
  let api: jasmine.SpyObj<FinanceApiService>;
  let tripsApi: jasmine.SpyObj<TripApiService>;
  let permissions: jasmine.SpyObj<RolePermissionService>;

  beforeEach(() => {
    api = jasmine.createSpyObj<FinanceApiService>('FinanceApiService', ['updatePayment', 'createPayment', 'payments', 'summary', 'receivables', 'payables']);
    api.updatePayment.and.resolveTo({});
    api.payments.and.resolveTo([]);
    api.summary.and.resolveTo({});
    api.receivables.and.resolveTo([]);
    api.payables.and.resolveTo([]);
    tripsApi = jasmine.createSpyObj<TripApiService>('TripApiService', ['getFormOptions', 'getTrips']);
    tripsApi.getTrips.and.resolveTo([]);
    tripsApi.getFormOptions.and.resolveTo({
      vehicles: [],
      drivers: [],
      labourers: [],
      suppliers: [],
      supervisors: [],
      deliveryVendors: [],
      trips: [],
      orderTypeIds: { broiler: 1, culls: 2, feed: 3 }
    });
    permissions = jasmine.createSpyObj<RolePermissionService>('RolePermissionService', ['can']);
    permissions.can.and.returnValue(true);
    const route = {
      snapshot: { routeConfig: { path: 'payments' }, queryParamMap: { get: () => null } }
    } as unknown as ActivatedRoute;
    component = new PaymentCenterComponent(route, jasmine.createSpyObj<Router>('Router', ['navigate']), api, tripsApi, permissions);
  });

  it('updates payment details and replaces the row after a successful edit', async () => {
    const payment: FinanceRecord = { id: 12, amount: 125, status: 'PENDING' };
    api.updatePayment.and.resolveTo({ amount: 150 });
    component.payments = [payment];
    component.editingPaymentId = '12';
    component.form = {
      paymentType: 'BUYER_RECEIPT',
      partyId: 7,
      amount: 150,
      paymentDate: '2026-11-05',
      paymentMethod: 'BANK_TRANSFER',
      reference: 'REF-12',
      status: 'PENDING',
      note: ''
    };

    await component.savePayment();

    expect(api.updatePayment).toHaveBeenCalledWith('12', component.form);
    expect(component.payments[0]['amount']).toBe(150);
    expect(component.editingPaymentId).toBe('');
  });

  it('marks a payment deleted through the update endpoint after confirmation', async () => {
    const payment: FinanceRecord = { id: 12, status: 'COMPLETED' };
    component.requestDeletePayment(payment);
    expect(component.deleteCandidate).toBe(payment);

    await component.deletePayment();

    expect(api.updatePayment).toHaveBeenCalledWith('12', { isDeleted: true, isActive: false });
    expect(payment['isDeleted']).toBeTrue();
    expect(payment['isActive']).toBeFalse();
    expect(component.deleteCandidate).toBeUndefined();
  });

  it('does not open payment deletion confirmation without delete permission', () => {
    permissions.can.and.callFake((_resource, action) => action !== 'delete');
    component.requestDeletePayment({ id: 12, status: 'PENDING' });

    expect(component.deleteCandidate).toBeUndefined();
  });

  it('loads buyer and seller parties for payment history', async () => {
    tripsApi.getFormOptions.and.resolveTo({
      vehicles: [],
      drivers: [],
      labourers: [],
      suppliers: [{ _demoId: '7', name: 'Buyer party' }],
      supervisors: [],
      deliveryVendors: [{ _demoId: '7', name: 'Seller party' }],
      trips: [],
      orderTypeIds: { broiler: 1, culls: 2, feed: 3 }
    });
    component.view = 'payments';

    await component.load();

    expect(component.paymentParties.map(party => party['_demoId'])).toEqual(['BUYER_RECEIPT:7', 'SELLER_PAYOUT:7']);
  });

  it('filters payment history by party type and ID', () => {
    component.view = 'payments';
    component.paymentPartyFilter = 'BUYER_RECEIPT:7';
    component.payments = [
      { id: 1, paymentType: 'BUYER_RECEIPT', partyId: 7 },
      { id: 2, paymentType: 'SELLER_PAYOUT', partyId: 7 },
      { id: 3, paymentType: 'SELLER_PAYOUT', partyId: 8 }
    ];

    expect(component.filtered.map(payment => payment['id'])).toEqual([1]);
  });

  it('resolves a payment trip to the trip number and detail route ID', () => {
    component.trips = [{ _demoId: '15', tripNumber: 'TR-0015' }];

    expect(component.paymentTrip({ tripId: 15 })).toEqual({ _demoId: '15', tripNumber: 'TR-0015' });
  });

  it('builds a six-month cash-flow trend from completed, non-deleted payments', () => {
    const thisMonth = new Date().toISOString().slice(0, 7);
    component.payments = [
      { status: 'COMPLETED', paymentType: 'BUYER_RECEIPT', amount: 125, paymentDate: `${thisMonth}-05` },
      { status: 'COMPLETED', paymentType: 'SELLER_PAYOUT', amount: 40, paymentDate: `${thisMonth}-12` },
      { status: 'PENDING', paymentType: 'BUYER_RECEIPT', amount: 70, paymentDate: `${thisMonth}-14` },
      { status: 'COMPLETED', isDeleted: true, paymentType: 'BUYER_RECEIPT', amount: 20, paymentDate: `${thisMonth}-16` }
    ];

    expect(component.monthlyTrend).toHaveSize(6);
    expect(component.monthlyTrend[5]).toEqual(jasmine.objectContaining({ month: thisMonth, receipts: 125, payouts: 40 }));
    expect(component.trendPoints('receipts').split(' ')).toHaveSize(6);
    expect(component.trendAxisValues).toEqual([125, 62.5, 0]);
    expect(component.trendY(125)).toBe(18);
  });

  it('compares outstanding receivables and payables with a safe zero-value scale', () => {
    component.records = [
      { settlementType: 'BUYER_RECEIPT', outstandingBalance: 80 },
      { settlementType: 'SELLER_PAYOUT', outstandingBalance: 40 }
    ];

    expect(component.balanceComparison.map(balance => balance.value)).toEqual([80, 40]);
    expect(component.balanceWidth(40)).toBe(50);
    component.records = [];
    expect(component.balanceWidth(0)).toBe(0);
  });

  it('uses the finance summary API for overview totals and retains party settlements', async () => {
    api.summary.and.resolveTo({ totalReceived: 125, totalReceivable: 300, totalPaid: 40, totalPayable: 80 });
    api.receivables.and.resolveTo([{ buyingPartyName: 'Buyer One', outstandingAmount: 300 }]);
    api.payables.and.resolveTo([{ sellingPartyName: 'Seller One', outstandingAmount: 80 }]);
    component.view = 'overview';

    await component.load();

    expect(api.summary).toHaveBeenCalledWith();
    expect(component.metrics.map(metric => metric.value)).toEqual([300, 125, 80, 40]);
    expect(component.records.map(record => record['buyingPartyName'] ?? record['sellingPartyName'])).toEqual(['Buyer One', 'Seller One']);
  });

  it('does not use the unfiltered summary for a selected trip', async () => {
    component.view = 'overview';
    component.tripId = '15';
    api.receivables.and.resolveTo([{ buyingPartyName: 'Buyer One', amountDue: 300 }]);
    api.payables.and.resolveTo([{ sellingPartyName: 'Seller One', amountPayable: 80 }]);
    api.payments.and.resolveTo([
      { tripId: 15, paymentType: 'BUYER_RECEIPT', amount: 125, status: 'COMPLETED' },
      { tripId: 15, paymentType: 'SELLER_PAYOUT', amount: 40, status: 'COMPLETED' },
      { tripId: 16, paymentType: 'BUYER_RECEIPT', amount: 500, status: 'COMPLETED' }
    ]);

    await component.load();

    expect(api.summary).not.toHaveBeenCalled();
    expect(api.receivables).toHaveBeenCalledWith({ tripId: '15' });
    expect(component.metrics.map(metric => metric.value)).toEqual([300, 125, 80, 40]);
  });
});
