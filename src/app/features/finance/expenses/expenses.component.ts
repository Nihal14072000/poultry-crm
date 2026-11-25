import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExpenseApiService, ExpenseRecord } from '../../../common/services/expenses-api.service';
import { TripRecord } from '../../../common/models/trip.model';
import { TripApiService } from '../../../common/services/trip-api.service';
import { RolePermissionService } from '../../../common/services/role-permission.service';
import { ToastService } from '../../../common/services/toast.service';
import { LoadingSkeletonComponent } from '../../../common/components/loading-skeleton/loading-skeleton.component';

interface ExpenseForm {
  tripId: number | null;
  category: string;
  amount: number;
  expenseDate: string;
  note: string;
}

@Component({
  selector: 'app-finance-expenses',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, FormsModule, LoadingSkeletonComponent],
  templateUrl: './expenses.component.html',
  styleUrl: './expenses.component.css'
})
export class ExpensesComponent implements OnInit {
  loading = true;
  saving = false;
  error = '';
  query = '';
  tripFilter = '';
  expenses: ExpenseRecord[] = [];
  trips: TripRecord[] = [];
  page = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;
  totalExpensesAmount = 0;
  editingId = '';
  formOpen = false;
  readonly categories = ['TRANSPORT', 'LOADING', 'FUEL', 'MARKET_FEE', 'OTHER'];
  form: ExpenseForm = this.newForm();

  constructor(
    private readonly api: ExpenseApiService,
    private readonly tripsApi: TripApiService,
    readonly permissions: RolePermissionService,
    private readonly toast: ToastService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const [paged, trips] = await Promise.all([
        this.api.expensesPage({
          page: this.page,
          size: this.pageSize,
          tripId: this.tripFilter || undefined,
          query: this.query.trim() || undefined
        }),
        this.trips.length ? Promise.resolve(this.trips) : this.tripsApi.getTrips()
      ]);
      this.expenses = paged.items;
      this.page = paged.page;
      this.pageSize = paged.size;
      this.totalElements = paged.totalElements;
      this.totalPages = paged.totalPages;
      this.totalExpensesAmount = Number(paged.totalAmount ?? 0);
      this.trips = trips;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Expenses could not be loaded.';
    } finally {
      this.loading = false;
    }
  }

  get rangeStart(): number {
    return this.totalElements === 0 ? 0 : this.page * this.pageSize + 1;
  }

  get rangeEnd(): number {
    return Math.min((this.page + 1) * this.pageSize, this.totalElements);
  }

  async applyFilters(): Promise<void> {
    this.page = 0;
    await this.load();
  }

  async setPage(target: number): Promise<void> {
    this.page = target;
    await this.load();
  }

  async changePageSize(size: number): Promise<void> {
    this.pageSize = Number(size) || 10;
    this.page = 0;
    await this.load();
  }

  get totalAmount(): number {
    return this.totalExpensesAmount;
  }

  openCreate(): void {
    if (!this.permissions.can('expenses', 'create')) return;
    this.editingId = '';
    this.form = this.newForm();
    this.formOpen = true;
    this.error = '';
  }

  edit(expense: ExpenseRecord): void {
    if (!this.permissions.can('expenses', 'update')) return;
    const id = String(expense['id'] ?? '');
    if (!id) {
      this.toast.error('This expense is missing its ID and cannot be edited.');
      return;
    }
    this.editingId = id;
    this.form = {
      tripId: Number(expense['tripId']) || null,
      category: String(expense['category'] ?? 'OTHER'),
      amount: this.amount(expense),
      expenseDate: String(expense['expenseDate'] ?? '').slice(0, 10),
      note: String(expense['note'] ?? '')
    };
    this.formOpen = true;
    this.error = '';
  }

  closeForm(): void {
    if (this.saving) return;
    this.formOpen = false;
    this.editingId = '';
    this.form = this.newForm();
  }

  async save(): Promise<void> {
    const allowed = this.editingId
      ? this.permissions.can('expenses', 'update')
      : this.permissions.can('expenses', 'create');
    if (!allowed || this.saving) return;
    const amount = Number(this.form.amount);
    if (!this.form.category.trim() || !Number.isFinite(amount) || amount <= 0 ||
      !/^\\d{4}-\\d{2}-\\d{2}$/.test(this.form.expenseDate)) {
      this.error = 'Select a category, enter a positive amount, and choose a valid expense date.';
      return;
    }

    this.saving = true;
    this.error = '';
    const input: ExpenseRecord = {
      ...(this.editingId ? { id: Number(this.editingId) } : {}),
      ...(this.form.tripId ? { tripId: this.form.tripId } : {}),
      category: this.form.category.trim(),
      amount: Math.round(amount * 100) / 100,
      expenseDate: this.form.expenseDate,
      note: this.form.note.trim(),
      isActive: true,
      isDeleted: false
    };

    try {
      if (this.editingId) {
        await this.api.updateExpense(this.editingId, input);
        this.toast.success('Expense updated successfully.');
      } else {
        await this.api.createExpense(input);
        this.toast.success('Expense created successfully.');
      }
      this.formOpen = false;
      this.editingId = '';
      this.form = this.newForm();
      await this.load();
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Expense could not be saved.');
    } finally {
      this.saving = false;
    }
  }

  async remove(expense: ExpenseRecord): Promise<void> {
    if (!this.permissions.can('expenses', 'delete') || this.saving) return;
    const id = String(expense['id'] ?? '');
    if (!id) {
      this.toast.error('This expense is missing its ID and cannot be deleted.');
      return;
    }
    if (!window.confirm('Delete this expense? This removes the expense record.')) return;
    this.saving = true;
    try {
      await this.api.deleteExpense(id);
      this.expenses = this.expenses.filter(row => String(row['id'] ?? '') !== id);
      if (this.editingId === id) {
        this.formOpen = false;
        this.editingId = '';
        this.form = this.newForm();
      }
      this.toast.success('Expense deleted successfully.');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Expense could not be deleted.');
    } finally {
      this.saving = false;
    }
  }

  tripFor(expense: ExpenseRecord): TripRecord | undefined {
    return this.trips.find(trip => String(trip['_demoId']) === String(expense['tripId'] ?? ''));
  }

  tripLabel(expense: ExpenseRecord): string {
    const trip = this.tripFor(expense);
    return trip ? String(trip['tripNumber'] ?? trip['_demoId']) : (expense['tripId'] ? String(expense['tripId']) : 'General');
  }

  amount(expense: ExpenseRecord): number {
    const value = Number(expense['amount'] ?? 0);
    return Number.isFinite(value) ? value : 0;
  }

  categoryLabel(value: unknown): string {
    return String(value ?? '').replace(/_/g, ' ').toLowerCase().replace(/\\b\\w/g, letter => letter.toUpperCase());
  }

  private newForm(): ExpenseForm {
    return {
      tripId: null,
      category: 'TRANSPORT',
      amount: 0,
      expenseDate: new Date().toISOString().slice(0, 10),
      note: ''
    };
  }
}
