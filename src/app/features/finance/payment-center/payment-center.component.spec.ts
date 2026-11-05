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
    api = jasmine.createSpyObj<FinanceApiService>('FinanceApiService', ['updatePayment', 'createPayment', 'payments']);
    api.updatePayment.and.resolveTo({});
    api.payments.and.resolveTo([]);
    tripsApi = jasmine.createSpyObj<TripApiService>('TripApiService', ['getFormOptions', 'getTrips']);
    tripsApi.getTrips.and.resolveTo([]);
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

    expect(api.updatePayment).toHaveBeenCalledWith('12', { status: 'DELETED' });
    expect(payment['status']).toBe('DELETED');
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
});
