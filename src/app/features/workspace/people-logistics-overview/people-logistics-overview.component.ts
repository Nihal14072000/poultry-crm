import { CommonModule, CurrencyPipe } from '@angular/common';
import { LoadingSkeletonComponent } from '../../../common/components/loading-skeleton/loading-skeleton.component';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TripRecord } from '../../../common/models/trip.model';
import { DriverDirectoryService } from '../../../common/services/driver-directory.service';
import { FinanceApiService } from '../../../common/services/finance-api.service';
import { RolePermissionService } from '../../../common/services/role-permission.service';
import { PartyDirectoryRecord, TripApiService } from '../../../common/services/trip-api.service';
import { StatusPillPipe } from '../../../common/pipes/status-pill.pipe';

type OverviewRecord = Record<string, string | number>;

export interface PartyDueSummary {
  id: number;
  name: string;
  contact: string;
  location: string;
  due: number;
}

@Component({
  selector: 'app-people-logistics-overview',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, LoadingSkeletonComponent, RouterLink, StatusPillPipe],
  templateUrl: './people-logistics-overview.component.html',
  styleUrl: './people-logistics-overview.component.css'
})
export class PeopleLogisticsOverviewComponent implements OnInit {
  employees: OverviewRecord[] = [];
  trips: TripRecord[] = [];
  sellingPartiesWithDues: PartyDueSummary[] = [];
  buyingPartiesToClear: PartyDueSummary[] = [];
  loading = true;
  errorMessage = '';
  tripsPage = 0;
  tripsPageSize = 5;
  sellingPage = 0;
  sellingPageSize = 5;
  buyingPage = 0;
  buyingPageSize = 5;

  constructor(
    private readonly drivers: DriverDirectoryService,
    private readonly tripApi: TripApiService,
    private readonly financeApi: FinanceApiService,
    readonly rolePermissions: RolePermissionService
  ) {}

  get canSeeEmployees(): boolean {
    return this.rolePermissions.canAccessRoute('employees');
  }

  get canSeeTrips(): boolean {
    return this.rolePermissions.canAccessRoute('trips');
  }

  get canSeeSellingParties(): boolean {
    return this.rolePermissions.canAccessRoute('vendor-destinations');
  }

  get canSeeBuyingParties(): boolean {
    return this.rolePermissions.canAccessRoute('suppliers');
  }

  get activeEmployees(): number {
    return this.employees.filter((employee) => String(employee['status']).toLowerCase() === 'active').length;
  }

  get totalSellingPartyDues(): number {
    return this.sellingPartiesWithDues.reduce((sum, party) => sum + party.due, 0);
  }

  get totalBuyingPartyClearance(): number {
    return this.buyingPartiesToClear.reduce((sum, party) => sum + party.due, 0);
  }

  get activeTrips(): number {
    return this.trips.filter((trip) => !['completed', 'closed', 'deleted'].includes(String(trip['status']).toLowerCase())).length;
  }

  get pagedTrips(): TripRecord[] {
    return this.trips.slice(this.tripsPage * this.tripsPageSize, (this.tripsPage + 1) * this.tripsPageSize);
  }
  get tripsTotalPages(): number { return Math.ceil(this.trips.length / this.tripsPageSize); }
  get tripsRangeStart(): number { return this.trips.length ? this.tripsPage * this.tripsPageSize + 1 : 0; }
  get tripsRangeEnd(): number { return Math.min((this.tripsPage + 1) * this.tripsPageSize, this.trips.length); }
  setTripsPage(page: number): void { this.tripsPage = Math.max(0, Math.min(page, Math.max(0, this.tripsTotalPages - 1))); }
  changeTripsPageSize(size: number): void { this.tripsPageSize = Number(size) || 5; this.tripsPage = 0; }

