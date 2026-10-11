import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TripRecord, TripVendorPickup } from '../../../common/models/trip.model';
import { TripService } from '../../../common/services/trip.service';
import { SessionAuthService } from '../../../common/services/session-auth.service';

interface VendorPaymentForm {
  vendorDestinationId: string;
  vendorName: string;
  amountReceived: number | null;
  paymentMethod: string;
}

interface SupplierReceiptForm {
  vendorId: string; vendorName: string;
  broiler: number | null; broilerWeight: number | null;
  culls: number | null; cullsWeight: number | null;
  feed: number | null; feedWeight: number | null; reason: string;
}

@Component({
  selector: 'app-trip-deliveries', standalone: true, imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './trip-deliveries.component.html', styleUrl: './trip-deliveries.component.css'
})
export class TripDeliveriesComponent implements OnInit {
  trips: TripRecord[] = [];
  trip?: TripRecord;
  destinations: TripRecord[] = [];
  deliveries: TripRecord[] = [];
  supplierPickups: TripVendorPickup[] = [];
  supplierReceipts: TripRecord[] = [];
  payments: TripRecord[] = [];
  paymentForms: VendorPaymentForm[] = [];
  supplierReceiptForms: SupplierReceiptForm[] = [];
  activePickupVendorId = '';
  activePaymentVendorId = '';
  editingPaymentId = '';
  loadedBroiler = 0;
  loadedCulls = 0;
  mortality?: TripRecord;
  loading = true;
  saving = false;
  error = '';
  success = '';
  dateFilter = '';
  vehicleFilter = '';
  routeFilter = '';
  statusFilter = '';
  activeOrderId = '';
  editingDestinationId = '';
  destinationDraft = { vendorName: '', address: '', contact: '', phone: '' };
  broiler = 0;
  broilerWeight = 0;
  culls = 0;
  cullsWeight = 0;
  feed = 0;
  feedWeight = 0;
  deliveredAt = new Date().toISOString().slice(0, 16);
  remarks = '';
  reason = '';
  confirmed = false;
  failedDelivery = false;
  approveExcess = false;
  approveReconciliation = false;
  reconciliationReason = '';
  mortalityQuantity = 0;
  mortalityAt = new Date().toISOString().slice(0, 16);
  mortalityRemarks = '';

  constructor(private readonly service: TripService, private readonly route: ActivatedRoute, private readonly router: Router, readonly auth: SessionAuthService) {}

  async ngOnInit(): Promise<void> {
    const state = this.router.getCurrentNavigation()?.extras.state as { successMessage?: string } | undefined;
    this.success = state?.successMessage ?? '';
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading = true; this.error = '';
    try {
      const tripId = this.route.snapshot.paramMap.get('tripId');
      if (tripId) {
        const data = await this.service.getDeliveryData(tripId);
        this.trip = data.trip; this.destinations = data.destinations; this.deliveries = data.deliveries; this.mortality = data.mortality;
        this.supplierPickups = data.supplierPickups; this.supplierReceipts = data.supplierReceipts;
        this.payments = data.payments;
        this.supplierReceiptForms = data.supplierPickups.map((pickup) => {
          const receipt = data.supplierReceipts.find((record) => String(record['vendorId'] ?? '') === pickup.vendorId);
          return {
            vendorId: pickup.vendorId, vendorName: pickup.vendorName,
            broiler: receipt ? this.number(receipt['broilerQuantity']) : null,
            broilerWeight: receipt ? this.number(receipt['broilerWeight']) : null,
            culls: receipt ? this.number(receipt['cullsQuantity']) : null,
            cullsWeight: receipt ? this.number(receipt['cullsWeight']) : null,
            feed: receipt ? this.number(receipt['feedQuantity']) : null,
            feedWeight: receipt ? this.number(receipt['feedWeight']) : null,
            reason: String(receipt?.['reason'] ?? '')
          };
        });
        this.paymentForms = this.destinations.map((destination) => {
          return {
            vendorDestinationId: this.id(destination),
            vendorName: String(destination['vendorName'] ?? ''),
            amountReceived: null,
            paymentMethod: ''
          };
        });
        this.loadedBroiler = data.loadedBroiler; this.loadedCulls = data.loadedCulls;
        if (this.mortality) { this.mortalityQuantity = Number(this.mortality['quantity'] ?? 0); this.mortalityAt = String(this.mortality['recordedAt'] ?? this.mortalityAt); this.mortalityRemarks = String(this.mortality['remarks'] ?? ''); }
      } else this.trips = await this.service.getAssignedTrips();
    } catch (e) { this.error = e instanceof Error ? e.message : 'Trip delivery data could not be loaded.'; }
    finally { this.loading = false; }
  }

