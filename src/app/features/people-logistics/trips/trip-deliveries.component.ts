import { LoadingSkeletonComponent } from '../../../common/components/loading-skeleton/loading-skeleton.component';
import { InfoPopoverComponent } from '../../../common/components/info-popover/info-popover.component';
import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TripRecord, TripVendorPickup, TRIP_WEIGHT_RECONCILIATION_TOLERANCE_KG } from '../../../common/models/trip.model';
import { TripService } from '../../../common/services/trip.service';
import { SessionAuthService } from '../../../common/services/session-auth.service';
import { RolePermissionService } from '../../../common/services/role-permission.service';
import { FinanceApiService, FinanceRecord, PaymentMethod, PaymentType } from '../../../common/services/finance-api.service';
import { StatusPillPipe } from '../../../common/pipes/status-pill.pipe';
import { TripApiService } from '../../../common/services/trip-api.service';
import { ExpenseApiService, ExpenseRecord } from '../../../common/services/expenses-api.service';
import { ToastService } from '../../../common/services/toast.service';

interface SupplierReceiptForm {
  vendorId: string; vendorName: string;
  broiler: number | null; broilerWeight: number | null;
  culls: number | null; cullsWeight: number | null;
  feed: number | null; feedWeight: number | null; reason: string;
}

@Component({
  selector: 'app-trip-deliveries', standalone: true, imports: [CommonModule, LoadingSkeletonComponent, InfoPopoverComponent, FormsModule, RouterLink, StatusPillPipe],
  templateUrl: './trip-deliveries.component.html', styleUrl: './trip-deliveries.component.css'
})
export class TripDeliveriesComponent implements OnInit {
  trips: TripRecord[] = [];
  tripsPage = 0;
  tripsTotalPages = 0;
  loadingMoreTrips = false;
  trip?: TripRecord;
  destinations: TripRecord[] = [];
  deliveries: TripRecord[] = [];
  supplierPickups: TripVendorPickup[] = [];
  supplierReceipts: TripRecord[] = [];
  supplierReceiptForms: SupplierReceiptForm[] = [];
  tripPayments: FinanceRecord[] = [];
  tripExpenses: ExpenseRecord[] = [];
  readonly expenseCategories = ['TRANSPORT', 'LOADING', 'FUEL', 'MARKET_FEE', 'OTHER'];
  expenseCategory = 'TRANSPORT';
  expenseAmount: number | null = null;
  expenseDate = new Date().toISOString().slice(0, 10);
  expenseNote = '';
  showExpenseForm = false;
  editingExpenseId = '';
  showAddStopForm = false;
  newStopVendorId = '';
  newStopBroilerQty = 0;
  newStopBroilerWeight = 0;
  newStopBroilerRate = 0;
  newStopCullsQty = 0;
  newStopCullsWeight = 0;
  newStopCullsRate = 0;
  newStopFeedQty = 0;
  newStopFeedWeight = 0;
  newStopFeedRate = 0;
  allSuppliers: TripRecord[] = [];
  allDeliveryVendors: TripRecord[] = [];
  private pendingSupplierPickupIds: Record<string, string> = {};
  private pendingVendorDeliveryIds: string[] = [];
  activePickupVendorId = '';
  loadedBroiler = 0;
  loadedCulls = 0;
  mortalities: TripRecord[] = [];
  loading = true;
  saving = false;
  error = '';
  dateFilter = '';
  vehicleFilter = '';
  routeFilter = '';
  statusFilter = '';
  activeOrderId = '';
  expandedDestinationIds = new Set<string>();
  editingDeliveryId = '';
  broiler = 0;
  broilerWeight = 0;
  broilerRate = 0;
  culls = 0;
  cullsWeight = 0;
  cullsRate = 0;
  feed = 0;
  feedWeight = 0;
  feedRate = 0;
  remarks = '';
  reason = '';
  mortalityQuantity = 0;
  mortalityRemarks = '';
  showMortalityForm = false;
  editingMortalityId = '';
  paymentType: PaymentType = 'BUYER_RECEIPT';
  paymentPartyId = '';
  paymentAmount: number | null = null;
  paymentDate = new Date().toISOString().slice(0, 10);
  paymentMethod: PaymentMethod = 'UPI';
  paymentReference = '';
  showPaymentForm = false;
  showQrCodeModal = false;
  editingPaymentId = '';

  constructor(private readonly service: TripService, private readonly finance: FinanceApiService, private readonly expensesApi: ExpenseApiService, private readonly tripApi: TripApiService, private readonly route: ActivatedRoute, private readonly router: Router, readonly auth: SessionAuthService, readonly rolePermissions: RolePermissionService, private readonly toast: ToastService) {}

