import { ActivatedRoute } from '@angular/router';
import { FinanceApiService } from '../../../common/services/finance-api.service';
import { TripApiService } from '../../../common/services/trip-api.service';
import { PartyDetailsComponent } from './party-details.component';

describe('PartyDetailsComponent', () => {
  let tripsApi: jasmine.SpyObj<TripApiService>;
  let financeApi: jasmine.SpyObj<FinanceApiService>;
  let component: PartyDetailsComponent;

  beforeEach(() => {
    tripsApi = jasmine.createSpyObj<TripApiService>('TripApiService', ['getBuyingParties', 'getSellingParties', 'getPartyOrders', 'getTrips', 'getTripDetails']);
    financeApi = jasmine.createSpyObj<FinanceApiService>('FinanceApiService', ['summary']);
    component = new PartyDetailsComponent({
      snapshot: { data: { partyType: 'buying' }, paramMap: { get: () => '7' } }
    } as unknown as ActivatedRoute, tripsApi, financeApi);
  });

  it('shows finance summary totals and only this party’s trips', async () => {
    tripsApi.getBuyingParties.and.resolveTo([{
      _demoId: '7', id: 7, name: 'Supplier', contact: '', location: '',
      isActive: true, isDeleted: false, status: 'Active'
    }]);
    tripsApi.getTrips.and.resolveTo([
      { _demoId: '11', tripNumber: 'TR-0011', tripDate: '2026-03-10', route: 'A to B' },
      { _demoId: '12', tripNumber: 'TR-0012', tripDate: '2026-03-12', route: 'C to D' }
    ]);
    tripsApi.getTripDetails.and.callFake(async (id) => ({
      trip: {},
      vendorPickups: [{ vendorId: id === '11' ? '7' : '8', vendorName: 'Supplier', broiler: { quantity: 1, rate: 1, total: 1 }, culls: { quantity: 0, rate: 0, total: 0 }, feed: { quantity: 0, rate: 0, total: 0 }, total: 1 }],
      supplierReceipts: [],
      vendorDestinations: [],
      deliveryEntries: []
    }));
    financeApi.summary.and.resolveTo({ totalReceived: 125, totalReceivable: 200 });
    tripsApi.getPartyOrders.and.resolveTo([{
      tripId: 11, orderTypeId: 1, orderTypeName: 'Broiler', qty: 5, weight: 20, rate: 100, createDate: '2026-03-10'
    }]);

    await component.ngOnInit();

    expect(component.trips.map((trip) => trip['_demoId'])).toEqual(['11']);
    expect(component.paymentsTotal).toBe(125);
    expect(component.dueTotal).toBe(75);
    expect(component.transactionTotal).toBe(200);
    expect(component.transactionLabel).toBe('Purchase');
    expect(financeApi.summary).toHaveBeenCalledWith({ buyingPartyId: '7' });
    expect(tripsApi.getPartyOrders).toHaveBeenCalledWith('7', 'B');
    expect(component.orders[0]['tripId']).toBe(11);
  });

  it('loads all orders for a selling party using party type S', async () => {
    component = new PartyDetailsComponent({
      snapshot: { data: { partyType: 'selling' }, paramMap: { get: () => '12' } }
    } as unknown as ActivatedRoute, tripsApi, financeApi);
    tripsApi.getSellingParties.and.resolveTo([{
      _demoId: '12', id: 12, name: 'Latif Kasab', contact: '', location: '',
      isActive: true, isDeleted: false, status: 'Active'
    }]);
    tripsApi.getTrips.and.resolveTo([]);
    tripsApi.getPartyOrders.and.resolveTo([{
      tripId: 15, orderTypeId: 1, orderTypeName: 'Broiler', qty: 20, weight: 50, rate: 110, createDate: '2026-03-10'
    }]);
    financeApi.summary.and.resolveTo({ totalReceived: 121, totalReceivable: 121, totalPaid: 35, totalPayable: 100 });

    await component.ngOnInit();

    expect(tripsApi.getPartyOrders).toHaveBeenCalledWith('12', 'S');
    expect(financeApi.summary).toHaveBeenCalledWith({ sellingPartyId: '12' });
    expect(component.paymentsTotal).toBe(35);
    expect(component.transactionTotal).toBe(100);
    expect(component.dueTotal).toBe(65);
    expect(component.transactionLabel).toBe('Sales');
    expect(component.orders[0]['tripId']).toBe(15);
    expect(component.orderColumns).toEqual(['tripId', 'orderTypeId', 'qty', 'weight', 'rate', 'sales', 'createDate']);
    expect(component.orderValue(15, 'tripId', component.orders[0])).toBe('TR0015');
    expect(component.orderColumnLabel('orderTypeId')).toBe('ORDER TYPE');
    expect(component.orderValue(1, 'orderTypeId', component.orders[0])).toBe('Broiler');
    expect(component.orderValue(undefined, 'sales', component.orders[0])).toBe('₹ 5500');
    expect(component.orderCreatedDate(component.orders[0])).toBe('2026-03-10');
  });
});
