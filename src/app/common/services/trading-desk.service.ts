import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DirectoryService } from './directory.service';
import { FarmOperationsService } from './farm-operations.service';

export type TradingRecord = Record<string, string | number>;

export interface TradingDeskData {
  customers: TradingRecord[];
  products: TradingRecord[];
  inventory: TradingRecord[];
  batches: TradingRecord[];
  quotations: TradingRecord[];
  quotationLines: TradingRecord[];
  orders: TradingRecord[];
  orderLines: TradingRecord[];
  dispatches: TradingRecord[];
  dispatchLines: TradingRecord[];
  invoices: TradingRecord[];
  receipts: TradingRecord[];
}

export interface TradingDraftLine {
  sku: string;
  product: string;
  quantity: number;
  pricingBasis: 'unit' | 'kg' | 'bird' | 'tray' | 'carton' | 'custom';
  unitPrice: number;
  averageWeight: number;
  batch: string;
  unit: string;
}

export interface DeliveryLineOutcome {
  lineId: string;
  deliveredQuantity: number;
  transportMortality: number;
}

function numberValue(value: unknown): number {
  const parsed = Number(String(value ?? '').replace(/[₹,\s]/g, '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number): string {
  return `₹${value.toFixed(2)}`;
}

function dateString(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

@Injectable({ providedIn: 'root' })
export class TradingDeskService {
  constructor(
    private readonly directories: DirectoryService,
    private readonly farmOperations: FarmOperationsService
  ) {}

  async load(): Promise<TradingDeskData> {
    const [customers, products, inventory, batches, quotations, quotationLines, orders, orderLines, dispatches, dispatchLines, invoices, receipts] =
      await Promise.all([
        this.records('customers'), this.records('products'), this.records('inventory'), this.records('batches'),
        this.records('quotations'), this.records('quotation-lines'), this.records('orders'), this.records('order-lines'),
        this.records('dispatch'), this.records('dispatch-lines'), this.records('invoices'), this.records('receipts')
      ]);
    return { customers, products, inventory, batches, quotations, quotationLines, orders, orderLines, dispatches, dispatchLines, invoices, receipts };
  }

  lineTotal(line: TradingDraftLine): number {
    const billableQuantity = line.pricingBasis === 'kg' && line.batch
      ? line.quantity * line.averageWeight
      : line.quantity;
    return billableQuantity * line.unitPrice;
  }

  async createQuotation(customerName: string, lines: TradingDraftLine[], notes: string): Promise<TradingRecord> {
    this.validateLines(lines);
    const customer = await this.activeCustomer(customerName);
    const quotation = await this.create('quotations', {
      quotation: this.nextCode('QT'),
      customer: String(customer['name']),
      date: dateString(),
      validUntil: dateString(new Date(Date.now() + 7 * 86400000)),
      total: money(lines.reduce((total, line) => total + this.lineTotal(line), 0)),
      owner: 'Current user',
      notes,
      status: 'Draft'
    });
    for (const line of lines) {
      await this.create('quotation-lines', this.lineRecord(quotation, line));
    }
    return quotation;
  }

  async setQuotationStatus(quotation: TradingRecord, status: 'Sent' | 'Accepted' | 'Declined'): Promise<void> {
    const allowed: Record<string, string[]> = { Draft: ['Sent'], Sent: ['Accepted', 'Declined'] };
    if (!allowed[String(quotation['status'])]?.includes(status)) throw new Error('That quotation transition is not allowed.');
    await this.update('quotations', quotation, { ...quotation, status });
  }

  async convertQuotation(quotation: TradingRecord): Promise<TradingRecord> {
    if (quotation['status'] !== 'Accepted') throw new Error('Only an accepted quotation can become an order.');
    if (this.dataId(quotation['orderId'])) throw new Error('This quotation has already been converted.');
    const data = await this.load();
    const quoteLines = data.quotationLines.filter((line) => line['quotationId'] === quotation['_demoId']);
    if (!quoteLines.length) throw new Error('The quotation has no saved line items.');
    const customer = await this.activeCustomer(String(quotation['customer'] ?? ''));
    const order = await this.create('orders', {
      order: this.nextCode('SO'),
      customer: String(customer['name']),
      date: dateString(),
      items: quoteLines.length,
      total: quotation['total'] ?? money(0),
      payment: 'Credit',
      paymentTerms: String(customer['paymentTerms'] ?? 'Credit'),
      quotationId: String(quotation['_demoId'] ?? ''),
      status: 'Draft'
    });
    for (const quoteLine of quoteLines) {
      const orderLine: TradingRecord = { ...quoteLine, quotationId: '', orderId: String(order['_demoId'] ?? ''), deliveredQuantity: 0, reservedQuantity: 0 };
      delete orderLine['_demoId'];
      await this.create('order-lines', orderLine);
    }
    await this.update('quotations', quotation, { ...quotation, orderId: String(order['_demoId'] ?? '') });
    return order;
  }

  async confirmOrder(order: TradingRecord): Promise<void> {
    if (order['status'] !== 'Draft') throw new Error('Only a draft order can be confirmed.');
    const data = await this.load();
    const lines = data.orderLines.filter((line) => line['orderId'] === order['_demoId']);
    if (!lines.length) throw new Error('This order has no line items.');
    const customer = await this.activeCustomer(String(order['customer'] ?? ''));
    if (String(order['payment'] ?? '').toLowerCase() === 'credit') {
      const balance = numberValue(customer['outstanding']);
      const limit = numberValue(customer['creditLimit']);
      const orderTotal = numberValue(order['total']);
      if (limit <= 0 || balance + orderTotal > limit) {
        throw new Error(`Credit limit exceeded. Outstanding ${money(balance)} plus this order ${money(orderTotal)} is over the ${money(limit)} limit.`);
      }
    }
    const stockPlans = this.planReservations(lines, data);
    for (const plan of stockPlans) await this.reserve(plan.line, plan.quantity, data);
    await this.update('orders', order, { ...order, status: 'Confirmed' });
  }

  async createDispatch(order: TradingRecord): Promise<TradingRecord> {
    if (!['Confirmed', 'Ready to dispatch', 'Partially delivered', 'Delivery failed'].includes(String(order['status']))) {
      throw new Error('Only confirmed orders with outstanding quantities can be dispatched.');
    }
    const data = await this.load();
    const activeDispatch = data.dispatches.some((dispatch) =>
      dispatch['orderId'] === order['_demoId'] && ['Created', 'Dispatched', 'In transit'].includes(String(dispatch['status']))
    );
    if (activeDispatch) throw new Error('This order already has a delivery in progress.');
    const orderLines = data.orderLines.filter((line) => line['orderId'] === order['_demoId']);
    const remaining = orderLines.map((line) => ({
      line,
      quantity: Math.max(0, numberValue(line['quantity']) - numberValue(line['deliveredQuantity']))
    })).filter((item) => item.quantity > 0);
    if (!remaining.length) throw new Error('There are no outstanding order quantities to dispatch.');
    const linesNeedingReservation = remaining.filter((item) => numberValue(item.line['reservedQuantity']) < item.quantity);
    const plans = this.planReservations(linesNeedingReservation.map((item) => item.line), data, true);
    for (const plan of plans) {
      const item = remaining.find((entry) => entry.line['_demoId'] === plan.line['_demoId']);
      if (item) await this.reserve(plan.line, plan.quantity, data);
    }
    const dispatch = await this.create('dispatch', {
      delivery: this.nextCode('DO'),
      order: String(order['order']),
      orderId: String(order['_demoId'] ?? ''),
      customer: String(order['customer'] ?? ''),
      vehicle: '',
      driver: '',
      scheduled: dateString(),
      proofOfDelivery: '',
      status: 'Created'
    });
    for (const item of remaining) {
      await this.create('dispatch-lines', {
        dispatchId: String(dispatch['_demoId'] ?? ''),
        orderId: String(order['_demoId'] ?? ''),
        orderLineId: String(item.line['_demoId'] ?? ''),
        sku: String(item.line['sku'] ?? ''),
        product: String(item.line['product'] ?? ''),
        batch: String(item.line['batch'] ?? ''),
        quantity: item.quantity,
        deliveredQuantity: 0,
        transportMortality: 0,
        pricingBasis: String(item.line['pricingBasis'] ?? 'unit'),
        unitPrice: numberValue(item.line['unitPrice']),
        averageWeight: numberValue(item.line['averageWeight'])
      });
    }
    await this.update('orders', order, { ...order, status: 'Ready to dispatch' });
    return dispatch;
  }

  async updateDispatch(dispatch: TradingRecord, changes: TradingRecord): Promise<void> {
    const allowed: Record<string, string[]> = { Created: ['Dispatched'], Dispatched: ['In transit'] };
    const nextStatus = String(changes['status'] ?? '');
    if (!allowed[String(dispatch['status'])]?.includes(nextStatus)) throw new Error('That dispatch transition is not allowed.');
    await this.update('dispatch', dispatch, { ...dispatch, ...changes });
  }

  async completeDelivery(
    dispatch: TradingRecord,
    outcomes: DeliveryLineOutcome[],
    proofOfDelivery: string,
    failureReason: string
  ): Promise<void> {
    if (dispatch['status'] !== 'In transit') throw new Error('Only an in-transit dispatch can be completed.');
    const data = await this.load();
    const lines = data.dispatchLines.filter((line) => line['dispatchId'] === dispatch['_demoId']);
    if (!lines.length || outcomes.length !== lines.length) throw new Error('Delivery quantities are incomplete.');
    for (const line of lines) {
      const outcome = outcomes.find((item) => item.lineId === String(line['_demoId']));
      if (!outcome || !Number.isInteger(outcome.deliveredQuantity) || !Number.isInteger(outcome.transportMortality) ||
        outcome.deliveredQuantity < 0 || outcome.transportMortality < 0 ||
        outcome.deliveredQuantity + outcome.transportMortality > numberValue(line['quantity'])) {
        throw new Error(`Enter valid whole-number delivery quantities for ${line['product']}.`);
      }
    }
    const deliveredTotal = outcomes.reduce((sum, item) => sum + item.deliveredQuantity, 0);
    const shippedTotal = lines.reduce((sum, line) => sum + numberValue(line['quantity']), 0);
    if (deliveredTotal === 0 && !failureReason.trim()) throw new Error('Add a reason when no quantity is delivered.');
    if (deliveredTotal > 0 && !proofOfDelivery.trim()) throw new Error('Enter a proof-of-delivery reference for delivered goods.');
    for (const line of lines) {
      const outcome = outcomes.find((item) => item.lineId === String(line['_demoId']))!;
      await this.applyDeliveredLine(line, outcome, dispatch, data);
      await this.update('dispatch-lines', line, {
        ...line,
        deliveredQuantity: outcome.deliveredQuantity,
        transportMortality: outcome.transportMortality
      });
    }
    const status = deliveredTotal === 0 ? 'Failed' : deliveredTotal < shippedTotal ? 'Partially delivered' : 'Delivered';
    const updatedDispatch = {
      ...dispatch,
      status,
      proofOfDelivery: proofOfDelivery.trim(),
      failureReason: failureReason.trim(),
      actualDelivered: deliveredTotal,
      deliveredAt: dateString()
    };
    await this.update('dispatch', dispatch, updatedDispatch);
    await this.createInvoice(dispatch, lines, outcomes, data);
    const order = data.orders.find((item) => item['_demoId'] === dispatch['orderId']);
    if (order) {
      const orderLines = (await this.records('order-lines')).filter((line) => line['orderId'] === order['_demoId']);
      const allComplete = orderLines.every((line) => numberValue(line['deliveredQuantity']) >= numberValue(line['quantity']));
      const nextOrderStatus = deliveredTotal === 0 ? 'Delivery failed' : allComplete ? 'Delivered' : 'Partially delivered';
      await this.update('orders', order, { ...order, status: nextOrderStatus });
    }
  }

  async recordReceipt(invoice: TradingRecord, amount: number, method: string, reference: string): Promise<void> {
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter a receipt amount greater than zero.');
    const balance = numberValue(invoice['balance']);
    if (amount > balance) throw new Error(`Receipt cannot exceed the outstanding invoice balance of ${money(balance)}.`);
    const data = await this.load();
    const customer = data.customers.find((record) => record['name'] === invoice['customer']);
    if (!customer) throw new Error('The invoice customer could not be found.');
    const nextBalance = Math.max(0, balance - amount);
    const invoiceStatus = nextBalance === 0 ? 'Paid' : 'Partially paid';
    await this.create('receipts', {
      reference: reference.trim() || this.nextCode('RCPT'),
      invoiceId: String(invoice['_demoId'] ?? ''),
      invoice: String(invoice['invoice'] ?? ''),
      customer: String(invoice['customer'] ?? ''),
      date: dateString(),
      method,
      amount: money(amount),
      status: 'Posted'
    });
    await this.create('payments', {
      reference: this.nextCode('RCPT'),
      party: String(invoice['customer'] ?? ''),
      invoice: String(invoice['invoice'] ?? ''),
      type: 'Receipt',
      date: dateString(),
      method,
      amount: money(amount),
      status: 'Posted'
    });
    await this.update('invoices', invoice, { ...invoice, balance: money(nextBalance), status: invoiceStatus });
    const receivables = await this.records('receivables');
    const receivable = receivables.find((item) => item['invoice'] === invoice['invoice']);
    if (receivable) await this.update('receivables', receivable, { ...receivable, balance: money(nextBalance), status: invoiceStatus });
    await this.update('customers', customer, {
      ...customer,
      outstanding: money(Math.max(0, numberValue(customer['outstanding']) - amount))
    });
  }

  async invoiceForDispatch(dispatchId: string): Promise<TradingRecord | undefined> {
    return (await this.records('invoices')).find((invoice) => invoice['dispatchId'] === dispatchId);
  }

  private async createInvoice(
    dispatch: TradingRecord,
    dispatchLines: TradingRecord[],
    outcomes: DeliveryLineOutcome[],
    data: TradingDeskData
  ): Promise<void> {
    const billable = dispatchLines.map((line) => {
      const outcome = outcomes.find((item) => item.lineId === line['_demoId']);
      const quantity = outcome?.deliveredQuantity ?? 0;
      const billed = line['pricingBasis'] === 'kg' && line['batch']
        ? quantity * numberValue(line['averageWeight'])
        : quantity;
      return billed * numberValue(line['unitPrice']);
    }).reduce((sum, item) => sum + item, 0);
    if (billable <= 0) return;
    const order = data.orders.find((record) => record['_demoId'] === dispatch['orderId']);
    const customer = data.customers.find((record) => record['name'] === order?.['customer']);
    if (!order || !customer) throw new Error('Could not locate the customer order for invoicing.');
    const invoiceNumber = this.nextCode('INV');
    const invoice = await this.create('invoices', {
      invoice: invoiceNumber,
      dispatchId: String(dispatch['_demoId'] ?? ''),
      orderId: String(order['_demoId'] ?? ''),
      customer: String(customer['name']),
      issued: dateString(),
      due: dateString(new Date(Date.now() + 30 * 86400000)),
      amount: money(billable),
      balance: money(billable),
      status: 'Outstanding'
    });
    await this.create('receivables', {
      invoice: invoiceNumber,
      invoiceId: String(invoice['_demoId'] ?? ''),
      customer: String(customer['name']),
      issued: dateString(),
      due: dateString(new Date(Date.now() + 30 * 86400000)),
      amount: money(billable),
      balance: money(billable),
      status: 'Outstanding'
    });
    await this.update('customers', customer, {
      ...customer,
      outstanding: money(numberValue(customer['outstanding']) + billable)
    });
  }

  private async applyDeliveredLine(
    line: TradingRecord,
    outcome: DeliveryLineOutcome,
    dispatch: TradingRecord,
    data: TradingDeskData
  ): Promise<void> {
    const orderLine = data.orderLines.find((record) => record['_demoId'] === line['orderLineId']);
    if (!orderLine) throw new Error(`Order line for ${line['product']} was not found.`);
    const shipped = numberValue(line['quantity']);
    const delivered = outcome.deliveredQuantity;
    const mortality = outcome.transportMortality;
    const liveBatch = line['batch'] ? data.batches.find((batch) => batch['batch'] === line['batch']) : undefined;
    if (liveBatch) {
      const reserved = numberValue(liveBatch['reservedBirds']);
      if (delivered + mortality > numberValue(liveBatch['birds'])) throw new Error(`Delivered birds exceed the live count in ${line['batch']}.`);
      const updatedBatch = {
        ...liveBatch,
        birds: numberValue(liveBatch['birds']) - delivered - mortality,
        reservedBirds: Math.max(0, reserved - shipped)
      };
      await this.update('batches', liveBatch, updatedBatch);
      const liveData = await firstValueFrom(this.farmOperations.loadData());
      await this.farmOperations.applyBatchOccupancyChange(liveBatch, updatedBatch, liveData);
      if (delivered > 0) await this.create('batch-transactions', {
        transaction: this.nextCode('BM'),
        batch: String(liveBatch['batch']),
        farm: String(liveBatch['farm'] ?? ''),
        shed: String(liveBatch['shed'] ?? ''),
        type: 'Sale / lifting',
        quantity: delivered,
        date: dateString(),
        reference: String(dispatch['delivery'] ?? ''),
        notes: 'Delivered to customer'
      });
      if (mortality > 0) await this.create('batch-transactions', {
        transaction: this.nextCode('BM'),
        batch: String(liveBatch['batch']),
        farm: String(liveBatch['farm'] ?? ''),
        shed: String(liveBatch['shed'] ?? ''),
        type: 'Transport mortality',
        quantity: mortality,
        date: dateString(),
        reference: String(dispatch['delivery'] ?? ''),
        notes: 'Mortality during customer delivery'
      });
    } else {
      const stock = data.inventory.find((record) => record['sku'] === line['sku']);
      if (!stock) throw new Error(`Inventory item ${line['sku']} could not be found.`);
      const onHand = numberValue(stock['onHand']);
      const reserved = numberValue(stock['reservedQty']);
      if (delivered > onHand) throw new Error(`Delivered quantity exceeds on-hand stock for ${line['product']}.`);
      const updatedStock = {
        ...stock,
        onHand: `${Math.max(0, onHand - delivered)} ${String(stock['onHand']).replace(/^[\d,\s.]+/, '').trim()}`,
        reservedQty: Math.max(0, reserved - shipped),
        availableQty: Math.max(0, onHand - delivered - Math.max(0, reserved - shipped)),
        status: onHand - delivered <= numberValue(stock['reorderAt']) ? 'Low stock' : 'Healthy'
      };
      await this.update('inventory', stock, updatedStock);
      if (delivered > 0) await this.create('stock-ledger', {
        reference: String(dispatch['delivery'] ?? ''),
        date: dateString(),
        product: String(line['product'] ?? ''),
        sku: String(line['sku'] ?? ''),
        warehouse: String(stock['warehouse'] ?? ''),
        movement: 'Customer delivery',
        quantity: `${-delivered} ${String(stock['onHand']).replace(/^[\d,\s.]+/, '').trim()}`,
        status: 'Posted'
      });
    }
    const remainingReserved = Math.max(0, numberValue(orderLine['reservedQuantity']) - shipped);
    await this.update('order-lines', orderLine, {
      ...orderLine,
      deliveredQuantity: numberValue(orderLine['deliveredQuantity']) + delivered,
      reservedQuantity: remainingReserved
    });
    await this.create('inventory-reservations', {
      order: String(dispatch['order'] ?? ''),
      delivery: String(dispatch['delivery'] ?? ''),
      sku: String(line['sku'] ?? ''),
      batch: String(line['batch'] ?? ''),
      product: String(line['product'] ?? ''),
      quantity: shipped,
      fulfilled: delivered,
      transportMortality: mortality,
      action: delivered || mortality ? 'Fulfilled and released remainder' : 'Released after failed delivery',
      date: dateString()
    });
  }

  private planReservations(
    lines: TradingRecord[],
    data: TradingDeskData,
    onlyMissing = false
  ): { line: TradingRecord; quantity: number }[] {
    const requiredBySku = new Map<string, number>();
    const requiredByBatch = new Map<string, number>();
    const plans = lines.map((line) => {
      const total = numberValue(line['quantity']);
      const quantity = onlyMissing ? Math.max(0, total - numberValue(line['reservedQuantity'])) : total;
      const batchName = String(line['batch'] ?? '');
      const sku = String(line['sku'] ?? '');
      if (batchName) requiredByBatch.set(batchName, (requiredByBatch.get(batchName) ?? 0) + quantity);
      else requiredBySku.set(sku, (requiredBySku.get(sku) ?? 0) + quantity);
      return { line, quantity };
    });
    for (const [sku, requested] of requiredBySku) {
      const stock = data.inventory.find((item) => item['sku'] === sku);
      if (!stock) throw new Error(`No inventory balance exists for SKU ${sku}.`);
      const available = numberValue(stock['onHand']) - numberValue(stock['reservedQty']);
      if (requested > available) throw new Error(`Insufficient ${stock['product']} stock. Available: ${available}. Requested: ${requested}.`);
    }
    for (const [batchCode, requested] of requiredByBatch) {
      const batch = data.batches.find((item) => item['batch'] === batchCode);
      if (!batch) throw new Error(`Live-bird batch ${batchCode} was not found.`);
      const available = numberValue(batch['birds']) - numberValue(batch['reservedBirds']);
      if (requested > available) throw new Error(`Insufficient live birds in ${batchCode}. Available: ${available}. Requested: ${requested}.`);
    }
    return plans;
  }

  private async reserve(line: TradingRecord, quantity: number, data: TradingDeskData): Promise<void> {
    if (quantity <= 0) return;
    const batchName = String(line['batch'] ?? '');
    if (batchName) {
      const batchId = data.batches.find((item) => item['batch'] === batchName)?.['_demoId'];
      const batch = (await this.records('batches')).find((item) => item['_demoId'] === batchId);
      if (!batch) throw new Error(`Live-bird batch ${batchName} was not found.`);
      const updated = { ...batch, reservedBirds: numberValue(batch['reservedBirds']) + quantity };
      await this.update('batches', batch, updated);
      const currentLine = (await this.records('order-lines')).find((item) => item['_demoId'] === line['_demoId']);
      if (currentLine) await this.update('order-lines', currentLine, {
        ...currentLine,
        reservedQuantity: numberValue(currentLine['reservedQuantity']) + quantity
      });
      await this.create('inventory-reservations', {
        order: String(line['orderId'] ?? ''),
        batch: batchName,
        product: String(line['product'] ?? ''),
        quantity,
        action: 'Reserved',
        date: dateString()
      });
      return;
    }
    const stockId = data.inventory.find((item) => item['sku'] === line['sku'])?.['_demoId'];
    const stock = (await this.records('inventory')).find((item) => item['_demoId'] === stockId);
    if (!stock) throw new Error(`Inventory item ${line['sku']} was not found.`);
    const reservedQty = numberValue(stock['reservedQty']) + quantity;
    await this.update('inventory', stock, {
      ...stock,
      reservedQty,
      availableQty: Math.max(0, numberValue(stock['onHand']) - reservedQty)
    });
    await this.create('inventory-reservations', {
      order: String(line['orderId'] ?? ''),
      sku: String(line['sku'] ?? ''),
      product: String(line['product'] ?? ''),
      quantity,
      action: 'Reserved',
      date: dateString()
    });
    const currentLine = data.orderLines.find((item) => item['_demoId'] === line['_demoId']);
    if (currentLine) await this.update('order-lines', currentLine, {
      ...currentLine,
      reservedQuantity: numberValue(currentLine['reservedQuantity']) + quantity
    });
  }

  private lineRecord(parent: TradingRecord, line: TradingDraftLine): TradingRecord {
    const record: TradingRecord = {
      quotationId: String(parent['_demoId'] ?? ''),
      sku: line.sku,
      product: line.product,
      quantity: line.quantity,
      pricingBasis: line.pricingBasis,
      unitPrice: line.unitPrice,
      averageWeight: line.averageWeight,
      batch: line.batch,
      unit: line.unit,
      totalWeight: line.batch ? line.quantity * line.averageWeight : 0,
      total: money(this.lineTotal(line))
    };
    return record;
  }

  private validateLines(lines: TradingDraftLine[]): void {
    if (!lines.length) throw new Error('Add at least one product to the quotation.');
    const lineKeys = lines.map((line) => `${line.sku}:${line.batch}`);
    if (new Set(lineKeys).size !== lineKeys.length) throw new Error('Use one line per product and live-bird batch.');
    for (const line of lines) {
      if (!line.product || !Number.isInteger(line.quantity) || line.quantity <= 0 ||
        !Number.isFinite(line.unitPrice) || line.unitPrice <= 0) {
        throw new Error('Each line needs a product, a positive whole-number quantity, and a positive rate.');
      }
      if (line.batch && (!Number.isFinite(line.averageWeight) || line.averageWeight <= 0)) {
        throw new Error('Live-bird lines priced per kilogram need a positive average weight.');
      }
      if (line.batch && !['bird', 'kg'].includes(line.pricingBasis)) {
        throw new Error('Live-bird lines must be priced per bird or per kilogram.');
      }
    }
  }

  private async activeCustomer(name: string): Promise<TradingRecord> {
    const customer = (await this.records('customers')).find((record) => record['name'] === name);
    if (!customer || String(customer['status'] ?? '').toLowerCase() !== 'active') {
      throw new Error('Choose an active customer.');
    }
    return customer;
  }

  private async records(resource: string): Promise<TradingRecord[]> {
    return (await firstValueFrom(this.directories.getDirectory(resource))).records;
  }

  private async create(resource: string, record: TradingRecord): Promise<TradingRecord> {
    return firstValueFrom(this.directories.createRecord(resource, record));
  }

  private async update(resource: string, record: TradingRecord, changes: TradingRecord): Promise<TradingRecord> {
    const id = String(record['_demoId'] ?? '');
    if (!id) throw new Error(`Cannot update a ${resource} record without a local demo id.`);
    return firstValueFrom(this.directories.updateRecord(resource, id, changes));
  }

  private nextCode(prefix: string): string {
    const stamp = Date.now().toString().slice(-8);
    return `${prefix}-${stamp}`;
  }

  private dataId(value: unknown): string {
    return String(value ?? '').trim();
  }
}