  async ngOnInit(): Promise<void> {
    const state = this.router.getCurrentNavigation()?.extras.state as { successMessage?: string } | undefined;
    if (state?.successMessage) this.toast.success(state.successMessage);
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading = true; this.error = '';
    try {
      const tripId = this.route.snapshot.paramMap.get('tripId');
      if (tripId) {
        this.readPendingSupplierPickups(tripId);
        this.readPendingVendorDeliveries(tripId);
        const [data, payments, suppliersDirectory, deliveryVendorsDirectory] = await Promise.all([
          this.service.getDeliveryData(tripId, this.pendingPickupIds(), this.pendingDeliveryIds()),
          this.finance.paymentsForTrip(tripId),
          this.tripApi.getBuyingParties(),
          this.tripApi.getSellingParties()
        ]);
        this.trip = data.trip; this.destinations = data.destinations; this.deliveries = data.deliveries; this.mortalities = data.mortalities;
        this.supplierPickups = data.supplierPickups; this.supplierReceipts = data.supplierReceipts;
        this.tripPayments = payments;
        this.tripExpenses = data.expenses;
        this.allSuppliers = suppliersDirectory.filter((party) => this.isAvailablePaymentParty(party)) as TripRecord[];
        this.allDeliveryVendors = deliveryVendorsDirectory.filter((party) => this.isAvailablePaymentParty(party)) as TripRecord[];
        this.supplierReceiptForms = data.supplierPickups.map((pickup) => {
          const receipt = data.supplierReceipts.find((record) => String(record['vendorId'] ?? '') === pickup.vendorId);
          return {
            vendorId: pickup.vendorId, vendorName: pickup.vendorName,
            broiler: receipt ? this.number(receipt['broilerQuantity']) : 0,
            broilerWeight: receipt ? this.number(receipt['broilerWeight']) : 0,
            culls: receipt ? this.number(receipt['cullsQuantity']) : 0,
            cullsWeight: receipt ? this.number(receipt['cullsWeight']) : 0,
            feed: receipt ? this.number(receipt['feedQuantity']) : 0,
            feedWeight: receipt ? this.number(receipt['feedWeight']) : 0,
            reason: String(receipt?.['reason'] ?? '')
          };
        });
        this.loadedBroiler = data.loadedBroiler; this.loadedCulls = data.loadedCulls;
      } else {
        await this.loadDeliveryTripsPage(0, true);
      }
    } catch (e) { this.error = e instanceof Error ? e.message : 'Trip delivery data could not be loaded.'; }
    finally { this.loading = false; }
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (this.trip || this.loading || this.loadingMoreTrips || this.tripsPage + 1 >= this.tripsTotalPages) {
      return;
    }
    const threshold = 200;
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - threshold) {
      void this.loadDeliveryTripsPage(this.tripsPage + 1, false);
    }
  }

  async loadDeliveryTripsPage(targetPage: number, reset: boolean): Promise<void> {
    if (!reset) {
      this.loadingMoreTrips = true;
    }
    try {
      const result = await this.service.getDeliveryTripsPage(targetPage, 5);
      this.trips = reset ? result.items : [...this.trips, ...result.items];
      this.tripsPage = result.page;
      this.tripsTotalPages = result.totalPages;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Trip delivery data could not be loaded.';
    } finally {
      this.loadingMoreTrips = false;
    }
  }

  get filteredTrips(): TripRecord[] {
    return this.trips.filter((trip) => (!this.dateFilter || trip['tripDate'] === this.dateFilter) &&
      (!this.vehicleFilter || String(trip['vehicleName'] ?? '').toLowerCase().includes(this.vehicleFilter.toLowerCase())) &&
      (!this.routeFilter || String(trip['route'] ?? '').toLowerCase().includes(this.routeFilter.toLowerCase())) &&
      (!this.statusFilter || String(trip['status'] ?? '') === this.statusFilter));
  }
  id(record: TripRecord): string { return String(record['_demoId'] ?? ''); }
  private pendingPickupIds(): string[] { return Object.values(this.pendingSupplierPickupIds); }
  private pendingDeliveryIds(): string[] { return this.pendingVendorDeliveryIds; }
  private pendingPickupStorageKey(tripId: string): string { return `trip-delivery-pickups:${tripId}`; }
  private pendingDeliveryStorageKey(tripId: string): string { return `trip-delivery-vendor-deliveries:${tripId}`; }
  private readPendingSupplierPickups(tripId: string): void {
    this.pendingSupplierPickupIds = {};
    if (typeof window === 'undefined') return;
    const stored = window.sessionStorage.getItem(this.pendingPickupStorageKey(tripId));
    if (!stored) return;
    let parsed: unknown;
    try { parsed = JSON.parse(stored); }
    catch { throw new Error("Saved supplier pickup IDs could not be read. Clear this trip's pending pickup data and try again."); }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error("Saved supplier pickup IDs are invalid. Clear this trip's pending pickup data and try again.");
    }
    for (const [vendorId, pickupId] of Object.entries(parsed)) {
      if (!vendorId || typeof pickupId !== 'string' || !/^\d+$/.test(pickupId)) {
        throw new Error("Saved supplier pickup IDs are invalid. Clear this trip's pending pickup data and try again.");
      }
      this.pendingSupplierPickupIds[vendorId] = pickupId;
    }
  }
  private persistPendingSupplierPickups(tripId: string): void {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(this.pendingPickupStorageKey(tripId), JSON.stringify(this.pendingSupplierPickupIds));
    }
  }
  private clearPendingSupplierPickups(tripId: string): void {
    this.pendingSupplierPickupIds = {};
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(this.pendingPickupStorageKey(tripId));
  }
  private readPendingVendorDeliveries(tripId: string): void {
    this.pendingVendorDeliveryIds = [];
    if (typeof window === 'undefined') return;
    const stored = window.sessionStorage.getItem(this.pendingDeliveryStorageKey(tripId));
    if (!stored) return;
    let parsed: unknown;
    try { parsed = JSON.parse(stored); }
    catch { throw new Error("Saved vendor delivery IDs could not be read. Clear this trip's pending delivery data and try again."); }
    if (!Array.isArray(parsed) || !parsed.every((id): id is string => typeof id === 'string' && /^\d+$/.test(id))) {
      throw new Error("Saved vendor delivery IDs are invalid. Clear this trip's pending delivery data and try again.");
    }
    this.pendingVendorDeliveryIds = [...new Set(parsed)];
  }
  private persistPendingVendorDeliveries(tripId: string): void {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(this.pendingDeliveryStorageKey(tripId), JSON.stringify(this.pendingVendorDeliveryIds));
    }
  }
  private clearPendingVendorDeliveries(tripId: string): void {
    this.pendingVendorDeliveryIds = [];
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(this.pendingDeliveryStorageKey(tripId));
  }
  number(value: unknown): number { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
  get currentDestination(): TripRecord | undefined { return this.destinations.find((destination) => this.id(destination) === this.activeOrderId); }
  get canEnterDelivery(): boolean { return ['In transit', 'Delivery in progress'].includes(String(this.trip?.['status'] ?? '')); }
  get canStartTrip(): boolean { return String(this.trip?.['status'] ?? '') === 'Assigned'; }
  get canReopenTrip(): boolean {
    return this.auth.currentUser?.role === 'Organization Admin' &&
      this.canUpdateTrip &&
      ['Completed', 'Pending reconciliation'].includes(String(this.trip?.['status'] ?? ''));
  }
  get canUpdateTrip(): boolean { return this.rolePermissions.can('trips', 'update'); }
  get canAddVendorStop(): boolean {
    return this.canUpdateTrip || this.rolePermissions.can('deliveries', 'update');
  }
  get availableStopVendors(): TripRecord[] {
    const existingIds = new Set(this.destinations.map((d) => String(d['vendorId'] ?? d['_demoId'] ?? '')));
    return this.allDeliveryVendors.filter((v) => !existingIds.has(String(v['_demoId'] ?? '')));
  }
  toggleAddStopForm(): void {
    this.showAddStopForm = !this.showAddStopForm;
    this.error = '';
    if (this.showAddStopForm) {
      this.newStopVendorId = '';
      this.newStopBroilerQty = 0; this.newStopBroilerWeight = 0; this.newStopBroilerRate = 0;
      this.newStopCullsQty = 0; this.newStopCullsWeight = 0; this.newStopCullsRate = 0;
      this.newStopFeedQty = 0; this.newStopFeedWeight = 0; this.newStopFeedRate = 0;
    }
  }
  newStopPlannedTotal(): number {
    return this.number(this.newStopBroilerWeight) * this.number(this.newStopBroilerRate)
      + this.number(this.newStopCullsWeight) * this.number(this.newStopCullsRate)
      + this.number(this.newStopFeedWeight) * this.number(this.newStopFeedRate);
  }
  async saveNewStop(): Promise<void> {
    if (!this.trip || !this.canAddVendorStop) return;
    const vendor = this.allDeliveryVendors.find((v) => String(v['_demoId'] ?? '') === this.newStopVendorId);
    if (!vendor) { this.error = 'Select a delivery vendor.'; return; }
    this.saving = true; this.error = '';
    try {
      const tripId = this.id(this.trip);
      const deliveryId = await this.tripApi.addVendorStop(tripId, vendor, {
        broilerQuantity: this.number(this.newStopBroilerQty),
        broilerWeight: this.number(this.newStopBroilerWeight),
        broilerRate: this.number(this.newStopBroilerRate),
        cullsQuantity: this.number(this.newStopCullsQty),
        cullsWeight: this.number(this.newStopCullsWeight),
        cullsRate: this.number(this.newStopCullsRate),
        feedQuantity: this.number(this.newStopFeedQty),
        feedWeight: this.number(this.newStopFeedWeight),
        feedRate: this.number(this.newStopFeedRate)
      });
      if (deliveryId && !this.pendingVendorDeliveryIds.includes(deliveryId)) {
        this.pendingVendorDeliveryIds.push(deliveryId);
        this.persistPendingVendorDeliveries(tripId);
      }
      await this.tripApi.updateTripStatus(tripId, 'Pending reconciliation');
      this.showAddStopForm = false;
      this.toast.success('Vendor stop added. Trip submitted for reconciliation and admin approval.');
      await this.load();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Vendor stop could not be added.';
    } finally { this.saving = false; }
  }
  get canEditActualDelivery(): boolean {
    return this.auth.currentUser?.role === 'Organization Admin' && this.canUpdateTrip;
  }
  get canEditSupplierPickup(): boolean {
    if (String(this.trip?.['status'] ?? '') !== 'Completed') return true;
    const role = this.auth.currentUser?.role;
    return (role === 'Organization Admin' && this.canUpdateTrip) ||
      (role === 'Supervisor' && this.rolePermissions.can('deliveries', 'update'));
  }
  get paymentParties(): { id: string; name: string }[] {
    if (this.paymentType === 'BUYER_RECEIPT') {
      return this.allDeliveryVendors.map((party) => ({
        id: `SELLING:${this.directoryPartyId(party)}`,
        name: String(party['name'] ?? party['vendorName'] ?? 'Unnamed vendor')
      })).filter((party) => party.id !== 'SELLING:');
    }
    return this.allSuppliers.map((party) => ({
      id: `BUYING:${this.directoryPartyId(party)}`,
      name: String(party['name'] ?? party['vendorName'] ?? 'Unnamed supplier')
    })).filter((party) => party.id !== 'BUYING:');
  }
  private directoryPartyId(party: TripRecord): string {
    return String(party['_demoId'] ?? party['id'] ?? party['vendorId'] ?? party['supplierId'] ?? party['vendorDestinationId'] ?? '');
  }
  private isAvailablePaymentParty(party: Record<string, unknown>): boolean {
    const status = String(party['status'] ?? '').trim().toLowerCase();
    return party['isDeleted'] !== true && party['isActive'] !== false &&
      (!status || status === 'active');
  }
  private paymentPartyRole(payment: FinanceRecord): 'BUYING' | 'SELLING' {
    if (payment['partyRole'] === 'BUYING' || payment['buyingPartyId'] != null) return 'BUYING';
    if (payment['partyRole'] === 'SELLING' || payment['sellingPartyId'] != null) return 'SELLING';
    return payment['paymentType'] === 'SELLER_PAYOUT' ? 'BUYING' : 'SELLING';
  }
  paymentPartyName(payment: FinanceRecord): string {
    const partyId = String(payment['partyId'] ?? payment['buyingPartyId'] ?? payment['sellingPartyId'] ?? '');
    const partyRole = this.paymentPartyRole(payment);
    const directory = partyRole === 'BUYING' ? this.allSuppliers : this.allDeliveryVendors;
    const tripParties = partyRole === 'BUYING' ? this.supplierPickups : this.destinations;
    const directoryName = directory.find((party) => this.directoryPartyId(party) === partyId)?.['name'];
    const tripName = partyRole === 'BUYING'
      ? (tripParties as TripVendorPickup[]).find((party) => party.vendorId === partyId)?.vendorName
      : (tripParties as TripRecord[]).find((party) => String(party['vendorDestinationId'] ?? '') === partyId)?.['vendorName'];
    return String(directoryName ?? tripName ?? payment['partyName'] ?? payment['buyingPartyName'] ?? payment['sellingPartyName'] ?? partyId ?? '—');
  }
  togglePaymentForm(): void {
    if (this.showPaymentForm || this.editingPaymentId) this.cancelPaymentEdit();
    else this.showPaymentForm = true;
  }
  toggleExpenseForm(): void {
    if (this.showExpenseForm) this.cancelExpenseEdit();
    else this.showExpenseForm = true;
  }
  editExpense(expense: ExpenseRecord): void {
    this.editingExpenseId = String(expense['id'] ?? '');
    if (!this.editingExpenseId) return;
    this.expenseCategory = String(expense['category'] ?? 'OTHER');
    this.expenseAmount = this.number(expense['amount']);
    this.expenseDate = String(expense['expenseDate'] ?? '').slice(0, 10);
    this.expenseNote = String(expense['note'] ?? '');
    this.showExpenseForm = true;
  }
  cancelExpenseEdit(): void {
    this.editingExpenseId = '';
    this.expenseCategory = 'TRANSPORT';
    this.expenseAmount = null;
    this.expenseDate = new Date().toISOString().slice(0, 10);
    this.expenseNote = '';
    this.showExpenseForm = false;
  }
  expenseCategoryLabel(category: unknown): string {
    return String(category ?? '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
  totalTripExpenses(): number {
    return this.tripExpenses
      .filter((expense) => expense['isDeleted'] !== true && expense['isActive'] !== false)
      .reduce((sum, expense) => sum + this.number(expense['amount']), 0);
  }
  private async refreshTripExpenses(): Promise<void> {
    if (!this.trip) return;
    this.tripExpenses = await this.expensesApi.expensesForTrip(this.id(this.trip));
  }
  async saveExpense(): Promise<void> {
    if (!this.trip || this.saving) return;
    const amount = Number(this.expenseAmount);
    if (!this.expenseCategory.trim() || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(this.expenseDate)) {
      this.error = 'Select an expense category, enter a positive amount, and choose a valid date.';
      return;
    }
    this.saving = true; this.error = '';
    try {
      const editing = !!this.editingExpenseId;
      const existing = this.tripExpenses.find((expense) => String(expense['id'] ?? '') === this.editingExpenseId);
      const input: ExpenseRecord = {
        ...(existing ?? {}),
        ...(editing ? { id: Number(this.editingExpenseId) } : {}),
        tripId: Number(this.id(this.trip)),
        category: this.expenseCategory.trim(),
        amount: Math.round(amount * 100) / 100,
        expenseDate: this.expenseDate,
        note: this.expenseNote.trim(),
        isActive: existing?.['isActive'] ?? true,
        isDeleted: false
      };
      if (editing) await this.expensesApi.updateExpense(this.editingExpenseId, input);
      else await this.expensesApi.createExpense(input);
      this.cancelExpenseEdit();
      this.toast.success(editing ? 'Trip expense updated successfully.' : 'Trip expense added successfully.');
      try {
        await this.refreshTripExpenses();
      } catch (refreshError) {
        this.toast.warning(`Expense was saved, but the list could not be refreshed: ${refreshError instanceof Error ? refreshError.message : 'Unknown error.'}`);
      }
    } catch (e) { this.toast.error(e instanceof Error ? e.message : 'Expense could not be saved.'); }
    finally { this.saving = false; }
  }
  async deleteExpense(expense: ExpenseRecord): Promise<void> {
    const expenseId = String(expense['id'] ?? '');
    if (!expenseId || this.saving || expense['isDeleted'] === true) return;
    if (!window.confirm('Delete this expense?')) return;
    this.saving = true; this.error = '';
    try {
      await this.expensesApi.deleteExpense(expenseId);
      if (this.editingExpenseId === expenseId) this.cancelExpenseEdit();
      this.toast.success('Trip expense deleted successfully.');
      try {
        await this.refreshTripExpenses();
      } catch (refreshError) {
        this.toast.warning(`Expense was deleted, but the list could not be refreshed: ${refreshError instanceof Error ? refreshError.message : 'Unknown error.'}`);
      }
    } catch (e) { this.toast.error(e instanceof Error ? e.message : 'Expense could not be deleted.'); }
    finally { this.saving = false; }
  }
  toggleMortalityForm(): void {
    if (this.showMortalityForm) this.cancelMortalityEdit();
    else this.showMortalityForm = true;
  }
  editPayment(payment: FinanceRecord): void {
    this.editingPaymentId = String(payment['id'] ?? payment['paymentId'] ?? '');
    if (!this.editingPaymentId) return;
    this.paymentType = payment['paymentType'] === 'SELLER_PAYOUT' ? 'SELLER_PAYOUT' : 'BUYER_RECEIPT';
    const partyRole = this.paymentPartyRole(payment);
    this.paymentPartyId = `${partyRole}:${String(payment['partyId'] ?? payment['buyingPartyId'] ?? payment['sellingPartyId'] ?? '')}`;
    this.paymentAmount = this.number(payment['amount']);
    this.paymentDate = String(payment['paymentDate'] ?? '').slice(0, 10);
    this.paymentMethod = payment['paymentMethod'] as PaymentMethod;
    this.paymentReference = String(payment['reference'] ?? payment['externalReference'] ?? '');
    this.showPaymentForm = false;
  }
  paymentId(payment: FinanceRecord): string {
    return String(payment['id'] ?? payment['paymentId'] ?? '');
  }
  cancelPaymentEdit(): void {
    this.editingPaymentId = '';
    this.paymentPartyId = '';
    this.paymentAmount = null;
    this.paymentDate = new Date().toISOString().slice(0, 10);
    this.paymentMethod = 'UPI';
    this.paymentReference = '';
    this.showPaymentForm = false;
  }
  editMortality(record: TripRecord): void {
    this.editingMortalityId = this.id(record);
    if (!this.editingMortalityId) return;
    this.mortalityQuantity = this.number(record['quantity']);
    this.mortalityRemarks = String(record['remarks'] ?? '');
    this.showMortalityForm = true;
  }
  cancelMortalityEdit(): void {
    this.editingMortalityId = '';
    this.mortalityQuantity = 0;
    this.mortalityRemarks = '';
    this.showMortalityForm = false;
  }
  changePaymentType(): void { this.paymentPartyId = ''; }
  entrySales(): number {
    return this.number(this.broilerWeight) * this.number(this.broilerRate) +
      this.number(this.cullsWeight) * this.number(this.cullsRate) +
      this.number(this.feedWeight) * this.number(this.feedRate);
  }
  get hasReconciliationMismatch(): boolean { return this.unreconciled() !== 0; }
  readonly weightToleranceKg = TRIP_WEIGHT_RECONCILIATION_TOLERANCE_KG;
  get hasWeightReconciliationMismatch(): boolean {
    const allDestinationsDelivered = this.destinations.length > 0 && this.destinations.every((destination) =>
      this.deliveries.some((delivery) => String(delivery['vendorDestinationId'] ?? '') === String(destination['vendorDestinationId'] ?? ''))
    );
    return this.supplierReceipts.length > 0 && allDestinationsDelivered &&
      this.weightReconciliationDifference() > this.weightToleranceKg;
  }
  weightReconciliationDifference(): number {
    if (!this.supplierReceipts.length || !this.deliveries.length) return 0;
    return Math.round(Math.abs(this.totalActualSupplierWeight() - this.totalActualVendorDeliveryWeight()) * 100) / 100;
  }
  get hasMissingDestinationDeliveries(): boolean {
    return this.destinations.some((destination) => !this.entries(this.id(destination)).length);
  }
  entries(destinationId: string): TripRecord[] { return this.deliveries.filter((item) => String(item['vendorDestinationId']) === destinationId); }
  delivered(destinationId: string, kind: 'broiler' | 'culls' | 'feed'): number { return this.entries(destinationId).reduce((sum, item) => sum + Number(item[kind] ?? 0), 0); }
  deliveredWeight(destinationId: string, kind: 'broiler' | 'culls' | 'feed'): number { return this.entries(destinationId).reduce((sum, item) => sum + Number(item[`${kind}Weight`] ?? 0), 0); }
  deliveryRevenue(destinationId: string): number { return this.entries(destinationId).reduce((sum, item) => sum + Number(item['deliveryTotal'] ?? 0), 0); }
  deliveryLineSales(destinationId: string, kind: 'broiler' | 'culls' | 'feed'): number {
    return this.entries(destinationId).reduce((sum, item) => sum + this.number(item[`${kind}Total`]), 0);
  }
  deliveryLineRate(destinationId: string, kind: 'broiler' | 'culls' | 'feed'): number {
    const weight = this.deliveredWeight(destinationId, kind);
    return weight > 0 ? this.deliveryLineSales(destinationId, kind) / weight : 0;
  }
  isDestinationExpanded(destinationId: string): boolean {
    return this.expandedDestinationIds.has(destinationId) || this.activeOrderId === destinationId;
  }
  toggleDestinationDetails(destinationId: string): void {
    if (this.isDestinationExpanded(destinationId)) this.expandedDestinationIds.delete(destinationId);
    else this.expandedDestinationIds.add(destinationId);
  }
  remaining(destination: TripRecord): string {
    const plannedBirds = this.number(destination['orderedBroiler']) + this.number(destination['orderedCulls']);
    const amount = plannedBirds - this.delivered(this.id(destination), 'broiler') - this.delivered(this.id(destination), 'culls');
    return amount < 0 ? `${Math.abs(amount)} excess` : `${amount} remaining`;
  }
  deliveredBroilerTotal(): number { return this.deliveries.reduce((sum, item) => sum + this.number(item['broiler']), 0); }
  deliveredCullsTotal(): number { return this.deliveries.reduce((sum, item) => sum + this.number(item['culls']), 0); }
  deliveredFeedTotal(): number { return this.deliveries.reduce((sum, item) => sum + this.number(item['feed']), 0); }
  totalDelivered(): number { return this.deliveredBroilerTotal() + this.deliveredCullsTotal(); }
  totalLoaded(): number { return this.loadedBroiler + this.loadedCulls; }
  totalMortality(): number { return this.mortalities.reduce((sum, record) => sum + this.number(record['quantity']), 0); }
  totalLoadedWeight(): number { return this.supplierReceipts.reduce((sum, receipt) => sum + this.number(receipt['broilerWeight']) + this.number(receipt['cullsWeight']), 0); }
  totalActualSupplierWeight(): number {
    return this.supplierReceipts.reduce((sum, receipt) => sum + this.number(receipt['broilerWeight']) + this.number(receipt['cullsWeight']) + this.number(receipt['feedWeight']), 0);
  }
  totalActualVendorDeliveryWeight(): number {
    return this.deliveries.reduce((sum, delivery) => sum + this.number(delivery['broilerWeight']) + this.number(delivery['cullsWeight']) + this.number(delivery['feedWeight']), 0);
  }
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
    return `${this.number(receipt?.[`${kind}Quantity`])} · ${this.number(receipt?.[`${kind}Weight`])} kg · ₹${this.number(receipt?.[`${kind}Total`]).toFixed(2)}`;
  }
  toggleSupplierReceiptForm(form: SupplierReceiptForm): void {
    if (!this.canEditSupplierPickup || this.saving) return;
    this.activePickupVendorId = this.activePickupVendorId === form.vendorId ? '' : form.vendorId;
  }
  plannedSalesTotal(): number { return this.destinations.reduce((sum, destination) => sum + this.number(destination['deliveryTotal']), 0); }
  actualSalesTotal(): number { return this.deliveries.reduce((sum, entry) => sum + this.number(entry['deliveryTotal']), 0); }
  proposedSupplierCost(): number { return this.number(this.trip?.['grandTotal']); }
  actualSupplierCost(): number { return this.supplierReceipts.reduce((sum, receipt) => sum + this.number(receipt['total']), 0); }
  tripProfit(): number { return this.actualSalesTotal() - this.actualSupplierCost() - this.totalTripExpenses(); }
  paymentMethodBreakdown(): { method: string; label: string; amount: number }[] {
    const totals = new Map<string, number>();
    for (const payment of this.tripPayments) {
      if (payment['paymentType'] !== 'BUYER_RECEIPT' || payment['status'] !== 'COMPLETED' || payment['isDeleted'] === true) continue;
      const method = String(payment['paymentMethod'] ?? 'OTHER').toUpperCase();
      totals.set(method, (totals.get(method) ?? 0) + this.number(payment['amount']));
    }
    const labels: Record<string, string> = {
      BANK_TRANSFER: 'Bank Transfer', CASH: 'Cash', CHEQUE: 'Cheque', UPI: 'UPI', CARD: 'Card', OTHER: 'Other'
    };
    return [...totals.entries()]
      .filter(([, amount]) => amount > 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([method, amount]) => ({ method, label: labels[method] ?? method.replace(/_/g, ' '), amount }));
  }
  openQrCodeModal(): void { this.showQrCodeModal = true; }
  closeQrCodeModal(): void { this.showQrCodeModal = false; }

  totalPaymentReceived(): number {
    return this.tripPayments
      .filter((payment) => payment['paymentType'] === 'BUYER_RECEIPT' && payment['status'] === 'COMPLETED' && payment['isDeleted'] !== true)
      .reduce((sum, payment) => sum + this.number(payment['amount']), 0);
  }
  buyerPaymentsDue(): number { return Math.max(0, this.actualSalesTotal() - this.totalPaymentReceived()); }
  totalSupplierPaymentsMade(): number {
    const currentTripSupplierIds = new Set(this.supplierPickups.map((pickup) => String(pickup.vendorId)));
    return this.tripPayments
      .filter((payment) => {
        const partyId = String(payment['partyId'] ?? payment['buyingPartyId'] ?? payment['sellingPartyId'] ?? '');
        return payment['paymentType'] === 'SELLER_PAYOUT' && this.paymentPartyRole(payment) === 'BUYING' &&
          currentTripSupplierIds.has(partyId) && payment['status'] === 'COMPLETED' && payment['isDeleted'] !== true;
      })
      .reduce((sum, payment) => sum + this.number(payment['amount']), 0);
  }
  paymentsToBeDone(): number {
    return Math.max(0, this.actualSupplierCost() - this.totalSupplierPaymentsMade());
  }
  supplierReceiptEntryCost(form: SupplierReceiptForm): number {
    const planned = this.plannedSupplier(form.vendorId);
    return this.number(form.broilerWeight) * this.number(planned?.broiler.rate) +
      this.number(form.cullsWeight) * this.number(planned?.culls.rate) +
      this.number(form.feedWeight) * this.number(planned?.feed.rate);
  }
  completedSupplierPickups(): number { return this.supplierReceiptForms.filter((form) => !!this.supplierReceipt(form.vendorId)).length; }
  completedDestinations(): number { return this.destinations.filter((destination) => this.destinationStatus(destination) === 'Delivered').length; }
  totalProgressItems(): number { return this.supplierReceiptForms.length + this.destinations.length; }
  completedProgressItems(): number { return this.completedSupplierPickups() + this.completedDestinations(); }
  progress(): number {
    if (String(this.trip?.['status'] ?? '') === 'Completed' || (this.allSupplierReceiptsSaved() && this.totalLoaded() > 0 && this.totalLoaded() === this.totalDelivered())) {
      return 100;
    }
    return this.totalProgressItems() ? Math.round(this.completedProgressItems() * 100 / this.totalProgressItems()) : 0;
  }
  destinationStatus(destination: TripRecord): string {
    const id = this.id(destination); const destinationEntries = this.entries(id); const count = destinationEntries.length;
    if (!count) return 'Pending';
    const deliveredBirds = this.delivered(id, 'broiler') + this.delivered(id, 'culls');
    const plannedBirds = Number(destination['orderedBroiler'] ?? 0) + Number(destination['orderedCulls'] ?? 0);
    if (deliveredBirds >= plannedBirds) return 'Delivered';
    return count > 1 ? 'Partially Delivered' : 'In Progress';
  }
  open(order: TripRecord): void {
    this.editingDeliveryId = '';
    this.activeOrderId = this.id(order);
    this.broiler = 0; this.broilerWeight = 0; this.broilerRate = this.number(order['broilerRate']);
    this.culls = 0; this.cullsWeight = 0; this.cullsRate = this.number(order['cullsRate']);
    this.feed = 0; this.feedWeight = 0; this.feedRate = this.number(order['feedRate']);
    this.remarks = ''; this.reason = ''; this.error = '';
  }
  editActualDelivery(delivery: TripRecord): void {
    if (!this.canEditActualDelivery) return;
    this.editingDeliveryId = this.id(delivery);
    this.activeOrderId = String(delivery['vendorDestinationId'] ?? '');
    if (!this.editingDeliveryId || !this.activeOrderId) {
      this.cancelEntry();
      this.error = 'This actual delivery could not be opened for editing.';
      return;
    }
    this.broiler = this.number(delivery['broiler']);
    this.broilerWeight = this.number(delivery['broilerWeight']);
    this.broilerRate = this.number(delivery['broilerRate']);
    this.culls = this.number(delivery['culls']);
    this.cullsWeight = this.number(delivery['cullsWeight']);
    this.cullsRate = this.number(delivery['cullsRate']);
    this.feed = this.number(delivery['feed']);
    this.feedWeight = this.number(delivery['feedWeight']);
    this.feedRate = this.number(delivery['feedRate']);
    this.reason = '';
    this.remarks = String(delivery['remarks'] ?? delivery['reason'] ?? '');
    this.error = '';
  }
  cancelEntry(): void { this.activeOrderId = ''; this.editingDeliveryId = ''; }
  async startTrip(): Promise<void> {
    if (!this.trip || !this.canStartTrip || this.saving) return;
    this.saving = true; this.error = '';
    try { await this.service.startAssignedTrip(this.id(this.trip)); this.toast.success('Trip marked in transit.'); await this.load(); }
    catch (e) { this.toast.error(e instanceof Error ? e.message : 'Trip could not be started.'); }
    finally { this.saving = false; }
  }
  async reopenTrip(): Promise<void> {
    if (!this.trip || !this.canReopenTrip || this.saving) return;
    if (!window.confirm('Reopen this trip and set its status back to In transit?')) return;
    this.saving = true; this.error = '';
    try { await this.service.reopenTrip(this.id(this.trip)); this.toast.success('Trip reopened and marked In transit.'); await this.load(); }
    catch (e) { this.toast.error(e instanceof Error ? e.message : 'Trip could not be reopened.'); }
    finally { this.saving = false; }
  }
  async saveEntry(): Promise<void> {
    if (!this.trip || !this.activeOrderId || this.saving ||
      (this.editingDeliveryId && !this.canEditActualDelivery)) return;
    this.saving = true; this.error = '';
    let deliverySaved = false;
    try {
      const tripId = this.id(this.trip);
      const editing = !!this.editingDeliveryId;
      const deliveryId = await this.service.saveDelivery(tripId, this.activeOrderId, {
        broiler: Number(this.broiler), broilerWeight: Number(this.broilerWeight), broilerRate: Number(this.broilerRate),
        culls: Number(this.culls), cullsWeight: Number(this.cullsWeight), cullsRate: Number(this.cullsRate),
        feed: Number(this.feed), feedWeight: Number(this.feedWeight), feedRate: Number(this.feedRate),
        remarks: this.remarks, reason: this.reason
      }, this.pendingPickupIds(), this.pendingDeliveryIds(), this.editingDeliveryId || undefined);
      deliverySaved = true;
      if (!editing && !this.pendingVendorDeliveryIds.includes(deliveryId)) this.pendingVendorDeliveryIds.push(deliveryId);
      this.persistPendingVendorDeliveries(tripId);
      const autoCompleted = !editing && await this.service.completeTripIfQuantitiesMatch(tripId, this.pendingPickupIds(), this.pendingDeliveryIds());
      if (autoCompleted) {
        this.clearPendingSupplierPickups(tripId);
        this.clearPendingVendorDeliveries(tripId);
      }
      this.cancelEntry();
      await this.load();
      this.toast.success(
        autoCompleted
          ? 'Delivery saved. Actual pickup and vendor destination quantities match — trip marked Completed.'
          : editing
            ? 'Actual delivery updated successfully.'
            : 'Delivery saved successfully. Record mortality if applicable, review reconciliation, and complete the trip below.'
      );
    } catch (e) {
      if (deliverySaved && this.trip) {
        this.cancelEntry();
        await this.load();
      }
      this.toast.error(e instanceof Error ? e.message : 'Delivery could not be saved.');
    }
    finally { this.saving = false; }
  }
  async deleteVendorOrder(destination: TripRecord): Promise<void> {
    const destinationId = this.id(destination);
    if (!this.trip || !destinationId || this.saving || !this.canEditActualDelivery) return;
    if (!window.confirm(`Delete order for ${destination['vendorName']} from both proposed and actual orders?`)) return;
    this.saving = true; this.error = '';
    try {
      const tripId = this.id(this.trip);
      const actualEntries = this.entries(destinationId);
      const deletedIds = new Set<string>();
      for (const delivery of actualEntries) {
        const deliveryId = this.id(delivery);
        if (!deliveryId) continue;
        await this.tripApi.deleteVendorDelivery(deliveryId);
        deletedIds.add(deliveryId);
      }
      if (deletedIds.size) {
        this.pendingVendorDeliveryIds = this.pendingVendorDeliveryIds.filter((id) => !deletedIds.has(id));
        this.persistPendingVendorDeliveries(tripId);
      }
      await this.tripApi.removeVendorStop(tripId, destinationId);
      if (String(this.trip['status'] ?? '') === 'Completed') {
        await this.service.reopenCompletedTripForWeightMismatch(tripId);
      }
      if (this.activeOrderId === destinationId || (this.editingDeliveryId && deletedIds.has(this.editingDeliveryId))) {
        this.cancelEntry();
      }
      this.toast.success('Order deleted from proposed and actual orders.');
      await this.load();
    } catch (e) { this.toast.error(e instanceof Error ? e.message : 'Order could not be deleted.'); }
    finally { this.saving = false; }
  }
  async deleteSupplierReceipt(form: SupplierReceiptForm): Promise<void> {
    const receipt = this.supplierReceipt(form.vendorId);
    const pickupId = receipt ? this.id(receipt) : '';
    if (!this.trip || !pickupId || this.saving || !this.canEditActualDelivery) return;
    if (!window.confirm(`Delete actual supplier pickup from ${form.vendorName}?`)) return;
    this.saving = true; this.error = '';
    try {
      const tripId = this.id(this.trip);
      await this.tripApi.deleteSupplierPickup(pickupId);
      delete this.pendingSupplierPickupIds[form.vendorId];
      this.persistPendingSupplierPickups(tripId);
      if (String(this.trip['status'] ?? '') === 'Completed') {
        await this.service.reopenCompletedTripForWeightMismatch(tripId);
      }
      if (this.activePickupVendorId === form.vendorId) this.activePickupVendorId = '';
      this.toast.success(`Actual supplier pickup from ${form.vendorName} deleted successfully.`);
      await this.load();
    } catch (e) { this.toast.error(e instanceof Error ? e.message : 'Supplier pickup could not be deleted.'); }
    finally { this.saving = false; }
  }
  async saveMortality(): Promise<void> {
    if (!this.trip || this.saving || !this.allSupplierReceiptsSaved()) return;
    this.saving = true; this.error = '';
    try {
      const editing = !!this.editingMortalityId;
      await this.service.saveTripMortality(this.id(this.trip), Number(this.mortalityQuantity), this.mortalityRemarks, this.pendingPickupIds(), this.pendingDeliveryIds(), this.editingMortalityId || undefined);
      this.cancelMortalityEdit();
      this.toast.success(editing ? 'Trip mortality record updated successfully.' : 'Trip mortality record saved successfully.');
      await this.load();
    }
    catch (e) { this.toast.error(e instanceof Error ? e.message : 'Mortality could not be saved.'); }
    finally { this.saving = false; }
  }
  async deleteMortality(record: TripRecord): Promise<void> {
    const mortalityId = this.id(record);
    if (!this.trip || !mortalityId || this.saving || String(this.trip['status']) === 'Completed') return;
    if (!window.confirm('Delete this mortality record?')) return;
    this.saving = true; this.error = '';
    try {
      await this.service.deleteTripMortality(this.id(this.trip), mortalityId);
      if (this.editingMortalityId === mortalityId) this.cancelMortalityEdit();
      this.toast.success('Trip mortality record deleted successfully.');
      await this.load();
    } catch (e) { this.toast.error(e instanceof Error ? e.message : 'Mortality record could not be deleted.'); }
    finally { this.saving = false; }
  }
  private async refreshTripPaymentHistory(): Promise<void> {
    if (!this.trip) return;
    this.tripPayments = await this.finance.paymentsForTrip(this.id(this.trip));
  }

  async savePayment(): Promise<void> {
    if (!this.trip || this.saving || !this.paymentPartyId || !this.paymentAmount || this.paymentAmount <= 0) {
      this.error = 'Select a party and enter a positive payment amount.';
      return;
    }
    this.saving = true; this.error = '';
    try {
      const editing = !!this.editingPaymentId;
      const existing = this.tripPayments.find((item) => String(item['id'] ?? item['paymentId'] ?? '') === this.editingPaymentId);
      const status = (['PENDING', 'COMPLETED', 'FAILED', 'VOID'] as const)
        .find((value) => value === existing?.['status']) ?? 'COMPLETED';
      const [partyRole, partyId] = this.paymentPartyId.split(':', 2);
      if ((partyRole !== 'BUYING' && partyRole !== 'SELLING') || !/^\d+$/.test(partyId)) {
        this.error = 'Select a valid party.';
        return;
      }
      const selectedPartyRole: 'BUYING' | 'SELLING' = partyRole;
      const input = {
        paymentType: this.paymentType, partyId: Number(partyId), partyRole: selectedPartyRole, amount: this.paymentAmount,
        paymentDate: this.paymentDate, paymentMethod: this.paymentMethod, reference: this.paymentReference,
        status: editing ? status : 'COMPLETED', tripId: Number(this.id(this.trip))
      };
      if (editing) await this.finance.updatePayment(this.editingPaymentId, input);
      else await this.finance.createPayment(input);
      this.cancelPaymentEdit();
      this.toast.success(editing ? 'Payment updated successfully.' : 'Payment created successfully.');
      try {
        await this.refreshTripPaymentHistory();
      } catch (refreshError) {
        this.toast.warning(`Payment was saved, but payment history could not be refreshed: ${refreshError instanceof Error ? refreshError.message : 'Unknown error.'}`);
      }
    } catch (e) { this.toast.error(e instanceof Error ? e.message : 'Payment could not be recorded.'); }
    finally { this.saving = false; }
  }
  async deletePayment(payment: FinanceRecord): Promise<void> {
    const paymentId = String(payment['id'] ?? payment['paymentId'] ?? '');
    if (!paymentId || this.saving || payment['isDeleted'] === true) return;
    if (!window.confirm('Delete this payment? It will remain in the system for audit history.')) return;
    this.saving = true; this.error = '';
    try {
      await this.finance.deletePayment(paymentId);
      if (this.editingPaymentId === paymentId) this.cancelPaymentEdit();
      this.toast.success('Payment deleted successfully.');
      try {
        await this.refreshTripPaymentHistory();
      } catch (refreshError) {
        this.toast.warning(`Payment was deleted, but payment history could not be refreshed: ${refreshError instanceof Error ? refreshError.message : 'Unknown error.'}`);
      }
    } catch (e) { this.toast.error(e instanceof Error ? e.message : 'Payment could not be deleted.'); }
    finally { this.saving = false; }
  }
  async saveSupplierReceipt(form: SupplierReceiptForm): Promise<void> {
    if (!this.trip || this.saving || !this.canEditSupplierPickup) return;
    this.saving = true; this.error = '';
    try {
      const tripId = this.id(this.trip);
      const pickupId = await this.service.saveSupplierPickup(tripId, form.vendorId, {
        broiler: Number(form.broiler ?? 0), broilerWeight: Number(form.broilerWeight ?? 0),
        culls: Number(form.culls ?? 0), cullsWeight: Number(form.cullsWeight ?? 0),
        feed: Number(form.feed ?? 0), feedWeight: Number(form.feedWeight ?? 0), reason: form.reason
      }, this.pendingPickupIds());
      this.pendingSupplierPickupIds[form.vendorId] = pickupId;
      this.persistPendingSupplierPickups(tripId);
      this.toast.success(`Actual supplier pickup from ${form.vendorName} saved successfully.`);
      this.activePickupVendorId = '';
      await this.load();
    } catch (e) { this.toast.error(e instanceof Error ? e.message : 'Supplier pickup could not be saved.'); }
    finally { this.saving = false; }
  }
  unreconciled(): number { return this.totalLoaded() - this.totalDelivered() - this.totalMortality(); }
  async complete(): Promise<void> {
    if (!this.trip || this.saving) return;
    this.saving = true; this.error = '';
    try {
      const tripId = this.id(this.trip);
      const result = await this.service.submitForReconciliation(tripId, this.pendingPickupIds(), this.pendingDeliveryIds());
      this.clearPendingSupplierPickups(tripId);
      this.clearPendingVendorDeliveries(tripId);
      if (result === 'completed') {
        await this.router.navigate(['/people-logistics/trips/deliveries'], {
          state: { successMessage: 'Trip completed successfully.' }
        });
      } else {
        this.toast.success('Trip submitted for Organization Admin reconciliation approval.');
        await this.load();
      }
    }
    catch (e) { this.toast.error(e instanceof Error ? e.message : 'Trip could not be completed.'); }
    finally { this.saving = false; }
  }
}
