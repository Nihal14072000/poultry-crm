import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { ColDef } from 'ag-grid-community';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DataGridComponent } from '../../../common/components/data-grid/data-grid.component';
import { FarmOperationsData, FarmOperationsService } from '../../../common/services/farm-operations.service';
import { DirectoryService } from '../../../common/services/directory.service';
import { RolePermissionService } from '../../../common/services/role-permission.service';
import { catchError, forkJoin, of } from 'rxjs';

type ActivityTab = 'daily' | 'transactions' | 'health' | 'medication' | 'feed' | 'sales' | 'expenses' | 'documents' | 'audit';

function localDateString(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

@Component({
  selector: 'app-batch-360',
  standalone: true,
  imports: [CommonModule, DataGridComponent, FormsModule, NgSelectModule, RouterLink],
  templateUrl: './batch-360.component.html',
  styleUrl: './batch-360.component.css'
})
export class Batch360Component implements OnInit {
  batch?: Record<string, string | number>;
  data?: FarmOperationsData;
  related: Record<string, Record<string, string | number>[]> = {};
  loading = true;
  saving = false;
  error = '';
  feedback = '';
  transactionError = '';
  transactionType = 'Mortality';
  transactionQuantity: number | null = null;
  transactionDate = localDateString();
  readonly todayDate = localDateString();
  transactionNotes = '';
  relatedLoadErrors: string[] = [];
  activeTab: ActivityTab = 'daily';
  readonly tabs: { id: ActivityTab; label: string; resource: string }[] = [
    { id: 'daily', label: 'Daily records', resource: 'daily-operations' },
    { id: 'transactions', label: 'Bird movements', resource: 'batch-transactions' },
    { id: 'health', label: 'Health', resource: 'health' },
    { id: 'medication', label: 'Medication', resource: 'medication' },
    { id: 'feed', label: 'Feed', resource: 'feed' },
    { id: 'sales', label: 'Sales', resource: 'sales' },
    { id: 'expenses', label: 'Expenses', resource: 'expenses' },
    { id: 'documents', label: 'Documents', resource: 'documents' },
    { id: 'audit', label: 'Audit', resource: 'audit' }
  ];
  readonly transactionTypes = ['Mortality', 'Culling', 'Sale / lifting', 'Transfer out', 'Adjustment out'];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly operations: FarmOperationsService,
    private readonly directories: DirectoryService,
    private readonly rolePermissions: RolePermissionService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => this.load(params.get('batchId') ?? ''));
  }

  get farmCode(): string {
    return String(this.data?.farms.find((farm) => farm['name'] === this.batch?.['farm'])?.['code'] ?? '');
  }

  get canRecordMovement(): boolean {
    return !!this.batch && this.rolePermissions.can('daily-operations', 'create') &&
      this.operations.occupiesCapacity(this.batch) && this.operations.numberValue(this.batch['birds']) > 0;
  }

  get activeTabLabel(): string {
    return this.tabs.find((tab) => tab.id === this.activeTab)?.label.toLowerCase() ?? 'records';
  }

  private load(batchId: string): void {
    this.loading = true;
    this.error = '';
    this.operations.loadData().subscribe({
      next: (data) => {
        this.data = data;
        this.batch = data.batches.find((record) => record['batch'] === batchId || record['_demoId'] === batchId);
        if (!this.batch || !this.rolePermissions.canAccessRecord('batches', this.batch)) {
          this.error = !this.batch ? `Batch "${batchId}" was not found.` : 'This batch is outside your assigned organization scope.';
          this.loading = false;
          return;
        }
        this.loadRelated();
      },
      error: () => {
        this.error = 'Batch records could not be loaded. Refresh the page to try again.';
        this.loading = false;
      }
    });
  }

  private loadRelated(): void {
    const resources = this.tabs.map((tab) => tab.resource).filter((resource) => resource !== 'daily-operations' && resource !== 'batch-transactions');
    this.relatedLoadErrors = [];
    forkJoin(resources.map((resource) => this.directories.getDirectory(resource).pipe(
      catchError(() => {
        this.relatedLoadErrors.push(resource);
        return of({ records: [] as Record<string, string | number>[] });
      })
    ))).subscribe({
      next: (responses) => {
        this.related = Object.fromEntries(resources.map((resource, index) => [resource, responses[index].records]));
        this.loading = false;
      },
      error: () => {
        this.error = 'Some batch-related records could not be loaded.';
        this.loading = false;
      }
    });
  }

  get dailyRecords(): Record<string, string | number>[] {
    return this.data?.dailyRecords.filter((record) => record['batch'] === this.batch?.['batch']) ?? [];
  }

  get transactions(): Record<string, string | number>[] {
    return this.data?.transactions.filter((record) => record['batch'] === this.batch?.['batch']) ?? [];
  }

  get alerts(): string[] {
    return this.batch && this.data ? this.operations.getBatchAlerts(this.batch, this.dailyRecords, this.transactions) : [];
  }

  get livability(): number {
    const initial = this.operations.numberValue(this.batch?.['initialBirds'] ?? this.batch?.['birds']);
    const current = this.operations.numberValue(this.batch?.['birds']);
    return initial ? current / initial * 100 : 0;
  }

  get mortalityRate(): number {
    const initial = this.operations.numberValue(this.batch?.['initialBirds'] ?? this.batch?.['birds']);
    const mortality = this.operations.batchMortalityCount(this.dailyRecords, this.transactions);
    return initial ? mortality / initial * 100 : 0;
  }

  get latestDaily(): Record<string, string | number> | undefined {
    return [...this.dailyRecords].sort((left, right) => String(right['date'] ?? '').localeCompare(String(left['date'] ?? '')))[0];
  }

  get tabRecords(): Record<string, string | number>[] {
    if (this.activeTab === 'daily') return this.dailyRecords;
    if (this.activeTab === 'transactions') return this.transactions;
    const resource = this.tabs.find((tab) => tab.id === this.activeTab)?.resource ?? '';
    return (this.related[resource] ?? []).filter((record) => record['batch'] === this.batch?.['batch']);
  }

  get tabGridRows(): object[] {
    return this.tabRecords.map((record) => Object.fromEntries(
      this.recordKeys(record).map((key) => [key, this.recordValue(record, key)])
    ));
  }

  get tabGridColumns(): ColDef[] {
    const first = this.tabRecords[0];
    return first ? this.recordKeys(first).map((key) => ({ field: key, headerName: key })) : [];
  }

  recordTransaction(): void {
    this.transactionError = '';
    this.feedback = '';
    if (!this.batch || !this.data || this.saving) return;
    if (!this.transactionDate || !this.transactionQuantity || !Number.isInteger(Number(this.transactionQuantity))) {
      this.transactionError = 'Enter a date and a positive whole-number bird count.';
      return;
    }
    this.saving = true;
    this.operations.recordBatchTransaction(
      this.batch,
      this.transactionType,
      Number(this.transactionQuantity),
      this.transactionDate,
      this.transactionNotes.trim()
    ).subscribe({
      next: (updated) => {
        this.batch = updated;
        this.feedback = `${this.transactionType} movement recorded. Current flock count: ${this.operations.numberValue(updated['birds']).toLocaleString()}.`;
        this.transactionQuantity = null;
        this.transactionNotes = '';
        this.saving = false;
        this.load(this.route.snapshot.paramMap.get('batchId') ?? '');
      },
      error: (error: unknown) => {
        this.transactionError = error instanceof Error
          ? `Movement may be partially saved: ${error.message} Review the ledger and current batch count before retrying.`
          : 'Movement may be partially saved. Review the ledger and current batch count before retrying.';
        this.saving = false;
      }
    });
  }

  activateTab(tab: ActivityTab): void {
    this.activeTab = tab;
  }

  recordValue(record: Record<string, string | number>, key: string): string {
    const value = record[key];
    return value === undefined || value === '' ? '—' : String(value);
  }

  recordKeys(record: Record<string, string | number>): string[] {
    return Object.keys(record).filter((key) => !key.startsWith('_'));
  }
}
