import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FinanceApiService, FinanceRecord, PaymentType } from '../../../common/services/finance-api.service';
import { TripRecord } from '../../../common/models/trip.model';
import { PartyDirectoryRecord, TripApiService } from '../../../common/services/trip-api.service';

type PartyType = 'buying' | 'selling';
type MonthOption = { value: string; label: string };

@Component({
  selector: 'app-party-details',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, FormsModule, RouterLink],
  templateUrl: './party-details.component.html',
  styleUrl: './party-details.component.css'
})
export class PartyDetailsComponent implements OnInit {
  partyType: PartyType = 'buying';
  party?: PartyDirectoryRecord;
  trips: TripRecord[] = [];
  payments: FinanceRecord[] = [];
  dues: FinanceRecord[] = [];
  months: MonthOption[] = [];
  selectedMonth = '';
  loading = true;
  errorMessage = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly tripsApi: TripApiService,
    private readonly financeApi: FinanceApiService
  ) {}

  async ngOnInit(): Promise<void> {
    this.partyType = this.route.snapshot.data['partyType'] === 'selling' ? 'selling' : 'buying';
    const partyId = this.route.snapshot.paramMap.get('partyId') ?? '';
    if (!/^\d+$/.test(partyId) || Number(partyId) < 1) {
      this.errorMessage = 'A valid party ID was not provided.';
      this.loading = false;
      return;
    }

    try {
      const [parties, allTrips, payments, dues] = await Promise.all([
        this.partyType === 'buying' ? this.tripsApi.getBuyingParties() : this.tripsApi.getSellingParties(),
        this.tripsApi.getTrips(),
        this.financeApi.payments(),
        this.partyType === 'buying'
          ? this.financeApi.receivables({ buyingPartyId: partyId })
          : this.financeApi.payables({ sellingPartyId: partyId })
      ]);
      this.party = parties.find((party) => String(party.id) === partyId);
      if (!this.party) throw new Error('This party could not be found.');

      const tripDetails = await Promise.all(allTrips.map((trip) =>
        this.tripsApi.getTripDetails(String(trip['_demoId']))
      ));
      this.trips = allTrips.filter((trip, index) => {
        const details = tripDetails[index];
        return this.partyType === 'buying'
          ? details.vendorPickups.some((pickup) => pickup.vendorId === partyId)
          : details.vendorDestinations.some((destination) => String(destination['vendorDestinationId']) === partyId);
      });

      const paymentType: PaymentType = this.partyType === 'buying' ? 'BUYER_RECEIPT' : 'SELLER_PAYOUT';
      this.payments = payments.filter((payment) =>
        payment['isDeleted'] !== true &&
        payment['status'] === 'COMPLETED' &&
        String(payment['partyId'] ?? payment['buyingPartyId'] ?? payment['sellingPartyId'] ?? '') === partyId &&
        String(payment['paymentType'] ?? payment['type'] ?? '') === paymentType
      );
      this.dues = dues.filter((due) => due['isDeleted'] !== true);
      this.months = this.createMonths();
      this.selectedMonth = this.months[0]?.value ?? '';
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Party details could not be loaded.';
    } finally {
      this.loading = false;
    }
  }

  get receivedTotal(): number {
    return this.payments.filter((payment) => this.monthOf(payment['paymentDate'] ?? payment['date'] ?? payment['createdAt']) === this.selectedMonth)
      .reduce((sum, payment) => sum + this.money(payment, 'amount'), 0);
  }

  get selectedMonthLabel(): string {
    return this.months.find((month) => month.value === this.selectedMonth)?.label ?? '';
  }

  get dueTotal(): number {
    return this.dues.filter((due) => this.monthOf(due['dueDate'] ?? due['tripDate'] ?? due['date'] ?? due['createdAt']) === this.selectedMonth)
      .reduce((sum, due) => sum + this.money(due, 'outstandingBalance', 'amountDue', 'amountPayable', 'amount'), 0);
  }

  get receivedLabel(): string {
    return this.partyType === 'buying' ? 'Payment received' : 'Payment paid';
  }

  get dueLabel(): string {
    return this.partyType === 'buying' ? 'Payment due to us' : 'Payment due to party';
  }

  tripDate(trip: TripRecord): string {
    return String(trip['tripDate'] ?? '');
  }

  private createMonths(): MonthOption[] {
    const keys = new Set<string>([new Date().toISOString().slice(0, 7)]);
    for (const payment of this.payments) {
      const month = this.monthOf(payment['paymentDate'] ?? payment['date'] ?? payment['createdAt']);
      if (month) keys.add(month);
    }
    for (const due of this.dues) {
      const month = this.monthOf(due['dueDate'] ?? due['tripDate'] ?? due['date'] ?? due['createdAt']);
      if (month) keys.add(month);
    }
    return [...keys].sort((a, b) => b.localeCompare(a)).map((value) => ({
      value,
      label: new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })
        .format(new Date(`${value}-01T00:00:00Z`))
    }));
  }

  private monthOf(value: unknown): string {
    const date = String(value ?? '');
    const match = /^(\d{4}-\d{2})/.exec(date);
    return match ? match[1] : '';
  }

  private money(record: FinanceRecord, ...keys: string[]): number {
    for (const key of keys) {
      const value = Number(record[key]);
      if (record[key] != null && Number.isFinite(value)) return value;
    }
    return 0;
  }
}
