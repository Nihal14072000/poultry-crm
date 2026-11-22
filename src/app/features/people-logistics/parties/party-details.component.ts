import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FinanceApiService, FinanceRecord } from '../../../common/services/finance-api.service';
import { PartyDirectoryRecord, TripApiService } from '../../../common/services/trip-api.service';
import { PartyLoadingSkeletonComponent } from './party-loading-skeleton.component';

type PartyType = 'buying' | 'selling';

@Component({
  selector: 'app-party-details',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, RouterLink, PartyLoadingSkeletonComponent],
  templateUrl: './party-details.component.html',
  styleUrl: './party-details.component.css'
})
export class PartyDetailsComponent implements OnInit {
  partyType: PartyType = 'buying';
  party?: PartyDirectoryRecord;
  orders: Record<string, unknown>[] = [];
  payments: FinanceRecord[] = [];
  activeTab: 'orders' | 'payments' = 'orders';
  readonly orderColumns = ['tripId', 'orderTypeId', 'qty', 'weight', 'rate', 'sales', 'createDate'];
  partyOrderTotal = 0;
  partyPaymentTotal = 0;
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
      const partyTypeCode = this.partyType === 'buying' ? 'B' : 'S';
      const [parties, partyOrderTotal, partyPaymentTotal, orders, payments] = await Promise.all([
        this.partyType === 'buying' ? this.tripsApi.getBuyingParties() : this.tripsApi.getSellingParties(),
        this.tripsApi.getPartyOrderTotal(partyId, partyTypeCode),
        this.financeApi.sumCompletedPaymentsByParty(partyId, partyTypeCode),
        this.tripsApi.getPartyOrders(partyId, partyTypeCode),
        this.financeApi.paymentsForParty(partyId, partyTypeCode)
      ]);
      this.party = parties.find((party) => String(party.id) === partyId);
      if (!this.party) throw new Error('This party could not be found.');
      this.orders = orders;
      this.partyOrderTotal = partyOrderTotal;
      this.partyPaymentTotal = partyPaymentTotal;
      this.payments = payments.filter((payment) => payment['isDeleted'] !== true);

    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Party details could not be loaded.';
    } finally {
      this.loading = false;
    }
  }

  get paymentsTotal(): number {
    return this.partyPaymentTotal;
  }

  get transactionTotal(): number {
    return this.partyOrderTotal;
  }

  get dueTotal(): number {
    return this.transactionTotal - this.paymentsTotal;
  }

  get transactionLabel(): string {
    return this.partyType === 'buying' ? 'Purchase' : 'Sales';
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
        ? `₹ ${Math.round(weight * rate)}`
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
