import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export type PaymentType = 'BUYER_RECEIPT' | 'SELLER_PAYOUT';
export type PaymentMethod = 'BANK_TRANSFER' | 'CASH' | 'CHEQUE' | 'UPI' | 'CARD' | 'OTHER';
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'VOID';
export interface FinanceRecord { [key: string]: unknown; }

export interface PaymentInput {
  paymentType: PaymentType;
  partyId: number;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  reference?: string;
  status: PaymentStatus;
  note?: string;
  tripId?: number;
}

@Injectable({ providedIn: 'root' })
export class FinanceApiService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  payments(): Promise<FinanceRecord[]> { return this.getList(`${this.baseUrl}/payments`).then(rows => rows.map(row => this.paymentRow(row))); }
  payment(id: string): Promise<FinanceRecord> { return firstValueFrom(this.http.get<FinanceRecord>(`${this.baseUrl}/payments/${encodeURIComponent(id)}`)); }
  createPayment(input: PaymentInput): Promise<FinanceRecord> {
    const { partyId, reference, ...payment } = input;
    return firstValueFrom(this.http.post<FinanceRecord>(`${this.baseUrl}/payments`, {
      ...payment,
      ...(input.paymentType === 'BUYER_RECEIPT' ? { buyingPartyId: partyId } : { sellingPartyId: partyId }),
      externalReference: reference
    }));
  }
  updatePayment(id: string, input: Partial<PaymentInput>): Promise<FinanceRecord> { return firstValueFrom(this.http.put<FinanceRecord>(`${this.baseUrl}/payments/${encodeURIComponent(id)}`, input)); }
  settlements(tripId?: string): Promise<FinanceRecord[]> {
    const path = tripId ? `${this.baseUrl}/finance/trips/${encodeURIComponent(tripId)}/settlements` : `${this.baseUrl}/finance/settlements`;
    return this.getList(path);
  }
  createSettlement(input: FinanceRecord): Promise<FinanceRecord> { return firstValueFrom(this.http.post<FinanceRecord>(`${this.baseUrl}/finance/settlements`, input)); }
  allocate(input: { paymentId: number; settlementId: number; amount: number }): Promise<FinanceRecord> {
    const { amount, ...allocation } = input;
    return firstValueFrom(this.http.post<FinanceRecord>(`${this.baseUrl}/finance/allocations`, { ...allocation, allocatedAmount: amount }));
  }
  receivables(filters: { tripId?: string; buyingPartyId?: string } = {}): Promise<FinanceRecord[]> {
    return this.getList(`${this.baseUrl}/finance/receivables`, filters).then(rows => rows.map(row => this.settlementRow(row, 'BUYER_RECEIPT')));
  }
  payables(filters: { tripId?: string; sellingPartyId?: string } = {}): Promise<FinanceRecord[]> {
    return this.getList(`${this.baseUrl}/finance/payables`, filters).then(rows => rows.map(row => this.settlementRow(row, 'SELLER_PAYOUT')));
  }
  async tripSummary(tripId: string): Promise<FinanceRecord> {
    const rows = await this.getList(`${this.baseUrl}/finance/trips/summary`, { tripId });
    const row = this.camelCaseRow(rows[0] ?? {});
    return { ...row, collections: row['totalReceived'], payouts: row['totalPaidToSellers'], brokerage: row['brokerageAssessed'] };
  }

  private async getList(url: string, values: Record<string, string | undefined> = {}): Promise<FinanceRecord[]> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(values)) if (value) params = params.set(key, value);
    const response = await firstValueFrom(this.http.get<FinanceRecord[] | { items?: FinanceRecord[]; data?: FinanceRecord[] }>(url, { params }));
    return Array.isArray(response) ? response : response.items ?? response.data ?? [];
  }

  private paymentRow(row: FinanceRecord): FinanceRecord {
    return { ...row, reference: row['externalReference'], partyId: row['buyingPartyId'] ?? row['sellingPartyId'] };
  }

  private settlementRow(row: FinanceRecord, settlementType: PaymentType): FinanceRecord {
    const value = this.camelCaseRow(row);
    const buyer = settlementType === 'BUYER_RECEIPT';
    return {
      ...value,
      id: value['settlementId'],
      settlementType,
      amountDue: buyer ? value['buyerDueAmount'] : undefined,
      amountPayable: buyer ? undefined : value['sellerDueAmount'],
      amountReceived: buyer ? value['receivedAmount'] : undefined,
      amountPaid: buyer ? undefined : value['paidAmount'],
      outstandingBalance: value['outstandingAmount'],
      brokerage: value['brokerageAmount'],
      buyerName: value['buyingPartyName'],
      sellerName: value['sellingPartyName'],
      status: value['balanceStatus']
    };
  }

  private camelCaseRow(row: FinanceRecord): FinanceRecord {
    return Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()), value]));
  }
}
