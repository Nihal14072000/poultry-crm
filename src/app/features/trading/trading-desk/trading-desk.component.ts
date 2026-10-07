import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  DeliveryLineOutcome,
  TradingDeskData,
  TradingDeskService,
  TradingDraftLine,
  TradingRecord
} from '../../../common/services/trading-desk.service';
import { RolePermissionService } from '../../../common/services/role-permission.service';

type DeskView = 'quotes' | 'orders' | 'deliveries' | 'invoices';

@Component({
  selector: 'app-trading-desk',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './trading-desk.component.html',
  styleUrl: './trading-desk.component.css'
})
export class TradingDeskComponent implements OnInit {
  data?: TradingDeskData;
  activeView: DeskView = 'quotes';
  customerName = '';
  quoteNotes = '';
  draftLines: TradingDraftLine[] = [];
  selectedDispatch?: TradingRecord;
  selectedInvoice?: TradingRecord;
  deliveryInputs: Record<string, { delivered: number; mortality: number }> = {};
  proofOfDelivery = '';
  failureReason = '';
  receiptAmount = '';
  receiptMethod = 'Bank transfer';
  receiptReference = '';
  vehicle = '';
  driver = '';
  loading = true;
  busy = false;
  error = '';
  feedback = '';

  constructor(
    private readonly route: ActivatedRoute,
    readonly trading: TradingDeskService,
    readonly rolePermissions: RolePermissionService
  ) {}

  ngOnInit(): void {
    const path = String(this.route.snapshot.routeConfig?.path ?? '');
    if (path === 'quotations') this.activeView = 'quotes';
    else if (path === 'dispatch') this.activeView = 'deliveries';
    else if (path === 'sales' || path === 'orders' || path === 'order-desk') this.activeView = 'orders';
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading = true;
    try {
      this.data = await this.trading.load();
      if (!this.customerName) this.customerName = this.activeCustomers[0]?.['name'] as string ?? '';
      if (!this.draftLines.length) this.addLine();
      if (this.selectedDispatch) {
        this.selectedDispatch = this.data.dispatches.find((item) => item['_demoId'] === this.selectedDispatch?.['_demoId']);
      }
      if (this.selectedInvoice) {
        this.selectedInvoice = this.data.invoices.find((item) => item['_demoId'] === this.selectedInvoice?.['_demoId']);
      }
      this.error = '';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Trading data could not be loaded.';
    } finally {
      this.loading = false;
    }
  }

  get activeCustomers(): TradingRecord[] {
    return (this.data?.customers ?? []).filter((customer) => String(customer['status']).toLowerCase() === 'active');
  }

  get selectedCustomer(): TradingRecord | undefined {
    return this.activeCustomers.find((customer) => customer['name'] === this.customerName);
  }

  get sellableProducts(): TradingRecord[] {
    const stocked = this.data?.inventory ?? [];
    return stocked.map((stock) => {
      const catalog = this.data?.products.find((product) => product['sku'] === stock['sku']);
      return {
        sku: String(stock['sku'] ?? ''),
        product: String(catalog?.['product'] ?? stock['product'] ?? ''),
        unit: String(catalog?.['unit'] ?? this.unitFromStock(stock['onHand'])),
        salePrice: catalog?.['salePrice'] ?? 0
      };
    });
  }

  get activeBatches(): TradingRecord[] {
    return (this.data?.batches ?? []).filter((batch) =>
      ['active', 'ready for sale', 'partially sold'].includes(String(batch['status']).toLowerCase()) &&
      Number(batch['birds'] ?? 0) > 0
    );
  }

  get quoteLines(): TradingRecord[] {
    return this.data?.quotationLines ?? [];
  }

  get orderLines(): TradingRecord[] {
    return this.data?.orderLines ?? [];
  }

  get dispatchLines(): TradingRecord[] {
    return (this.data?.dispatchLines ?? []).filter((line) => line['dispatchId'] === this.selectedDispatch?.['_demoId']);
  }

  get invoicesDue(): TradingRecord[] {
    return (this.data?.invoices ?? []).filter((invoice) => Number(String(invoice['balance'] ?? '0').replace(/[₹,]/g, '')) > 0);
  }

  addLine(): void {
    const product = this.sellableProducts[0];
    this.draftLines = [...this.draftLines, {
      sku: String(product?.['sku'] ?? ''),
      product: String(product?.['product'] ?? ''),
      quantity: 1,
      pricingBasis: 'unit',
      unitPrice: this.priceNumber(product?.['salePrice']),
      averageWeight: 1.6,
      batch: '',
      unit: String(product?.['unit'] ?? 'unit')
    }];
  }

  removeLine(index: number): void {
    if (this.draftLines.length > 1) this.draftLines = this.draftLines.filter((_, row) => row !== index);
  }

