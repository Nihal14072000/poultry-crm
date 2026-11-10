import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FinanceApiService, FinanceRecord, PaymentInput, PaymentMethod, PaymentStatus, PaymentType } from '../../../common/services/finance-api.service';
import { TripRecord } from '../../../common/models/trip.model';
import { TripApiService } from '../../../common/services/trip-api.service';
import { RolePermissionService } from '../../../common/services/role-permission.service';
import { StatusPillPipe } from '../../../common/pipes/status-pill.pipe';

type View = 'overview' | 'receivables' | 'payables' | 'payments' | 'record' | 'allocate' | 'trip-summary';
type FormValue = Omit<PaymentInput, 'partyId'> & { partyId: number | null };
type PaymentPartyOption = TripRecord & { paymentType: PaymentType };
type PaymentTrend = { label: string; month: string; receipts: number; payouts: number };

@Component({ selector: 'app-payment-center', standalone: true, imports: [CommonModule, FormsModule, RouterLink, CurrencyPipe, StatusPillPipe], templateUrl: './payment-center.component.html', styleUrl: './payment-center.component.css' })
export class PaymentCenterComponent implements OnInit {
  view: View = 'overview'; loading = true; saving = false; error = ''; success = ''; query = ''; statusFilter = ''; tripId = ''; partyId = ''; paymentPartyFilter = '';
  trips: TripRecord[] = []; parties: TripRecord[] = []; paymentParties: PaymentPartyOption[] = []; records: FinanceRecord[] = []; payments: FinanceRecord[] = []; settlements: FinanceRecord[] = []; summary?: FinanceRecord; financeSummary?: FinanceRecord;
  selectedPaymentId = ''; allocations: Record<string, number> = {}; editingPaymentId = ''; deleteCandidate?: FinanceRecord;
  readonly methods: PaymentMethod[] = ['BANK_TRANSFER', 'CASH', 'CHEQUE', 'UPI', 'CARD', 'OTHER'];
  readonly statuses: PaymentStatus[] = ['PENDING', 'COMPLETED', 'FAILED', 'VOID'];
  form: FormValue = this.newForm();
  constructor(private readonly route: ActivatedRoute, private readonly router: Router, private readonly api: FinanceApiService, private readonly tripsApi: TripApiService, readonly permissions: RolePermissionService) {}
  async ngOnInit(): Promise<void> { this.view = this.route.snapshot.routeConfig?.path as View || 'overview'; this.tripId = this.route.snapshot.queryParamMap.get('tripId') ?? ''; await this.load(); }
  async load(): Promise<void> {
    this.loading = true; this.error = '';
    if (this.view === 'overview') this.financeSummary = undefined;
    try {
      if (!this.trips.length) {
        const [options, trips] = await Promise.all([this.tripsApi.getFormOptions(), this.tripsApi.getTrips()]);
        this.trips = trips;
        this.parties = this.form.paymentType === 'BUYER_RECEIPT' ? options.deliveryVendors : options.suppliers;
        this.paymentParties = [
          ...options.suppliers.map(party => ({ ...party, _demoId: `BUYER_RECEIPT:${party['_demoId']}`, paymentType: 'BUYER_RECEIPT' as const })),
          ...options.deliveryVendors.map(party => ({ ...party, _demoId: `SELLER_PAYOUT:${party['_demoId']}`, paymentType: 'SELLER_PAYOUT' as const }))
        ];
      }
      if (this.view === 'receivables') this.records = await this.api.receivables({ tripId: this.tripId || undefined, buyingPartyId: this.partyId || undefined });
      else if (this.view === 'payables') this.records = await this.api.payables({ tripId: this.tripId || undefined, sellingPartyId: this.partyId || undefined });
      else if (this.view === 'payments') this.payments = await this.api.payments();
      else if (this.view === 'allocate') {
        const [payments, receivables, payables] = await Promise.all([
          this.api.payments(),
          this.api.receivables(this.tripId ? { tripId: this.tripId } : {}),
          this.api.payables(this.tripId ? { tripId: this.tripId } : {})
        ]);
        this.payments = payments;
        this.settlements = [...receivables, ...payables];
      }
      else if (this.view === 'trip-summary' && this.tripId) this.summary = await this.api.tripSummary(this.tripId);
      else if (this.view === 'overview') { const [summary, receivables, payables, payments] = await Promise.all([this.tripId ? Promise.resolve(undefined) : this.api.summary(), this.api.receivables(this.tripId ? { tripId: this.tripId } : {}), this.api.payables(this.tripId ? { tripId: this.tripId } : {}), this.api.payments()]); this.financeSummary = summary; this.records = [...receivables, ...payables]; this.payments = payments; }
    } catch (e) { this.error = e instanceof Error ? e.message : 'Finance data could not be loaded.'; } finally { this.loading = false; }
  }
  get filtered(): FinanceRecord[] { const q = this.query.trim().toLowerCase(); const [partyType, partyId] = this.paymentPartyFilter.split(':'); return (this.view === 'payments' ? this.payments : this.records).filter(row => (!q || Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q))) && (!this.statusFilter || this.text(row, 'status') === this.statusFilter) && (this.view !== 'payments' || !this.paymentPartyFilter || (this.text(row, 'paymentType', 'type') === partyType && this.text(row, 'partyId', 'buyingPartyId', 'sellingPartyId') === partyId))); }
  get completedPayments(): FinanceRecord[] { return this.payments.filter(p => p['isDeleted'] !== true && this.text(p, 'status') === 'COMPLETED'); }
  get selectedPayment(): FinanceRecord | undefined { return this.completedPayments.find(p => this.id(p) === this.selectedPaymentId); }
  get paymentRemaining(): number { return this.money(this.selectedPayment, 'remainingAmount', 'unallocatedAmount', 'amount') - Object.values(this.allocations).reduce((a, b) => a + (Number(b) || 0), 0); }
  get monthlyTrend(): PaymentTrend[] {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1));
      return {
        month: date.toISOString().slice(0, 7),
        label: new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(date),
        receipts: 0,
        payouts: 0
      };
    });
    for (const payment of this.payments) {
      if (payment['isDeleted'] === true || this.text(payment, 'status') !== 'COMPLETED'
        || (this.tripId && this.text(payment, 'tripId') !== this.tripId)) continue;
      const date = new Date(this.text(payment, 'paymentDate', 'date', 'createdAt'));
      if (!Number.isFinite(date.getTime())) continue;
      const month = months.find(item => item.month === date.toISOString().slice(0, 7));
      if (!month) continue;
      const type = this.text(payment, 'paymentType', 'type');
      if (type === 'BUYER_RECEIPT') month.receipts += this.money(payment, 'amount');
      else if (type === 'SELLER_PAYOUT') month.payouts += this.money(payment, 'amount');
    }
    return months;
  }
  get balanceComparison(): { label: string; value: number }[] {
    return [
      { label: 'Receivables', value: this.records.filter(this.isReceivable, this).reduce((sum, row) => sum + this.money(row, 'outstandingBalance', 'amountDue', 'amount'), 0) },
      { label: 'Payables', value: this.records.filter(row => !this.isReceivable(row)).reduce((sum, row) => sum + this.money(row, 'outstandingBalance', 'amountPayable', 'amount'), 0) }
    ];
  }
  get trendMaximum(): number {
    return Math.max(0, ...this.monthlyTrend.flatMap(month => [month.receipts, month.payouts]));
  }
  get trendAxisValues(): number[] {
    return [this.trendMaximum, this.trendMaximum / 2, 0];
  }
  trendPoints(series: 'receipts' | 'payouts'): string {
    const trend = this.monthlyTrend;
    const max = Math.max(1, this.trendMaximum);
    return trend.map((month, index) => `${this.trendX(index)},${this.trendY(month[series], max)}`).join(' ');
  }
  trendX(index: number): number { return index * (480 / (this.monthlyTrend.length - 1)); }
  trendY(value: number, max = Math.max(1, this.trendMaximum)): number { return 150 - value / max * 132; }
  balanceWidth(value: number): number {
    const max = Math.max(0, ...this.balanceComparison.map(item => item.value));
    return max ? value / max * 100 : 0;
  }
  get metrics(): { label: string; value: number }[] {
    if (this.financeSummary) return [
      { label: 'Buyer amounts due', value: this.money(this.financeSummary, 'totalReceivable') },
      { label: 'Receipts collected', value: this.money(this.financeSummary, 'totalReceived') },
      { label: 'Seller amounts payable', value: this.money(this.financeSummary, 'totalPayable') },
      { label: 'Payouts made', value: this.money(this.financeSummary, 'totalPaid') }
    ];
    const payments = this.payments.filter(payment => payment['isDeleted'] !== true && this.text(payment, 'status') === 'COMPLETED'
      && (!this.tripId || this.text(payment, 'tripId') === this.tripId));
    return [
      { label: 'Buyer amounts due', value: this.records.filter(this.isReceivable, this).reduce((sum, row) => sum + this.money(row, 'amountDue', 'amount'), 0) },
      { label: 'Receipts collected', value: payments.filter(payment => this.text(payment, 'paymentType', 'type') === 'BUYER_RECEIPT').reduce((sum, payment) => sum + this.money(payment, 'amount'), 0) },
      { label: 'Seller amounts payable', value: this.records.filter(row => !this.isReceivable(row)).reduce((sum, row) => sum + this.money(row, 'amountPayable', 'amount'), 0) },
      { label: 'Payouts made', value: payments.filter(payment => this.text(payment, 'paymentType', 'type') === 'SELLER_PAYOUT').reduce((sum, payment) => sum + this.money(payment, 'amount'), 0) }
    ];
  }
  setPaymentType(type: PaymentType): void { this.form.paymentType = type; this.form.partyId = null; this.parties = []; void this.loadPartyOptions(); }
  async loadPartyOptions(): Promise<void> { try { const options = await this.tripsApi.getFormOptions(); this.parties = this.form.paymentType === 'BUYER_RECEIPT' ? options.deliveryVendors : options.suppliers; } catch { this.error = 'Parties could not be loaded.'; } }
  async editPayment(payment: FinanceRecord): Promise<void> {
    if (!this.permissions.can('payments', 'update')) return;
    if (!this.id(payment)) {
      this.error = 'This payment is missing its ID and cannot be edited.';
      return;
    }
    const paymentType = this.text(payment, 'paymentType', 'type');
    if (!['BUYER_RECEIPT', 'SELLER_PAYOUT'].includes(paymentType)) {
      this.error = 'This payment has an unsupported type and cannot be edited.';
      return;
    }
    this.error = '';
    this.success = '';
    this.editingPaymentId = this.id(payment);
    this.form = {
      paymentType: paymentType as PaymentType,
      partyId: Number(this.text(payment, 'partyId', 'buyingPartyId', 'sellingPartyId')) || null,
      amount: this.money(payment, 'amount'),
      paymentDate: this.text(payment, 'paymentDate', 'date', 'createdAt').slice(0, 10),
      paymentMethod: this.text(payment, 'paymentMethod', 'method') as PaymentMethod,
      reference: this.text(payment, 'reference', 'externalReference', 'paymentReference'),
      status: this.text(payment, 'status') as PaymentStatus,
      note: this.text(payment, 'note'),
      tripId: Number(this.text(payment, 'tripId')) || undefined
    };
    await this.loadPartyOptions();
  }
  closePaymentEditor(): void {
    if (this.saving) return;
    this.editingPaymentId = '';
  }
  async savePayment(): Promise<void> {
    if (!(this.editingPaymentId ? this.permissions.can('payments', 'update') : this.permissions.can('payments', 'create')) || !this.validForm()) return;
    this.saving = true; this.error = '';
    try {
      if (this.editingPaymentId) {
        const updated = await this.api.updatePayment(this.editingPaymentId, this.form as PaymentInput);
        this.payments = this.payments.map(payment => this.id(payment) === this.editingPaymentId ? { ...payment, ...updated } : payment);
        this.success = 'Payment updated.';
        this.editingPaymentId = '';
      } else {
        await this.api.createPayment(this.form as PaymentInput);
        this.success = 'Payment recorded.';
        this.form = this.newForm();
      }
    } catch (e) { this.error = e instanceof Error ? e.message : 'Payment could not be saved.'; }
    finally { this.saving = false; }
  }
  requestDeletePayment(payment: FinanceRecord): void {
    if (!this.permissions.can('payments', 'delete') || payment['isDeleted'] === true) return;
    this.error = '';
    this.success = '';
    if (!this.id(payment)) {
      this.error = 'This payment is missing its ID and cannot be marked deleted.';
      return;
    }
    this.deleteCandidate = payment;
  }
  cancelDeletePayment(): void {
    if (this.saving) return;
    this.deleteCandidate = undefined;
  }
  async deletePayment(): Promise<void> {
    const payment = this.deleteCandidate;
    const id = this.id(payment);
    if (!payment || !id || !this.permissions.can('payments', 'delete') || this.saving) return;
    this.saving = true;
    this.error = '';
    try {
      await this.api.updatePayment(id, { isDeleted: true, isActive: false });
      payment['isDeleted'] = true;
      payment['isActive'] = false;
      this.success = 'Payment deleted.';
      this.deleteCandidate = undefined;
    } catch (e) { this.error = e instanceof Error ? e.message : 'Payment could not be deleted.'; }
    finally { this.saving = false; }
  }
  async submitAllocations(): Promise<void> { if (!this.selectedPayment || !this.permissions.can('payments','update')) return; const rows = Object.entries(this.allocations).filter(([, amount]) => Number(amount)>0); if (!rows.length || this.paymentRemaining < 0) { this.error='Enter allocations within the remaining payment amount.'; return; } for (const [id, amount] of rows) { const settlement = this.settlements.find(s=>this.id(s)===id); if (!settlement || Number(amount)>this.money(settlement,'outstandingBalance','balance')) { this.error='An allocation exceeds its settlement balance.'; return; } } this.saving=true; this.error=''; try { for (const [settlementId, amount] of rows) await this.api.allocate({paymentId:Number(this.id(this.selectedPayment)),settlementId:Number(settlementId),amount:Number(amount)}); this.success='Allocation saved.'; this.allocations={}; await this.load(); } catch(e) { this.error=e instanceof Error?e.message:'Allocation could not be saved.'; } finally { this.saving=false; } }
  changeTrip(): void { void this.load(); }
  validForm(): boolean { const f=this.form; if (!f.partyId || !Number.isFinite(Number(f.amount)) || Number(f.amount)<=0 || !/^\d{4}-\d{2}-\d{2}$/.test(f.paymentDate)) { this.error='Party, positive amount, and payment date are required.'; return false; } return true; }
  id(row?: FinanceRecord): string { return String(row?.['id'] ?? row?.['paymentId'] ?? row?.['settlementId'] ?? ''); }
  text(row: FinanceRecord | undefined, ...keys: string[]): string { for (const key of keys) if (row?.[key] != null) return String(row[key]); return ''; }
  paymentPartyName(row: FinanceRecord): string {
    const name = this.text(row, 'partyName', 'buyingPartyName', 'sellingPartyName');
    if (name) return name;
    for (const key of ['buyingParty', 'sellingParty']) {
      const party = row[key];
      if (typeof party === 'object' && party !== null && 'name' in party && party['name'] != null) return String(party['name']);
    }
    return this.text(row, 'partyId', 'buyingPartyId', 'sellingPartyId');
  }
  paymentTrip(row: FinanceRecord): TripRecord | undefined {
    const tripId = this.text(row, 'tripId');
    return this.trips.find(trip => String(trip['_demoId']) === tripId);
  }
  money(row: FinanceRecord | undefined, ...keys: string[]): number { for (const key of keys) { const value=row?.[key]; if (value != null && Number.isFinite(Number(value))) return Number(value); } return 0; }
  isReceivable(row: FinanceRecord): boolean { return this.text(row,'settlementType','type','paymentType').includes('BUYER') || !!row['buyingPartyId']; }
  allocationAllowed(settlement: FinanceRecord): boolean { const payment=this.selectedPayment; if (!payment) return false; return this.text(payment,'paymentType','type') === 'BUYER_RECEIPT' ? this.text(payment,'partyId','buyingPartyId') === this.text(settlement,'buyingPartyId') : this.text(payment,'partyId','sellingPartyId') === this.text(settlement,'sellingPartyId'); }
  go(path: string): void { void this.router.navigate(['/finance',path]); }
  private newForm(): FormValue { return { paymentType:'BUYER_RECEIPT', partyId:null, amount:0, paymentDate:new Date().toISOString().slice(0,10), paymentMethod:'BANK_TRANSFER', reference:'', status:'PENDING', note:'' }; }
}
