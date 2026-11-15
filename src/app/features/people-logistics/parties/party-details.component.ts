import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FinanceApiService, FinanceRecord } from '../../../common/services/finance-api.service';
import { TripRecord } from '../../../common/models/trip.model';
import { PartyDirectoryRecord, TripApiService } from '../../../common/services/trip-api.service';

type PartyType = 'buying' | 'selling';

@Component({
  selector: 'app-party-details',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './party-details.component.html',
  styleUrl: './party-details.component.css'
})
export class PartyDetailsComponent implements OnInit {
  partyType: PartyType = 'buying';
  party?: PartyDirectoryRecord;
  trips: TripRecord[] = [];
  orders: Record<string, unknown>[] = [];
  payments: FinanceRecord[] = [];
  activeTab: 'orders' | 'payments' = 'orders';
  readonly orderColumns = ['tripId', 'orderTypeId', 'qty', 'weight', 'rate', 'sales', 'createDate'];
  financeSummary: FinanceRecord = {};
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
      const [parties, allTrips, financeSummary, orders, payments] = await Promise.all([
        this.partyType === 'buying' ? this.tripsApi.getBuyingParties() : this.tripsApi.getSellingParties(),
        this.tripsApi.getTrips(),
        this.financeApi.summary(this.partyType === 'buying' ? { buyingPartyId: partyId } : { sellingPartyId: partyId }),
        this.tripsApi.getPartyOrders(partyId, this.partyType === 'buying' ? 'B' : 'S'),
        this.financeApi.payments()
      ]);
      this.party = parties.find((party) => String(party.id) === partyId);
      if (!this.party) throw new Error('This party could not be found.');
      this.orders = orders;
      this.financeSummary = financeSummary;
      const paymentType = this.partyType === 'buying' ? 'BUYER_RECEIPT' : 'SELLER_PAYOUT';
      this.payments = payments.filter((payment) =>
        payment['isDeleted'] !== true &&
        String(payment['partyId'] ?? payment['buyingPartyId'] ?? payment['sellingPartyId'] ?? '') === partyId &&
        String(payment['paymentType'] ?? payment['type'] ?? '') === paymentType
      );

      const tripDetails = await Promise.all(allTrips.map((trip) =>
        this.tripsApi.getTripDetails(String(trip['_demoId']))
      ));
      this.trips = allTrips.filter((trip, index) => {
        const details = tripDetails[index];
        return this.partyType === 'buying'
          ? details.vendorPickups.some((pickup) => pickup.vendorId === partyId)
          : details.vendorDestinations.some((destination) => String(destination['vendorDestinationId']) === partyId);
      });

    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Party details could not be loaded.';
    } finally {
      this.loading = false;
    }
  }

  get paymentsTotal(): number {
    return this.money(this.financeSummary, this.partyType === 'buying' ? 'totalReceived' : 'totalPaid');
  }

  get transactionTotal(): number {
    return this.money(this.financeSummary, this.partyType === 'buying' ? 'totalReceivable' : 'totalPayable');
  }

  get dueTotal(): number {
    return this.transactionTotal - this.paymentsTotal;
  }

  get transactionLabel(): string {
    return this.partyType === 'buying' ? 'Purchase' : 'Sales';
  }

  tripDate(trip: TripRecord): string {
    return String(trip['tripDate'] ?? '');
  }

  orderColumnLabel(column: string): string {
    const labels: Record<string, string> = {
      tripId: 'TRIP ID',
      orderTypeId: 'ORDER TYPE',
      qty: 'QTY',
      weight: 'WT',
      rate: 'RATE',
      sales: 'SALES',
      createDate: 'CREATED DATE'
    };
    return labels[column] ?? column;
  }

  orderValue(value: unknown, column: string, order: Record<string, unknown>): string {
    if (column === 'orderTypeId' && order['orderTypeName']) return String(order['orderTypeName']);
    if (column === 'tripId') return `TR00${value ?? ''}`;
    if (column === 'sales') {
      const weight = Number(order['weight']);
      const rate = Number(order['rate']);
      return order['weight'] != null && order['weight'] !== '' &&
        order['rate'] != null && order['rate'] !== '' && Number.isFinite(weight * rate)
        ? `₹ ${weight * rate}`
        : '—';
    }
    if (value == null || value === '') return '—';
    return typeof value === 'object' ? JSON.stringify(value) ?? String(value) : String(value);
  }

  orderCreatedDate(order: Record<string, unknown>): string | null {
    const value = order['createDate'] ?? order['createdDate'] ?? order['createdAt'];
    return value == null || value === '' ? null : String(value);
  }

  paymentText(payment: FinanceRecord, ...keys: string[]): string {
    for (const key of keys) {
      const value = payment[key];
      if (value != null && value !== '') return String(value);
    }
    return '—';
  }

  paymentDate(payment: FinanceRecord): string | null {
    const value = payment['paymentDate'] ?? payment['date'] ?? payment['createdAt'];
    return value == null || value === '' ? null : String(value);
  }

  paymentAmount(payment: FinanceRecord): number {
    return this.money(payment, 'amount');
  }

  private money(record: FinanceRecord, ...keys: string[]): number {
    for (const key of keys) {
      const value = Number(record[key]);
      if (record[key] != null && Number.isFinite(value)) return value;
    }
    return 0;
  }
}
