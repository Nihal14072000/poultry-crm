import { ActivatedRoute } from '@angular/router';
import { FinanceApiService } from '../../../common/services/finance-api.service';
import { TripApiService } from '../../../common/services/trip-api.service';
import { PartyDetailsComponent } from './party-details.component';

describe('PartyDetailsComponent', () => {
  let tripsApi: jasmine.SpyObj<TripApiService>;
  let financeApi: jasmine.SpyObj<FinanceApiService>;
  let component: PartyDetailsComponent;

  beforeEach(() => {
    tripsApi = jasmine.createSpyObj<TripApiService>('TripApiService', ['getBuyingParties', 'getSellingParties', 'getPartyOrderTotal', 'getPartyOrders', 'getTrips', 'getTripDetails']);
    financeApi = jasmine.createSpyObj<FinanceApiService>('FinanceApiService', ['summary', 'sumCompletedPaymentsByParty', 'paymentsForParty']);
    component = new PartyDetailsComponent({
      snapshot: { data: { partyType: 'buying' }, paramMap: { get: () => '7' } }
    } as unknown as ActivatedRoute, tripsApi, financeApi);
  });

  it('loads party details without fetching unused trip data', async () => {
    tripsApi.getBuyingParties.and.resolveTo([{
      _demoId: '7', id: 7, name: 'Supplier', contact: '', location: '',
      outstanding: null, isActive: true, isDeleted: false, status: 'Active'
    }]);
    financeApi.summary.and.resolveTo({ totalReceived: 125, totalReceivable: 200 });
    financeApi.sumCompletedPaymentsByParty.and.resolveTo(125);
    tripsApi.getPartyOrderTotal.and.resolveTo(200);
    financeApi.paymentsForParty.and.resolveTo([
      { id: 1, partyId: 7, paymentType: 'BUYER_RECEIPT', amount: 125, status: 'COMPLETED', paymentDate: '2026-03-02' },
      { id: 2, partyId: 7, paymentType: 'BUYER_RECEIPT', amount: 50, status: 'PENDING', paymentDate: '2026-03-03' },
      { id: 5, partyId: 7, paymentType: 'BUYER_RECEIPT', amount: 10, status: 'COMPLETED', isDeleted: true }
    ]);
    tripsApi.getPartyOrders.and.resolveTo([{
      tripId: 11, orderTypeId: 1, orderTypeName: 'Broiler', qty: 5, weight: 20, rate: 100, createDate: '2026-03-10'
    }]);

    await component.ngOnInit();

    expect(tripsApi.getTrips).not.toHaveBeenCalled();
    expect(tripsApi.getTripDetails).not.toHaveBeenCalled();
    expect(component.paymentsTotal).toBe(125);
    expect(component.dueTotal).toBe(75);
    expect(component.transactionTotal).toBe(200);
    expect(component.transactionLabel).toBe('Purchase');
    expect(component.payments.map((payment) => payment['id'])).toEqual([1, 2]);
    expect(financeApi.summary).not.toHaveBeenCalled();
    expect(financeApi.sumCompletedPaymentsByParty).toHaveBeenCalledWith('7', 'B');
    expect(tripsApi.getPartyOrderTotal).toHaveBeenCalledWith('7', 'B');
    expect(financeApi.paymentsForParty).toHaveBeenCalledWith('7', 'B');
    expect(tripsApi.getPartyOrders).toHaveBeenCalledWith('7', 'B');
    expect(component.orders[0]['tripId']).toBe(11);
  });

  it('loads all orders for a selling party using party type S', async () => {
    component = new PartyDetailsComponent({
      snapshot: { data: { partyType: 'selling' }, paramMap: { get: () => '12' } }
    } as unknown as ActivatedRoute, tripsApi, financeApi);
    tripsApi.getSellingParties.and.resolveTo([{
      _demoId: '12', id: 12, name: 'Latif Kasab', contact: '', location: '',
      outstanding: 80, isActive: true, isDeleted: false, status: 'Active'
    }]);
    tripsApi.getPartyOrders.and.resolveTo([{
      tripId: 15, orderTypeId: 1, orderTypeName: 'Broiler', qty: 20, weight: 50, rate: 110, createDate: '2026-03-10'
    }]);
    financeApi.summary.and.resolveTo({ totalReceived: 121, totalReceivable: 121, totalPaid: 35, totalPayable: 100 });
    financeApi.sumCompletedPaymentsByParty.and.resolveTo(35);
    tripsApi.getPartyOrderTotal.and.resolveTo(100);
    financeApi.paymentsForParty.and.resolveTo([
      { id: 6, partyId: 12, paymentType: 'SELLER_PAYOUT', amount: 35, status: 'COMPLETED' }
    ]);

    await component.ngOnInit();

    expect(tripsApi.getPartyOrders).toHaveBeenCalledWith('12', 'S');
    expect(tripsApi.getTrips).not.toHaveBeenCalled();
    expect(tripsApi.getTripDetails).not.toHaveBeenCalled();
    expect(financeApi.summary).not.toHaveBeenCalled();
    expect(tripsApi.getPartyOrderTotal).toHaveBeenCalledWith('12', 'S');
    expect(financeApi.sumCompletedPaymentsByParty).toHaveBeenCalledWith('12', 'S');
    expect(financeApi.paymentsForParty).toHaveBeenCalledWith('12', 'S');
    expect(component.paymentsTotal).toBe(35);
    expect(component.transactionTotal).toBe(100);
    expect(component.dueTotal).toBe(145);
    expect(component.transactionLabel).toBe('Sales');
    expect(component.payments.map((payment) => payment['id'])).toEqual([6]);
    expect(component.orders[0]['tripId']).toBe(15);
    expect(component.orderColumns).toEqual(['tripId', 'orderTypeId', 'qty', 'weight', 'rate', 'sales', 'createDate']);
    expect(component.orderValue(15, 'tripId', component.orders[0])).toBe('TR0015');
    expect(component.orderColumnLabel('orderTypeId')).toBe('ORDER TYPE');
    expect(component.orderValue(1, 'orderTypeId', component.orders[0])).toBe('Broiler');
    expect(component.orderValue(undefined, 'sales', component.orders[0])).toBe('₹ 5500');
    expect(component.orderValue(undefined, 'sales', { weight: 20, rate: 110.49 })).toBe('₹ 2210');
    expect(component.orderCreatedDate(component.orders[0])).toBe('2026-03-10');
  });
});