  get filteredTrips(): TripRecord[] {
    return this.trips.filter((trip) => (!this.dateFilter || trip['tripDate'] === this.dateFilter) &&
      (!this.vehicleFilter || String(trip['vehicleName'] ?? '').toLowerCase().includes(this.vehicleFilter.toLowerCase())) &&
      (!this.routeFilter || String(trip['route'] ?? '').toLowerCase().includes(this.routeFilter.toLowerCase())) &&
      (!this.statusFilter || String(trip['status'] ?? '') === this.statusFilter));
  }
  id(record: TripRecord): string { return String(record['_demoId'] ?? ''); }
  number(value: unknown): number { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
  get currentDestination(): TripRecord | undefined { return this.destinations.find((destination) => this.id(destination) === this.activeOrderId); }
  get canEnterDelivery(): boolean { return ['In transit', 'Delivery in progress'].includes(String(this.trip?.['status'] ?? '')); }
  get canStartTrip(): boolean { return String(this.trip?.['status'] ?? '') === 'Assigned'; }
  get canApproveExcess(): boolean { return this.auth.currentUser?.role === 'Organization Admin'; }
  get canApproveReconciliation(): boolean { return this.auth.currentUser?.role === 'Organization Admin'; }
  canEditDestinationDetails(destination: TripRecord): boolean {
    const role = (this.auth.currentUser?.role ?? '').toLowerCase();
    const entries = this.entries(this.id(destination));
    return ['farm supervisor', 'supervisor'].includes(role) &&
      this.auth.currentUser?.email.toLowerCase() === String(this.trip?.['supervisorEmail'] ?? '').toLowerCase() &&
      this.number(destination['orderedBroiler']) + this.number(destination['orderedCulls']) ===
        this.delivered(this.id(destination), 'broiler') + this.delivered(this.id(destination), 'culls') &&
      entries.length > 0 && entries[entries.length - 1]['failedDelivery'] !== 'true';
  }
  editableDestinations(): TripRecord[] { return this.destinations.filter((destination) => this.canEditDestinationDetails(destination)); }
  editDestination(destination: TripRecord): void {
    if (!this.canEditDestinationDetails(destination)) return;
    this.editingDestinationId = this.id(destination);
    this.destinationDraft = {
      vendorName: String(destination['vendorName'] ?? ''), address: String(destination['address'] ?? ''),
      contact: String(destination['contact'] ?? ''), phone: String(destination['phone'] ?? '')
    };
  }
  cancelDestinationEdit(): void { this.editingDestinationId = ''; }
  async saveDestinationEdit(): Promise<void> {
    if (!this.trip || !this.editingDestinationId || this.saving) return;
    this.saving = true; this.error = ''; this.success = '';
    try {
      await this.service.updateDeliveredDestination(this.id(this.trip), this.editingDestinationId, this.destinationDraft);
      this.success = 'Vendor destination details updated for this trip.';
      this.editingDestinationId = '';
      await this.load();
    } catch (e) { this.error = e instanceof Error ? e.message : 'Vendor destination details could not be updated.'; }
    finally { this.saving = false; }
  }
  canReceivePayment(form: VendorPaymentForm): boolean {
    const destination = this.destinations.find((item) => this.id(item) === form.vendorDestinationId);
    return !!destination && this.destinationStatus(destination) === 'Delivered';
  }
  paymentsFor(form: VendorPaymentForm): TripRecord[] {
    return this.payments.filter((payment) => String(payment['vendorDestinationId']) === form.vendorDestinationId);
  }
  paymentTotal(form: VendorPaymentForm): number {
    return this.paymentsFor(form).reduce((sum, payment) => sum + this.number(payment['amountReceived']), 0);
  }
  entrySales(): number {
    return this.number(this.broilerWeight) * this.number(this.currentDestination?.['broilerRate']) +
      this.number(this.cullsWeight) * this.number(this.currentDestination?.['cullsRate']) +
      this.number(this.feedWeight) * this.number(this.currentDestination?.['feedRate']);
  }
  togglePaymentForm(form: VendorPaymentForm): void {
    if (this.activePaymentVendorId === form.vendorDestinationId) {
      this.activePaymentVendorId = '';
      this.editingPaymentId = '';
      form.amountReceived = null;
      form.paymentMethod = '';
      return;
    }
    this.activePaymentVendorId = form.vendorDestinationId;
    this.editingPaymentId = '';
    form.amountReceived = null;
    form.paymentMethod = '';
  }
  editPayment(form: VendorPaymentForm, payment: TripRecord): void {
    this.activePaymentVendorId = form.vendorDestinationId;
    this.editingPaymentId = this.id(payment);
    form.amountReceived = this.number(payment['amountReceived']);
    form.paymentMethod = String(payment['paymentMethod'] ?? '');
  }
  get reconciliationHasExceptions(): boolean {
    return this.unreconciled() !== 0 || this.destinations.some((destination) => {
      const destinationEntries = this.entries(this.id(destination));
      return !destinationEntries.length || destinationEntries[destinationEntries.length - 1]['failedDelivery'] === 'true';
    });
  }
  get needsExcessApproval(): boolean {
    const destination = this.currentDestination;
    const plannedBirds = destination
      ? this.number(destination['orderedBroiler']) + this.number(destination['orderedCulls'])
      : 0;
    const projectedBirds = this.delivered(this.activeOrderId, 'broiler') + this.delivered(this.activeOrderId, 'culls') +
      this.number(this.broiler) + this.number(this.culls);
    return !!destination && projectedBirds > plannedBirds;
  }
  entries(destinationId: string): TripRecord[] { return this.deliveries.filter((item) => String(item['vendorDestinationId']) === destinationId); }
  delivered(destinationId: string, kind: 'broiler' | 'culls' | 'feed'): number { return this.entries(destinationId).reduce((sum, item) => sum + Number(item[kind] ?? 0), 0); }
  deliveredWeight(destinationId: string, kind: 'broiler' | 'culls' | 'feed'): number { return this.entries(destinationId).reduce((sum, item) => sum + Number(item[`${kind}Weight`] ?? 0), 0); }
  deliveryRevenue(destinationId: string): number { return this.entries(destinationId).reduce((sum, item) => sum + Number(item['deliveryTotal'] ?? 0), 0); }
  remaining(destination: TripRecord): string {
    const plannedBirds = this.number(destination['orderedBroiler']) + this.number(destination['orderedCulls']);
    const amount = plannedBirds - this.delivered(this.id(destination), 'broiler') - this.delivered(this.id(destination), 'culls');
    return amount < 0 ? `${Math.abs(amount)} excess` : `${amount} remaining`;
  }
  deliveredBroilerTotal(): number { return this.deliveries.reduce((sum, item) => sum + this.number(item['broiler']), 0); }
  deliveredCullsTotal(): number { return this.deliveries.reduce((sum, item) => sum + this.number(item['culls']), 0); }
  totalDelivered(): number { return this.deliveredBroilerTotal() + this.deliveredCullsTotal(); }
  totalLoaded(): number { return this.loadedBroiler + this.loadedCulls; }
  totalLoadedWeight(): number { return this.supplierReceipts.reduce((sum, receipt) => sum + this.number(receipt['broilerWeight']) + this.number(receipt['cullsWeight']), 0); }
  allSupplierReceiptsSaved(): boolean { return this.supplierReceiptForms.length > 0 && this.supplierReceiptForms.every((form) => !!this.supplierReceipt(form.vendorId)); }
  proposedLoadedBroiler(): number { return this.supplierPickups.reduce((sum, pickup) => sum + pickup.broiler.quantity, 0); }
  proposedLoadedCulls(): number { return this.supplierPickups.reduce((sum, pickup) => sum + pickup.culls.quantity, 0); }
  proposedLoadedWeight(): number { return this.supplierPickups.reduce((sum, pickup) => sum + Number(pickup.broiler.weight ?? 0) + Number(pickup.culls.weight ?? 0), 0); }
  proposedFeedQuantity(): number { return this.supplierPickups.reduce((sum, pickup) => sum + pickup.feed.quantity, 0); }
  actualFeedQuantity(): number { return this.supplierReceipts.reduce((sum, receipt) => sum + this.number(receipt['feedQuantity']), 0); }
  plannedSupplier(vendorId: string): TripVendorPickup | undefined { return this.supplierPickups.find((pickup) => pickup.vendorId === vendorId); }
  supplierReceipt(vendorId: string): TripRecord | undefined { return this.supplierReceipts.find((receipt) => String(receipt['vendorId'] ?? '') === vendorId); }
  supplierActualSummary(vendorId: string, kind: 'broiler' | 'culls' | 'feed'): string {
    const receipt = this.supplierReceipt(vendorId);
    if (!receipt) return 'Not recorded';
    return `${this.number(receipt[`${kind}Quantity`])} · ${this.number(receipt[`${kind}Weight`])} kg · ₹${this.number(receipt[`${kind}Total`]).toFixed(2)}`;
  }
  toggleSupplierReceiptForm(form: SupplierReceiptForm): void {
    this.activePickupVendorId = this.activePickupVendorId === form.vendorId ? '' : form.vendorId;
  }
  plannedSalesTotal(): number { return this.destinations.reduce((sum, destination) => sum + this.number(destination['deliveryTotal']), 0); }
  actualSalesTotal(): number { return this.deliveries.reduce((sum, entry) => sum + this.number(entry['deliveryTotal']), 0); }
  proposedSupplierCost(): number { return this.number(this.trip?.['grandTotal']); }
  actualSupplierCost(): number { return this.supplierReceipts.reduce((sum, receipt) => sum + this.number(receipt['total']), 0); }
  supplierReceiptEntryCost(form: SupplierReceiptForm): number {
    const planned = this.plannedSupplier(form.vendorId);
    return this.number(form.broilerWeight) * this.number(planned?.broiler.rate) +
      this.number(form.cullsWeight) * this.number(planned?.culls.rate) +
      this.number(form.feedWeight) * this.number(planned?.feed.rate);
  }
  completedDestinations(): number { return this.destinations.filter((destination) => this.destinationStatus(destination) === 'Delivered').length; }
  progress(): number { return this.destinations.length ? Math.round(this.completedDestinations() * 100 / this.destinations.length) : 0; }
  destinationStatus(destination: TripRecord): string {
    const id = this.id(destination); const destinationEntries = this.entries(id); const count = destinationEntries.length;
    if (!count) return 'Pending';
    if (destinationEntries[destinationEntries.length - 1]['failedDelivery'] === 'true') return 'Exception';
    const deliveredBirds = this.delivered(id, 'broiler') + this.delivered(id, 'culls');
    const plannedBirds = Number(destination['orderedBroiler'] ?? 0) + Number(destination['orderedCulls'] ?? 0);
    if (deliveredBirds >= plannedBirds) return 'Delivered';
    return count > 1 ? 'Partially Delivered' : 'In Progress';
  }
  open(order: TripRecord): void {
    this.activeOrderId = this.id(order); this.broiler = 0; this.broilerWeight = 0; this.culls = 0; this.cullsWeight = 0; this.feed = 0; this.feedWeight = 0; this.deliveredAt = new Date().toISOString().slice(0, 16); this.remarks = ''; this.reason = ''; this.confirmed = false; this.failedDelivery = false; this.approveExcess = false; this.error = '';
  }
  cancelEntry(): void { this.activeOrderId = ''; }
  async startTrip(): Promise<void> {
    if (!this.trip || !this.canStartTrip || this.saving) return;
    this.saving = true; this.error = ''; this.success = '';
    try { await this.service.startAssignedTrip(this.id(this.trip)); this.success = 'Trip marked in transit.'; await this.load(); }
    catch (e) { this.error = e instanceof Error ? e.message : 'Trip could not be started.'; }
    finally { this.saving = false; }
  }
  async saveEntry(): Promise<void> {
    if (!this.trip || !this.activeOrderId || this.saving) return;
    this.saving = true; this.error = ''; this.success = '';
    try {
      await this.service.saveDelivery(this.id(this.trip), this.activeOrderId, { broiler: Number(this.broiler), broilerWeight: Number(this.broilerWeight), culls: Number(this.culls), cullsWeight: Number(this.cullsWeight), feed: Number(this.feed), feedWeight: Number(this.feedWeight), deliveredAt: this.deliveredAt, remarks: this.remarks, reason: this.reason, confirmed: this.confirmed, failed: this.failedDelivery, approveExcess: this.approveExcess });
      this.activeOrderId = '';
      await this.load();
      this.success = 'Delivery saved. Review reconciliation and complete the trip below.';
    } catch (e) { this.error = e instanceof Error ? e.message : 'Delivery could not be saved.'; }
    finally { this.saving = false; }
  }
  async saveMortality(): Promise<void> {
    if (!this.trip || this.saving) return;
    this.saving = true; this.error = ''; this.success = '';
    try { await this.service.saveTripMortality(this.id(this.trip), Number(this.mortalityQuantity), this.mortalityAt, this.mortalityRemarks); this.success = 'Trip mortality saved.'; await this.load(); }
    catch (e) { this.error = e instanceof Error ? e.message : 'Mortality could not be saved.'; }
    finally { this.saving = false; }
  }
  async saveSupplierReceipt(form: SupplierReceiptForm): Promise<void> {
    if (!this.trip || this.saving) return;
    this.saving = true; this.error = ''; this.success = '';
    try {
      await this.service.saveSupplierPickup(this.id(this.trip), form.vendorId, {
        broiler: Number(form.broiler ?? 0), broilerWeight: Number(form.broilerWeight ?? 0),
        culls: Number(form.culls ?? 0), cullsWeight: Number(form.cullsWeight ?? 0),
        feed: Number(form.feed ?? 0), feedWeight: Number(form.feedWeight ?? 0), reason: form.reason
      });
      this.success = `Actual supplier pickup from ${form.vendorName} saved.`;
      this.activePickupVendorId = '';
      await this.load();
    } catch (e) { this.error = e instanceof Error ? e.message : 'Supplier pickup could not be saved.'; }
    finally { this.saving = false; }
  }
  async savePayment(form: VendorPaymentForm): Promise<void> {
    if (!this.trip || this.saving) return;
    this.saving = true; this.error = ''; this.success = '';
    try {
      if (this.editingPaymentId) {
        await this.service.updateVendorPayment(this.id(this.trip), form.vendorDestinationId, this.editingPaymentId,
          Number(form.amountReceived), form.paymentMethod);
      } else {
        await this.service.saveVendorPayment(this.id(this.trip), form.vendorDestinationId,
          Number(form.amountReceived), form.paymentMethod);
      }
      this.success = `Payment from ${form.vendorName} ${this.editingPaymentId ? 'updated' : 'saved'}.`;
      this.activePaymentVendorId = '';
      this.editingPaymentId = '';
      await this.load();
    } catch (e) { this.error = e instanceof Error ? e.message : 'Payment could not be saved.'; }
    finally { this.saving = false; }
  }
  unreconciled(): number { return this.totalLoaded() - this.totalDelivered() - this.number(this.mortality?.['quantity']); }
  async complete(): Promise<void> {
    if (!this.trip || this.saving) return;
    this.saving = true; this.error = ''; this.success = '';
    try {
      const result = await this.service.submitForReconciliation(this.id(this.trip), {
        approveDiscrepancy: this.approveReconciliation, reason: this.reconciliationReason
      });
      this.approveReconciliation = false; this.reconciliationReason = '';
      if (result === 'completed') {
        await this.router.navigate(['/people-logistics/trips/deliveries'], {
          state: { successMessage: 'Trip completed successfully.' }
        });
      } else {
        this.success = 'Trip submitted for Organization Admin reconciliation approval.';
        await this.load();
      }
    }
    catch (e) { this.error = e instanceof Error ? e.message : 'Trip could not be completed.'; }
    finally { this.saving = false; }
  }
}
