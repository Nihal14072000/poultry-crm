import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FinanceApiService, FinanceRecord, PaymentInput, PaymentMethod, PaymentStatus, PaymentType } from '../../../common/services/finance-api.service';
import { TripRecord } from '../../../common/models/trip.model';
import { TripApiService } from '../../../common/services/trip-api.service';
import { RolePermissionService } from '../../../common/services/role-permission.service';

type View = 'overview' | 'receivables' | 'payables' | 'payments' | 'record' | 'allocate' | 'trip-summary';
type FormValue = Omit<PaymentInput, 'partyId'> & { partyId: number | null };

@Component({ selector: 'app-payment-center', standalone: true, imports: [CommonModule, FormsModule, RouterLink, CurrencyPipe], templateUrl: './payment-center.component.html', styleUrl: './payment-center.component.css' })
export class PaymentCenterComponent implements OnInit {
  view: View = 'overview'; loading = true; saving = false; error = ''; success = ''; query = ''; statusFilter = ''; tripId = ''; partyId = '';
  trips: TripRecord[] = []; parties: TripRecord[] = []; records: FinanceRecord[] = []; payments: FinanceRecord[] = []; settlements: FinanceRecord[] = []; summary?: FinanceRecord;
  selectedPaymentId = ''; allocations: Record<string, number> = {};
  readonly methods: PaymentMethod[] = ['BANK_TRANSFER', 'CASH', 'CHEQUE', 'UPI', 'CARD', 'OTHER'];
  readonly statuses: PaymentStatus[] = ['PENDING', 'COMPLETED', 'FAILED', 'VOID'];
  form: FormValue = this.newForm();
  constructor(private readonly route: ActivatedRoute, private readonly router: Router, private readonly api: FinanceApiService, private readonly tripsApi: TripApiService, readonly permissions: RolePermissionService) {}
  async ngOnInit(): Promise<void> { this.view = this.route.snapshot.routeConfig?.path as View || 'overview'; this.tripId = this.route.snapshot.queryParamMap.get('tripId') ?? ''; await this.load(); }
  async load(): Promise<void> {
    this.loading = true; this.error = '';
    try {
      if (!this.trips.length) { const [options, trips] = await Promise.all([this.tripsApi.getFormOptions(), this.tripsApi.getTrips()]); this.trips = trips; this.parties = this.form.paymentType === 'BUYER_RECEIPT' ? options.deliveryVendors : options.suppliers; }
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
      else if (this.view === 'overview') { const [receivables, payables, payments] = await Promise.all([this.api.receivables(this.tripId ? { tripId: this.tripId } : {}), this.api.payables(this.tripId ? { tripId: this.tripId } : {}), this.api.payments()]); this.records = [...receivables, ...payables]; this.payments = payments; }
    } catch (e) { this.error = e instanceof Error ? e.message : 'Finance data could not be loaded.'; } finally { this.loading = false; }
  }
  get filtered(): FinanceRecord[] { const q = this.query.trim().toLowerCase(); return (this.view === 'payments' ? this.payments : this.records).filter(row => (!q || Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q))) && (!this.statusFilter || this.text(row, 'status') === this.statusFilter)); }
  get completedPayments(): FinanceRecord[] { return this.payments.filter(p => this.text(p, 'status') === 'COMPLETED'); }
  get selectedPayment(): FinanceRecord | undefined { return this.completedPayments.find(p => this.id(p) === this.selectedPaymentId); }
  get paymentRemaining(): number { return this.money(this.selectedPayment, 'remainingAmount', 'unallocatedAmount', 'amount') - Object.values(this.allocations).reduce((a, b) => a + (Number(b) || 0), 0); }
  get metrics(): { label: string; value: number }[] { const receipts = this.payments.filter(p => this.text(p, 'paymentType', 'type') === 'BUYER_RECEIPT' && this.text(p, 'status') === 'COMPLETED').reduce((s,p)=>s+this.money(p,'amount'),0); const payouts = this.payments.filter(p => this.text(p, 'paymentType', 'type') === 'SELLER_PAYOUT' && this.text(p, 'status') === 'COMPLETED').reduce((s,p)=>s+this.money(p,'amount'),0); return [{label:'Buyer amounts due',value:this.records.filter(r=>this.isReceivable(r)).reduce((s,r)=>s+this.money(r,'amountDue','amount'),0)},{label:'Receipts collected',value:receipts},{label:'Seller amounts payable',value:this.records.filter(r=>!this.isReceivable(r)).reduce((s,r)=>s+this.money(r,'amountPayable','amount'),0)},{label:'Payouts made',value:payouts},{label:'Outstanding balance',value:this.records.reduce((s,r)=>s+this.money(r,'outstandingBalance','balance'),0)},{label:'Brokerage assessed',value:this.records.reduce((s,r)=>s+this.money(r,'brokerage','brokerageAmount'),0)}]; }
  setPaymentType(type: PaymentType): void { this.form.paymentType = type; this.form.partyId = null; this.parties = []; void this.loadPartyOptions(); }
  async loadPartyOptions(): Promise<void> { try { const options = await this.tripsApi.getFormOptions(); this.parties = this.form.paymentType === 'BUYER_RECEIPT' ? options.deliveryVendors : options.suppliers; } catch { this.error = 'Parties could not be loaded.'; } }
  async savePayment(): Promise<void> { if (!this.permissions.can('payments','create') || !this.validForm()) return; this.saving = true; this.error=''; try { await this.api.createPayment(this.form as PaymentInput); this.success='Payment recorded.'; this.form=this.newForm(); } catch(e) { this.error=e instanceof Error?e.message:'Payment could not be recorded.'; } finally { this.saving=false; } }
  async submitAllocations(): Promise<void> { if (!this.selectedPayment || !this.permissions.can('payments','update')) return; const rows = Object.entries(this.allocations).filter(([, amount]) => Number(amount)>0); if (!rows.length || this.paymentRemaining < 0) { this.error='Enter allocations within the remaining payment amount.'; return; } for (const [id, amount] of rows) { const settlement = this.settlements.find(s=>this.id(s)===id); if (!settlement || Number(amount)>this.money(settlement,'outstandingBalance','balance')) { this.error='An allocation exceeds its settlement balance.'; return; } } this.saving=true; this.error=''; try { for (const [settlementId, amount] of rows) await this.api.allocate({paymentId:Number(this.id(this.selectedPayment)),settlementId:Number(settlementId),amount:Number(amount)}); this.success='Allocation saved.'; this.allocations={}; await this.load(); } catch(e) { this.error=e instanceof Error?e.message:'Allocation could not be saved.'; } finally { this.saving=false; } }
  changeTrip(): void { void this.load(); }
  validForm(): boolean { const f=this.form; if (!f.partyId || !Number.isFinite(Number(f.amount)) || Number(f.amount)<=0 || !/^\d{4}-\d{2}-\d{2}$/.test(f.paymentDate)) { this.error='Party, positive amount, and payment date are required.'; return false; } return true; }
  id(row?: FinanceRecord): string { return String(row?.['id'] ?? row?.['paymentId'] ?? row?.['settlementId'] ?? ''); }
  text(row: FinanceRecord | undefined, ...keys: string[]): string { for (const key of keys) if (row?.[key] != null) return String(row[key]); return ''; }
  money(row: FinanceRecord | undefined, ...keys: string[]): number { for (const key of keys) { const value=row?.[key]; if (value != null && Number.isFinite(Number(value))) return Number(value); } return 0; }
  isReceivable(row: FinanceRecord): boolean { return this.text(row,'settlementType','type','paymentType').includes('BUYER') || !!row['buyingPartyId']; }
  allocationAllowed(settlement: FinanceRecord): boolean { const payment=this.selectedPayment; if (!payment) return false; return this.text(payment,'paymentType','type') === 'BUYER_RECEIPT' ? this.text(payment,'partyId','buyingPartyId') === this.text(settlement,'buyingPartyId') : this.text(payment,'partyId','sellingPartyId') === this.text(settlement,'sellingPartyId'); }
  go(path: string): void { void this.router.navigate(['/finance',path]); }
  private newForm(): FormValue { return { paymentType:'BUYER_RECEIPT', partyId:null, amount:0, paymentDate:new Date().toISOString().slice(0,10), paymentMethod:'BANK_TRANSFER', reference:'', status:'PENDING', note:'' }; }
}