  selectProduct(line: TradingDraftLine, sku: string): void {
    if (sku === 'LIVE-BIRD') {
      line.sku = sku;
      line.product = 'Live chicken';
      line.pricingBasis = 'bird';
      line.unitPrice = 100;
      line.batch = '';
      line.unit = 'bird';
      return;
    }
    const product = this.sellableProducts.find((item) => item['sku'] === sku);
    if (!product) return;
    line.sku = sku;
    line.product = String(product['product'] ?? '');
    line.pricingBasis = 'unit';
    line.unitPrice = this.priceNumber(product['salePrice']);
    line.batch = '';
    line.unit = String(product['unit'] ?? 'unit');
  }

  selectBatch(line: TradingDraftLine, batchCode: string): void {
    const batch = this.activeBatches.find((item) => item['batch'] === batchCode);
    line.batch = batchCode;
    line.sku = 'LIVE-BIRD';
    line.product = `Live chicken · ${batchCode}`;
    line.pricingBasis = 'bird';
    line.averageWeight = this.numberValue(batch?.['averageWeight']) || 1.6;
    line.unitPrice = 100;
    line.unit = 'bird';
  }

  lineTotal(line: TradingDraftLine): number {
    return this.trading.lineTotal(line);
  }

  get quoteTotal(): number {
    return this.draftLines.reduce((sum, line) => sum + this.lineTotal(line), 0);
  }

  createQuotation(): void {
    if (!this.rolePermissions.can('quotations', 'create') || this.busy) return;
    void this.mutate(async () => {
      const quote = await this.trading.createQuotation(this.customerName, this.draftLines, this.quoteNotes.trim());
      this.feedback = `${quote['quotation']} created for ${quote['customer']}.`;
      this.activeView = 'quotes';
      this.quoteNotes = '';
      this.draftLines = [];
    });
  }

  sendQuotation(quote: TradingRecord): void {
    void this.mutate(async () => {
      await this.trading.setQuotationStatus(quote, 'Sent');
      this.feedback = `${quote['quotation']} sent.`;
    });
  }

  acceptQuotation(quote: TradingRecord): void {
    void this.mutate(async () => {
      await this.trading.setQuotationStatus(quote, 'Accepted');
      this.feedback = `${quote['quotation']} accepted.`;
    });
  }

  declineQuotation(quote: TradingRecord): void {
    void this.mutate(async () => {
      await this.trading.setQuotationStatus(quote, 'Declined');
      this.feedback = `${quote['quotation']} declined.`;
    });
  }

  convertQuotation(quote: TradingRecord): void {
    if (!this.rolePermissions.can('orders', 'create')) return;
    void this.mutate(async () => {
      const order = await this.trading.convertQuotation(quote);
      this.feedback = `${quote['quotation']} converted to ${order['order']}.`;
      this.activeView = 'orders';
    });
  }

  confirmOrder(order: TradingRecord): void {
    if (!this.rolePermissions.can('orders', 'transition')) return;
    void this.mutate(async () => {
      await this.trading.confirmOrder(order);
      this.feedback = `${order['order']} confirmed and inventory reserved.`;
    });
  }

  createDispatch(order: TradingRecord): void {
    if (!this.rolePermissions.can('dispatch', 'create')) return;
    void this.mutate(async () => {
      const dispatch = await this.trading.createDispatch(order);
      this.selectDispatch(dispatch);
      this.activeView = 'deliveries';
      this.feedback = `${dispatch['delivery']} created for ${order['order']}.`;
    });
  }

  selectDispatch(dispatch: TradingRecord): void {
    this.selectedDispatch = dispatch;
    this.deliveryInputs = Object.fromEntries((this.data?.dispatchLines ?? [])
      .filter((line) => line['dispatchId'] === dispatch['_demoId'])
      .map((line) => [String(line['_demoId']), { delivered: Number(line['quantity'] ?? 0), mortality: 0 }]));
    this.proofOfDelivery = String(dispatch['proofOfDelivery'] ?? '');
    this.failureReason = String(dispatch['failureReason'] ?? '');
    this.vehicle = String(dispatch['vehicle'] ?? '');
    this.driver = String(dispatch['driver'] ?? '');
  }

  markDispatched(dispatch: TradingRecord): void {
    if (!this.rolePermissions.can('dispatch', 'transition')) return;
    void this.mutate(async () => {
      await this.trading.updateDispatch(dispatch, {
        status: 'Dispatched',
        vehicle: this.vehicle.trim(),
        driver: this.driver.trim()
      });
      this.feedback = `${dispatch['delivery']} dispatched.`;
    });
  }

