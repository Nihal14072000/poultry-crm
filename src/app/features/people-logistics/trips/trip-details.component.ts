import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TripRecord, TripVendorPickup } from '../../../common/models/trip.model';
import { TripService } from '../../../common/services/trip.service';

@Component({
  selector: 'app-trip-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
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
    private readonly tripService: TripService
  ) {}

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('tripId') ?? '';
    if (!id) {
      this.errorMessage = 'A trip ID was not provided.';
      this.loading = false;
      return;
    }
    try {
      const details = await this.tripService.getTripDetails(id);
      this.trip = details.trip;
      this.vendorPickups = details.vendorPickups;
      this.supplierReceipts = details.supplierReceipts;
      this.vendorDestinations = details.vendorDestinations;
      this.deliveryEntries = details.deliveryEntries;
    } catch (error) {
      this.errorMessage = error instanceof Error
        ? error.message
        : 'Trip details could not be loaded. Return to the Trips list and try again.';
    } finally {
      this.loading = false;
    }
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
