import { ActivatedRoute } from '@angular/router';
import { FinanceApiService } from '../../../common/services/finance-api.service';
import { TripApiService } from '../../../common/services/trip-api.service';
import { PartyDetailsComponent } from './party-details.component';

describe('PartyDetailsComponent', () => {
  let tripsApi: jasmine.SpyObj<TripApiService>;
  let financeApi: jasmine.SpyObj<FinanceApiService>;
  let component: PartyDetailsComponent;

  beforeEach(() => {
    tripsApi = jasmine.createSpyObj<TripApiService>('TripApiService', ['getBuyingParties', 'getSellingParties', 'getTrips', 'getTripDetails']);
    financeApi = jasmine.createSpyObj<FinanceApiService>('FinanceApiService', ['payments', 'receivables', 'payables']);
    component = new PartyDetailsComponent({
      snapshot: { data: { partyType: 'buying' }, paramMap: { get: () => '7' } }
    } as unknown as ActivatedRoute, tripsApi, financeApi);
  });

  it('shows only this party’s trips and sums received and due for the selected month', async () => {
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
    financeApi.payments.and.resolveTo([
      { partyId: 7, paymentType: 'BUYER_RECEIPT', status: 'COMPLETED', paymentDate: '2026-03-02', amount: 125 },
      { partyId: 7, paymentType: 'BUYER_RECEIPT', status: 'PENDING', paymentDate: '2026-03-03', amount: 50 }
    ]);
    financeApi.receivables.and.resolveTo([
      { dueDate: '2026-03-20', outstandingBalance: 75 },
      { dueDate: '2026-02-20', outstandingBalance: 40 }
    ]);

    await component.ngOnInit();
    component.selectedMonth = '2026-03';

    expect(component.trips.map((trip) => trip['_demoId'])).toEqual(['11']);
    expect(component.receivedTotal).toBe(125);
    expect(component.dueTotal).toBe(75);
    expect(component.selectedMonthLabel).toBe('March 2026');
  });
});
