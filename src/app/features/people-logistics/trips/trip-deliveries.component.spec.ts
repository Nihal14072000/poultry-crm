import { ActivatedRoute, Router } from '@angular/router';
import { FinanceApiService } from '../../../common/services/finance-api.service';
import { TripDeliveryData } from '../../../common/services/trip-api.service';
import { SessionAuthService } from '../../../common/services/session-auth.service';
import { RolePermissionService } from '../../../common/services/role-permission.service';
import { TripService } from '../../../common/services/trip.service';
import { TripDeliveriesComponent } from './trip-deliveries.component';

describe('TripDeliveriesComponent payments', () => {
  let component: TripDeliveriesComponent;
  let service: jasmine.SpyObj<TripService>;
  let finance: jasmine.SpyObj<FinanceApiService>;

  beforeEach(() => {
    const route = { snapshot: { paramMap: { get: () => '12' } } } as unknown as ActivatedRoute;
    const router = jasmine.createSpyObj<Router>('Router', ['getCurrentNavigation']);
    router.getCurrentNavigation.and.returnValue(null);
    service = jasmine.createSpyObj<TripService>('TripService', ['getDeliveryData', 'getDeliveryTrips', 'saveTripMortality', 'deleteTripMortality']);
    service.saveTripMortality.and.resolveTo();
    service.getDeliveryData.and.resolveTo({
      trip: { _demoId: '12' },
      supplierPickups: [],
      supplierReceipts: [],
      destinations: [],
      deliveries: [],
      mortalities: [],
      loadedBroiler: 0,
      loadedCulls: 0,
      loadedBirds: 0
    } satisfies TripDeliveryData);
    finance = jasmine.createSpyObj<FinanceApiService>('FinanceApiService', ['payments', 'createPayment', 'updatePayment']);
    finance.payments.and.resolveTo([
      { id: 21, tripId: 12, amount: 25 },
      { id: 22, tripId: 13, amount: 50 }
    ]);
    component = new TripDeliveriesComponent(
      service,
      finance,
      route,
      router,
      jasmine.createSpyObj<SessionAuthService>('SessionAuthService', []),
      jasmine.createSpyObj<RolePermissionService>('RolePermissionService', ['can'])
    );
  });

  it('loads only payments belonging to the selected trip', async () => {
    await component.ngOnInit();

    expect(component.tripPayments).toEqual([{ id: 21, tripId: 12, amount: 25 }]);
  });

  it('allows adding a route stop or supplier pickup only with trip update permission', () => {
    component.rolePermissions.can.and.returnValue(true);
    expect(component.canUpdateTrip).toBeTrue();
    expect(component.rolePermissions.can).toHaveBeenCalledWith('trips', 'update');

    component.rolePermissions.can.and.returnValue(false);
    expect(component.canUpdateTrip).toBeFalse();
  });

  it('shows actual supplier cost and completed seller payouts', () => {
    component.supplierReceipts = [{ total: 700 }];
    component.tripPayments = [
      { paymentType: 'SELLER_PAYOUT', status: 'COMPLETED', amount: 200 },
      { paymentType: 'SELLER_PAYOUT', status: 'COMPLETED', amount: 500, isDeleted: true },
      { paymentType: 'SELLER_PAYOUT', status: 'PENDING', amount: 100 },
      { paymentType: 'BUYER_RECEIPT', status: 'COMPLETED', amount: 450 },
      { paymentType: 'BUYER_RECEIPT', status: 'PENDING', amount: 50 }
    ];

    expect(component.paymentsToBeDone()).toBe(700);
    expect(component.totalPaymentReceived()).toBe(200);
  });

  it('totals multiple mortality records for reconciliation', () => {
    component.loadedBroiler = 50;
    component.loadedCulls = 10;
    component.deliveries = [{ broiler: 40, culls: 10 }];
    component.mortalities = [{ quantity: 3 }, { quantity: 2 }];

    expect(component.totalMortality()).toBe(5);
    expect(component.unreconciled()).toBe(5);
  });

  it('offers supplier and delivery vendors as seller payout parties', () => {
    component.paymentType = 'SELLER_PAYOUT';
    component.supplierPickups = [{
      vendorId: '31',
      vendorName: 'Supplier',
      broiler: { quantity: 1, rate: 1, total: 1 },
      culls: { quantity: 0, rate: 0, total: 0 },
      feed: { quantity: 0, rate: 0, total: 0 },
      total: 1
    }];
    component.destinations = [{ vendorDestinationId: '51', vendorName: 'Delivery vendor' }];

    expect(component.paymentParties).toEqual([
      { id: 'BUYING:31', name: 'Supplier · Supplier' },
      { id: 'SELLING:51', name: 'Delivery vendor · Delivery vendor' }
    ]);
  });

  it('adds a saved payment to the trip history and allows another entry', async () => {
    finance.createPayment.and.resolveTo({ id: 23 });
    component.trip = { _demoId: '12' };
    component.paymentPartyId = 'SELLING:7';
    component.paymentAmount = 100;
    component.paymentReference = 'REF-23';
    component.showPaymentForm = true;

    await component.savePayment();

    expect(finance.createPayment).toHaveBeenCalledWith(jasmine.objectContaining({
      paymentType: 'BUYER_RECEIPT',
      partyId: 7,
      partyRole: 'SELLING',
      amount: 100,
      tripId: 12,
      status: 'COMPLETED'
    }));
    expect(component.tripPayments[0]).toEqual(jasmine.objectContaining({
      id: 23,
      tripId: 12,
      amount: 100,
      reference: 'REF-23'
    }));
    expect(component.showPaymentForm).toBeFalse();

    component.togglePaymentForm();
    expect(component.showPaymentForm).toBeTrue();
  });

  it('updates an existing payment', async () => {
    finance.updatePayment.and.resolveTo({ id: 21 });
    component.trip = { _demoId: '12' };
    component.tripPayments = [{ id: 21, paymentType: 'SELLER_PAYOUT', partyId: 31, buyingPartyId: 31, partyRole: 'BUYING', amount: 80, paymentDate: '2026-11-02', paymentMethod: 'CASH' }];
    component.editPayment(component.tripPayments[0]);
    component.paymentAmount = 95;

    await component.savePayment();

    expect(finance.updatePayment).toHaveBeenCalledWith('21', jasmine.objectContaining({
      paymentType: 'SELLER_PAYOUT',
      partyId: 31,
      partyRole: 'BUYING',
      amount: 95,
      tripId: 12
    }));
    expect(component.tripPayments[0]['amount']).toBe(95);
    expect(component.editingPaymentId).toBe('');
  });

  it('updates an existing mortality record', async () => {
    spyOn(component, 'allSupplierReceiptsSaved').and.returnValue(true);
    component.trip = { _demoId: '12' };
    component.mortalities = [{ _demoId: '91', quantity: 2, remarks: 'Old reason' }];
    component.editMortality(component.mortalities[0]);
    component.mortalityQuantity = 3;
    component.mortalityRemarks = 'Updated reason';

    await component.saveMortality();

    expect(service.saveTripMortality).toHaveBeenCalledWith('12', 3, 'Updated reason', [], [], '91');
    expect(component.editingMortalityId).toBe('');
  });

  it('deletes a mortality record after confirmation', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    component.trip = { _demoId: '12', status: 'In transit' };
    component.mortalities = [{ _demoId: '91', quantity: 2 }];

    await component.deleteMortality(component.mortalities[0]);

    expect(service.deleteTripMortality).toHaveBeenCalledWith('12', '91');
  });

  it('marks a payment deleted after confirmation', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    finance.updatePayment.and.resolveTo({ id: 21, isDeleted: true, isActive: false });
    component.trip = { _demoId: '12', status: 'In transit' };
    const payment = { id: 21, status: 'COMPLETED', amount: 80 };
    component.tripPayments = [payment];

    await component.deletePayment(payment);

    expect(finance.updatePayment).toHaveBeenCalledWith('21', { isDeleted: true, isActive: false });
    expect(component.tripPayments[0]['isDeleted']).toBeTrue();
    expect(component.tripPayments[0]['isActive']).toBeFalse();
  });
});
