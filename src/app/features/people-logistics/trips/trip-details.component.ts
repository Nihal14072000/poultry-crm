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
    } catch (error) {
      this.errorMessage = error instanceof Error
        ? error.message
        : 'Trip details could not be loaded. Return to the Trips list and try again.';
    } finally {
      this.loading = false;
    }
  }
}