  get pagedSellingParties(): PartyDueSummary[] {
    return this.sellingPartiesWithDues.slice(this.sellingPage * this.sellingPageSize, (this.sellingPage + 1) * this.sellingPageSize);
  }
  get sellingTotalPages(): number { return Math.ceil(this.sellingPartiesWithDues.length / this.sellingPageSize); }
  get sellingRangeStart(): number { return this.sellingPartiesWithDues.length ? this.sellingPage * this.sellingPageSize + 1 : 0; }
  get sellingRangeEnd(): number { return Math.min((this.sellingPage + 1) * this.sellingPageSize, this.sellingPartiesWithDues.length); }
  setSellingPage(page: number): void { this.sellingPage = Math.max(0, Math.min(page, Math.max(0, this.sellingTotalPages - 1))); }
  changeSellingPageSize(size: number): void { this.sellingPageSize = Number(size) || 5; this.sellingPage = 0; }

  get pagedBuyingParties(): PartyDueSummary[] {
    return this.buyingPartiesToClear.slice(this.buyingPage * this.buyingPageSize, (this.buyingPage + 1) * this.buyingPageSize);
  }
  get buyingTotalPages(): number { return Math.ceil(this.buyingPartiesToClear.length / this.buyingPageSize); }
  get buyingRangeStart(): number { return this.buyingPartiesToClear.length ? this.buyingPage * this.buyingPageSize + 1 : 0; }
  get buyingRangeEnd(): number { return Math.min((this.buyingPage + 1) * this.buyingPageSize, this.buyingPartiesToClear.length); }
  setBuyingPage(page: number): void { this.buyingPage = Math.max(0, Math.min(page, Math.max(0, this.buyingTotalPages - 1))); }
  changeBuyingPageSize(size: number): void { this.buyingPageSize = Number(size) || 5; this.buyingPage = 0; }

  scrollToSection(sectionId: string): void {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async ngOnInit(): Promise<void> {
    const requests: [
      Promise<{ records: OverviewRecord[] }>,
      Promise<TripRecord[]>,
      Promise<PartyDirectoryRecord[]>,
      Promise<PartyDirectoryRecord[]>
    ] = [
      this.canSeeEmployees ? firstValueFrom(this.drivers.getDirectory()) : Promise.resolve({ records: [] }),
      this.canSeeTrips ? this.tripApi.getTrips() : Promise.resolve([]),
      this.canSeeSellingParties ? this.tripApi.getSellingParties() : Promise.resolve([]),
      this.canSeeBuyingParties ? this.tripApi.getBuyingParties() : Promise.resolve([])
    ];

    try {
      const [employees, trips, sellingParties, buyingParties] = await Promise.all(requests);
      this.employees = employees.records.filter((record) => this.rolePermissions.canAccessRecord('employees', record));
      this.trips = trips.filter((record) => this.rolePermissions.canAccessRecord('trips', record));

      const [sellingDues, buyingDues] = await Promise.all([
        this.loadPartyDues(sellingParties, 'S'),
        this.loadPartyDues(buyingParties, 'B')
      ]);
      this.sellingPartiesWithDues = sellingDues;
      this.buyingPartiesToClear = buyingDues;
    } catch {
      this.errorMessage = 'People and logistics data could not be loaded. Please refresh to try again.';
    } finally {
      this.loading = false;
    }
  }

  private async loadPartyDues(parties: PartyDirectoryRecord[], partyTypeCode: 'B' | 'S'): Promise<PartyDueSummary[]> {
    const activeParties = parties.filter((party) => !party.isDeleted);
    const summaries = await Promise.all(activeParties.map(async (party) => {
      const partyId = String(party.id);
      const [orderTotal, paymentTotal] = await Promise.all([
        this.tripApi.getPartyOrderTotal(partyId, partyTypeCode),
        this.financeApi.sumCompletedPaymentsByParty(partyId, partyTypeCode)
      ]);
      const due = (party.outstanding ?? 0) + orderTotal - paymentTotal;
      return {
        id: party.id,
        name: party.name,
        contact: party.contact,
        location: party.location,
        due
      };
    }));
    return summaries
      .filter((party) => party.due > 0)
      .sort((left, right) => right.due - left.due);
  }
}
