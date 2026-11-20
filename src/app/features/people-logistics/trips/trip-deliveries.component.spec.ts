import { ActivatedRoute, Router } from '@angular/router';
import { FinanceApiService } from '../../../common/services/finance-api.service';
import { TripDeliveryData } from '../../../common/services/trip-api.service';
import { SessionAuthService } from '../../../common/services/session-auth.service';
import { RolePermissionService } from '../../../common/services/role-permission.service';
import { TripService } from '../../../common/services/trip.service';
import { TripDeliveriesComponent } from './trip-deliveries.component';
import { TripApiService } from '../../../common/services/trip-api.service';

describe('TripDeliveriesComponent payments', () => {
  let component: TripDeliveriesComponent;
  let service: jasmine.SpyObj<TripService>;
  let finance: jasmine.SpyObj<FinanceApiService>;
  let tripApi: jasmine.SpyObj<TripApiService>;

  beforeEach(() => {
    const route = { snapshot: { paramMap: { get: () => '12' } } } as unknown as ActivatedRoute;
    const router = jasmine.createSpyObj<Router>('Router', ['getCurrentNavigation']);
    router.getCurrentNavigation.and.returnValue(null);
    service = jasmine.createSpyObj<TripService>('TripService', ['getDeliveryData', 'getDeliveryTrips', 'saveDelivery', 'saveTripMortality', 'deleteTripMortality']);
    service.saveDelivery.and.resolveTo('83');
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
    finance = jasmine.createSpyObj<FinanceApiService>('FinanceApiService', ['payments', 'paymentsForTrip', 'createPayment', 'updatePayment']);
    tripApi = jasmine.createSpyObj<TripApiService>('TripApiService', ['getBuyingParties', 'getSellingParties']);
    tripApi.getBuyingParties.and.resolveTo([
      { _demoId: '31', id: 31, name: 'Supplier', contact: '', location: '', isActive: true, isDeleted: false, status: 'Active' },
      { _demoId: '32', id: 32, name: 'Other Supplier', contact: '', location: '', isActive: true, isDeleted: false, status: 'Active' },
      { _demoId: '33', id: 33, name: 'Inactive supplier', contact: '', location: '', isActive: false, isDeleted: false, status: 'Inactive' }
    ]);
    tripApi.getSellingParties.and.resolveTo([
      { _demoId: '51', id: 51, name: 'Delivery vendor', contact: '', location: '', isActive: true, isDeleted: false, status: 'Active' },
      { _demoId: '52', id: 52, name: 'Other vendor', contact: '', location: '', isActive: true, isDeleted: false, status: 'Active' },
      { _demoId: '53', id: 53, name: 'Pending vendor', contact: '', location: '', isActive: false, isDeleted: false, status: 'Inactive' }
    ]);
    finance.paymentsForTrip.and.resolveTo([
      { id: 21, tripId: 12, amount: 25 },
      { id: 22, tripId: 13, amount: 50 }
    ]);
    component = new TripDeliveriesComponent(
      service,
      finance,
      tripApi,
      route,
      router,
      jasmine.createSpyObj<SessionAuthService>('SessionAuthService', []),
      jasmine.createSpyObj<RolePermissionService>('RolePermissionService', ['can'])
    );
  });

  it('loads only payments belonging to the selected trip', async () => {
    await component.ngOnInit();

    expect(finance.paymentsForTrip).toHaveBeenCalledWith('12');
    expect(component.tripPayments).toEqual([{ id: 21, tripId: 12, amount: 25 }]);
  });

  it('allows adding a route stop or supplier pickup only with trip update permission', () => {
    component.rolePermissions.can.and.returnValue(true);
    expect(component.canUpdateTrip).toBeTrue();
    expect(component.rolePermissions.can).toHaveBeenCalledWith('trips', 'update');

    component.rolePermissions.can.and.returnValue(false);
    expect(component.canUpdateTrip).toBeFalse();
  });

  it('lets Organization Admin edit saved actual delivery quantities, weights, and rates', async () => {
    component.rolePermissions.can.and.returnValue(true);
    Object.defineProperty(component.auth, 'currentUser', {
      configurable: true,
      get: () => ({ role: 'Organization Admin' })
    });
    component.trip = { _demoId: '12', status: 'Completed' };
    const delivery = {
      _demoId: '83', vendorDestinationId: '51', broiler: 8, broilerWeight: 18, broilerRate: 115,
      culls: 1, cullsWeight: 1.5, cullsRate: 50, feed: 2, feedWeight: 2, feedRate: 25,
      reason: 'Corrected receipt'
    };
    component.deliveries = [delivery];

    expect(component.canEditActualDelivery).toBeTrue();
    component.editActualDelivery(delivery);
    expect(component.editingDeliveryId).toBe('83');
    expect(component.activeOrderId).toBe('51');
    expect([component.broiler, component.broilerWeight, component.broilerRate]).toEqual([8, 18, 115]);
    expect([component.culls, component.cullsWeight, component.cullsRate]).toEqual([1, 1.5, 50]);
    expect([component.feed, component.feedWeight, component.feedRate]).toEqual([2, 2, 25]);

    component.destinations = [{ vendorDestinationId: '51', broilerRate: 100, cullsRate: 40, feedRate: 20 }];
    await component.saveEntry();

    expect(service.saveDelivery).toHaveBeenCalledWith('12', '51', jasmine.objectContaining({
      broiler: 8, broilerWeight: 18, broilerRate: 115,
      culls: 1, cullsWeight: 1.5, cullsRate: 50,
      feed: 2, feedWeight: 2, feedRate: 25
    }), [], [], '83');
  });

  it('calculates received payments, supplier payouts, and outstanding supplier balance separately', () => {
    component.supplierReceipts = [{ total: 700 }];
    component.supplierPickups = [{ vendorId: '31', vendorName: 'Supplier', broiler: { quantity: 1, rate: 1, total: 1 }, culls: { quantity: 0, rate: 0, total: 0 }, feed: { quantity: 0, rate: 0, total: 0 }, total: 1 }];
    component.tripPayments = [
      { paymentType: 'SELLER_PAYOUT', partyRole: 'BUYING', partyId: '31', status: 'COMPLETED', amount: 200 },
      { paymentType: 'SELLER_PAYOUT', partyRole: 'BUYING', partyId: '31', status: 'COMPLETED', amount: 500, isDeleted: true },
      { paymentType: 'SELLER_PAYOUT', partyRole: 'BUYING', partyId: '31', status: 'PENDING', amount: 100 },
      { paymentType: 'SELLER_PAYOUT', partyRole: 'SELLING', status: 'COMPLETED', amount: 75 },
      { paymentType: 'BUYER_RECEIPT', partyRole: 'SELLING', status: 'COMPLETED', amount: 450 },
      { paymentType: 'BUYER_RECEIPT', partyRole: 'SELLING', status: 'PENDING', amount: 50 }
    ];

    expect(component.totalPaymentReceived()).toBe(450);
    expect(component.totalSupplierPaymentsMade()).toBe(200);
    expect(component.paymentsToBeDone()).toBe(500);
  });

  it('does not reduce trip supplier outstanding for a payout to a supplier outside the trip', () => {
    component.supplierReceipts = [{ total: 700 }];
    component.supplierPickups = [{ vendorId: '31', vendorName: 'Trip supplier', broiler: { quantity: 1, rate: 1, total: 1 }, culls: { quantity: 0, rate: 0, total: 0 }, feed: { quantity: 0, rate: 0, total: 0 }, total: 1 }];
    component.tripPayments = [
      { paymentType: 'SELLER_PAYOUT', partyRole: 'BUYING', partyId: '32', status: 'COMPLETED', amount: 250, tripId: 12 },
      { paymentType: 'SELLER_PAYOUT', partyRole: 'BUYING', partyId: '31', status: 'COMPLETED', amount: 100, tripId: 12 }
    ];

    expect(component.totalSupplierPaymentsMade()).toBe(100);
    expect(component.paymentsToBeDone()).toBe(600);
  });

  it('does not show a negative outstanding supplier balance after overpayment', () => {
    component.supplierReceipts = [{ total: 700 }];
    component.supplierPickups = [{ vendorId: '31', vendorName: 'Supplier', broiler: { quantity: 1, rate: 1, total: 1 }, culls: { quantity: 0, rate: 0, total: 0 }, feed: { quantity: 0, rate: 0, total: 0 }, total: 1 }];
    component.tripPayments = [
      { paymentType: 'SELLER_PAYOUT', partyRole: 'BUYING', partyId: '31', status: 'COMPLETED', amount: 800 }
    ];

    expect(component.paymentsToBeDone()).toBe(0);
  });

  it('totals multiple mortality records for reconciliation', () => {
    component.loadedBroiler = 50;
    component.loadedCulls = 10;
    component.deliveries = [{ broiler: 40, culls: 10 }];
    component.mortalities = [{ quantity: 3 }, { quantity: 2 }];

    expect(component.totalMortality()).toBe(5);
    expect(component.unreconciled()).toBe(5);
  });

  it('offers all active suppliers for payouts and all active delivery vendors for receipts', async () => {
    await component.ngOnInit();
    component.paymentType = 'SELLER_PAYOUT';
    expect(component.paymentParties).toEqual([
      { id: 'BUYING:31', name: 'Supplier · Supplier' },
      { id: 'BUYING:32', name: 'Supplier · Other Supplier' }
    ]);

    component.paymentType = 'BUYER_RECEIPT';
    expect(component.paymentParties).toEqual([
      { id: 'SELLING:51', name: 'Vendor · Delivery vendor' },
      { id: 'SELLING:52', name: 'Vendor · Other vendor' }
    ]);
  });

  it('adds a saved payment to the trip history and allows another entry', async () => {
    finance.createPayment.and.resolveTo({ id: 23 });
    finance.paymentsForTrip.and.resolveTo([{ id: 23, tripId: 12, amount: 100, reference: 'REF-23', normalizedByServer: true }]);
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
    expect(finance.paymentsForTrip).toHaveBeenCalledWith('12');
    expect(component.tripPayments).toEqual([
      jasmine.objectContaining({ id: 23, tripId: 12, amount: 100, reference: 'REF-23', normalizedByServer: true })
    ]);
    expect(component.showPaymentForm).toBeFalse();

    component.togglePaymentForm();
    expect(component.showPaymentForm).toBeTrue();
  });

  it('updates an existing payment', async () => {
    finance.updatePayment.and.resolveTo({ id: 21 });
    finance.paymentsForTrip.and.resolveTo([{ id: 21, tripId: 12, amount: 95, paymentMethod: 'BANK_TRANSFER', normalizedByServer: true }]);
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
    expect(finance.paymentsForTrip).toHaveBeenCalledWith('12');
    expect(component.tripPayments).toEqual([
      jasmine.objectContaining({ id: 21, tripId: 12, amount: 95, paymentMethod: 'BANK_TRANSFER', normalizedByServer: true })
    ]);
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
    finance.paymentsForTrip.and.resolveTo([{ id: 22, tripId: 12, amount: 40 }]);
    component.trip = { _demoId: '12', status: 'In transit' };
    const payment = { id: 21, status: 'COMPLETED', amount: 80 };
    component.tripPayments = [payment];

    await component.deletePayment(payment);

    expect(finance.updatePayment).toHaveBeenCalledWith('21', { isDeleted: true, isActive: false });
    expect(finance.paymentsForTrip).toHaveBeenCalledWith('12');
    expect(component.tripPayments).toEqual([{ id: 22, tripId: 12, amount: 40 }]);
  });
});
