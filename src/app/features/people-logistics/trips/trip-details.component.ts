import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TripRecord, TripVendorPickup } from '../../../common/models/trip.model';
import { TripApiService } from '../../../common/services/trip-api.service';
import { StatusPillPipe } from '../../../common/pipes/status-pill.pipe';

@Component({
  selector: 'app-trip-details',
  standalone: true,
  imports: [CommonModule, RouterLink, StatusPillPipe],
  templateUrl: './trip-details.component.html',
  styleUrl: './trip-details.component.css'
})
export class TripDetailsComponent implements OnInit {
  trip?: TripRecord;
  vendorPickups: TripVendorPickup[] = [];
  supplierReceipts: TripRecord[] = [];
  vendorDestinations: TripRecord[] = [];
  deliveryEntries: TripRecord[] = [];
  loading = true;
  errorMessage = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly tripService: TripApiService
  ) {}

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('tripId') ?? '';
    if (!id) {
      this.errorMessage = 'A trip ID was not provided.';
      this.loading = false;
      return;
    }
    try {
      const details = await this.tripService.getDeliveryData(id, [], this.pendingVendorDeliveryIds(id));
      this.trip = details.trip;
      this.vendorPickups = details.supplierPickups;
      this.supplierReceipts = details.supplierReceipts;
      this.vendorDestinations = details.destinations;
      this.deliveryEntries = details.deliveries;
    } catch (error) {
      this.errorMessage = error instanceof Error
        ? error.message
        : 'Trip details could not be loaded. Return to the Trips list and try again.';
    } finally {
      this.loading = false;
    }
  }

  private pendingVendorDeliveryIds(tripId: string): string[] {
    if (typeof window === 'undefined') return [];
    const stored = window.sessionStorage.getItem(`trip-delivery-vendor-deliveries:${tripId}`);
    if (!stored) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(stored);
    } catch {
      throw new Error("Saved vendor delivery IDs could not be read. Clear this trip's pending delivery data and try again.");
    }
    if (!Array.isArray(parsed) || !parsed.every((id): id is string => typeof id === 'string' && /^\d+$/.test(id))) {
      throw new Error("Saved vendor delivery IDs are invalid. Clear this trip's pending delivery data and try again.");
    }
    return [...new Set(parsed)];
  }

  plannedSalesTotal(): number {
    return this.vendorDestinations.reduce((sum, destination) => sum + Number(destination['deliveryTotal'] ?? 0), 0);
  }

  actualSalesTotal(): number {
    return this.deliveryEntries.reduce((sum, entry) => sum + Number(entry['deliveryTotal'] ?? 0), 0);
  }

  actualQuantity(destination: TripRecord, kind: 'broiler' | 'culls' | 'feed'): number {
    const id = String(destination['vendorDestinationId'] ?? '');
    return this.deliveryEntries.filter((entry) => String(entry['vendorDestinationId'] ?? '') === id)
      .reduce((sum, entry) => sum + Number(entry[kind] ?? 0), 0);
  }

  actualWeight(destination: TripRecord, kind: 'broiler' | 'culls' | 'feed'): number {
    const id = String(destination['vendorDestinationId'] ?? '');
    return this.deliveryEntries.filter((entry) => String(entry['vendorDestinationId'] ?? '') === id)
      .reduce((sum, entry) => sum + Number(entry[`${kind}Weight`] ?? 0), 0);
  }

  actualLineSales(destination: TripRecord, kind: 'broiler' | 'culls' | 'feed'): number {
    const id = String(destination['vendorDestinationId'] ?? '');
    return this.deliveryEntries.filter((entry) => String(entry['vendorDestinationId'] ?? '') === id)
      .reduce((sum, entry) => sum + Number(entry[`${kind}Total`] ?? 0), 0);
  }

  actualLineRate(destination: TripRecord, kind: 'broiler' | 'culls' | 'feed'): number {
    const weight = this.actualWeight(destination, kind);
    return weight > 0 ? this.actualLineSales(destination, kind) / weight : 0;
  }

  actualPickup(vendorId: string): TripRecord | undefined {
    return this.supplierReceipts.find((receipt) => String(receipt['vendorId'] ?? '') === vendorId);
  }

  actualPickupValue(vendorId: string, kind: 'broiler' | 'culls' | 'feed', value: 'Quantity' | 'Weight' | 'Total'): number {
    return Number(this.actualPickup(vendorId)?.[`${kind}${value}`] ?? 0);
  }

  actualSupplierCostTotal(): number {
    return this.supplierReceipts.reduce((sum, receipt) => sum + Number(receipt['total'] ?? 0), 0);
  }

  grossProfit(): number {
    return this.actualSupplierCostTotal() - this.actualSalesTotal();
  }

  actualPickupTotal(vendorId: string): number {
    return Number(this.actualPickup(vendorId)?.['total'] ?? 0);
  }
}
