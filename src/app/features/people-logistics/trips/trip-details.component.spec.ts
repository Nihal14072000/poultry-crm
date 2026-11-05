import { ActivatedRoute } from '@angular/router';
import { TripDeliveryData, TripApiService } from '../../../common/services/trip-api.service';
import { TripDetailsComponent } from './trip-details.component';

describe('TripDetailsComponent', () => {
  let component: TripDetailsComponent;
  let tripApi: jasmine.SpyObj<TripApiService>;
  const destination = { vendorDestinationId: '51' };

  beforeEach(() => {
    window.sessionStorage.clear();
    const route = {
      snapshot: { paramMap: { get: () => '12' } }
    } as unknown as ActivatedRoute;
    tripApi = jasmine.createSpyObj<TripApiService>('TripApiService', ['getDeliveryData']);
    tripApi.getDeliveryData.and.resolveTo({
      trip: {},
      supplierPickups: [],
      supplierReceipts: [],
      destinations: [destination],
      deliveries: [{
        vendorDestinationId: '51',
        broiler: 5,
        broilerWeight: 10,
        broilerTotal: 1250,
        deliveryTotal: 1250
      }],
      loadedBroiler: 0,
      loadedCulls: 0,
      loadedBirds: 0
    } satisfies TripDeliveryData);
    component = new TripDetailsComponent(route, tripApi);
  });

  afterEach(() => window.sessionStorage.clear());

  it('includes pending actual deliveries in trip details', async () => {
    window.sessionStorage.setItem('trip-delivery-vendor-deliveries:12', JSON.stringify(['84']));

    await component.ngOnInit();

    expect(tripApi.getDeliveryData).toHaveBeenCalledWith('12', [], ['84']);
    expect(component.actualQuantity(destination, 'broiler')).toBe(5);
    expect(component.actualWeight(destination, 'broiler')).toBe(10);
    expect(component.actualLineRate(destination, 'broiler')).toBe(125);
  });

});