  markInTransit(dispatch: TradingRecord): void {
    if (!this.rolePermissions.can('dispatch', 'transition')) return;
    void this.mutate(async () => {
      await this.trading.updateDispatch(dispatch, { status: 'In transit' });
      this.feedback = `${dispatch['delivery']} marked in transit.`;
    });
  }

  completeDelivery(dispatch: TradingRecord): void {
    if (!this.rolePermissions.can('dispatch', 'transition')) return;
    void this.mutate(async () => {
      const outcomes: DeliveryLineOutcome[] = this.dispatchLines.map((line) => ({
        lineId: String(line['_demoId'] ?? ''),
        deliveredQuantity: Number(this.deliveryInputs[String(line['_demoId'])]?.delivered ?? 0),
        transportMortality: Number(this.deliveryInputs[String(line['_demoId'])]?.mortality ?? 0)
      }));
      await this.trading.completeDelivery(dispatch, outcomes, this.proofOfDelivery, this.failureReason);
      this.feedback = `${dispatch['delivery']} delivery outcome recorded. Delivered quantities were invoiced and balances updated.`;
      this.selectedDispatch = undefined;
    });
  }

  openInvoice(invoice: TradingRecord): void {
    this.selectedInvoice = invoice;
    this.receiptAmount = '';
    this.receiptReference = '';
  }

  recordReceipt(invoice: TradingRecord): void {
    if (!this.rolePermissions.can('payments', 'create')) return;
    void this.mutate(async () => {
      await this.trading.recordReceipt(invoice, Number(this.receiptAmount), this.receiptMethod, this.receiptReference);
      this.feedback = `Receipt posted against ${invoice['invoice']}.`;
      this.selectedInvoice = undefined;
    });
  }

  amount(value: unknown): string {
    const numeric = this.numberValue(value);
    return `₹${numeric.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  numberValue(value: unknown): number {
    return this.priceNumber(value);
  }

  quoteLineCount(quote: TradingRecord): number {
    return this.quoteLines.filter((line) => line['quotationId'] === quote['_demoId']).length;
  }

  orderLineCount(order: TradingRecord): number {
    return this.orderLines.filter((line) => line['orderId'] === order['_demoId']).length;
  }

  isLive(line: TradingRecord): boolean {
    return !!line['batch'];
  }

  canCreateDispatch(order: TradingRecord): boolean {
    return ['Confirmed', 'Ready to dispatch', 'Partially delivered', 'Delivery failed'].includes(String(order['status'])) &&
      this.rolePermissions.can('dispatch', 'create');
  }

  hasInvoiceBalance(invoice: TradingRecord): boolean {
    return this.priceNumber(invoice['balance']) > 0;
  }

  recordKey(record: TradingRecord): string {
    return String(record['_demoId'] ?? '');
  }

  deliveryValue(line: TradingRecord, field: 'delivered' | 'mortality'): number {
    return this.deliveryInputs[this.recordKey(line)]?.[field] ?? 0;
  }

  setDeliveryValue(line: TradingRecord, field: 'delivered' | 'mortality', value: number): void {
    const key = this.recordKey(line);
    this.deliveryInputs[key] = { ...(this.deliveryInputs[key] ?? { delivered: 0, mortality: 0 }), [field]: Number(value) };
  }

  unitLabel(line: TradingDraftLine): string {
    return line.unit || 'unit';
  }

  canView(view: DeskView): boolean {
    if (view === 'quotes') return this.rolePermissions.canAccessRoute('quotations');
    if (view === 'orders') return this.rolePermissions.canAccessRoute('orders') || this.rolePermissions.canAccessRoute('sales');
    if (view === 'deliveries') return this.rolePermissions.canAccessRoute('dispatch');
    return this.rolePermissions.canAccessRoute('receivables') || this.rolePermissions.canAccessRoute('payments');
  }

  canCreateDraft(): boolean {
    return this.rolePermissions.can('quotations', 'create');
  }

  canConvert(quote: TradingRecord): boolean {
    return quote['status'] === 'Accepted' && !quote['orderId'] && this.rolePermissions.can('orders', 'create');
  }

  private async mutate(operation: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    this.feedback = '';
    try {
      await operation();
      await this.refresh();
    } catch (error) {
      this.error = error instanceof Error
        ? `${error.message} If data changed before the error, refresh the list and verify the related records before retrying.`
        : 'The trading action failed. Refresh and verify related records before retrying.';
      await this.refresh();
    } finally {
      this.busy = false;
    }
  }

  private priceNumber(value: unknown): number {
    const result = Number(String(value ?? '').replace(/[₹,\s]/g, '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(result) ? result : 0;
  }

  private unitFromStock(value: unknown): string {
    return String(value ?? '').replace(/^[\d,\s.]+/, '').trim().replace(/s$/, '') || 'unit';
  }
}
