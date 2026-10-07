import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { DirectoryService } from '../../services/directory.service';
import { DirectoryColumn } from '../../models/directory.model';
import { ModuleWorkflowService } from '../../services/module-workflow.service';
import { WorkflowAction } from '../../models/workflow.model';
import { FarmOperationsData, FarmOperationsService } from '../../services/farm-operations.service';
import { PermissionAction } from '../../models/auth.model';
import { RolePermissionService } from '../../services/role-permission.service';

@Component({
  selector: 'app-workspace-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './workspace-page.component.html',
  styleUrl: './workspace-page.component.css'
})
export class WorkspacePageComponent implements OnInit {
  title = '';
  description = '';
  resource = '';
  columns: DirectoryColumn[] = [];
  records: Record<string, string | number>[] = [];
  query = '';
  statusFilter = 'All statuses';
  loading = true;
  errorMessage = '';
  mode: 'editable' | 'append-only' | 'read-only' = 'editable';
  actionError = '';
  successMessage = '';
  validationAttempted = false;
  editorOpen = false;
  editorMode: 'create' | 'edit' = 'create';
  editorRecord: Record<string, string | number> = {};
  fieldSuggestions: Record<string, string[]> = {};
  editingId = '';
  deleteCandidate?: Record<string, string | number>;
  saving = false;
  sortKey = '';
  sortDescending = false;
  currentPage = 1;
  readonly pageSize = 10;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly directories: DirectoryService,
    private readonly workflows: ModuleWorkflowService,
    private readonly farmOperations: FarmOperationsService,
    private readonly rolePermissions: RolePermissionService
  ) {}

  ngOnInit(): void {
    this.route.data.pipe(
      map((data) => ({
        title: data['title'] as string,
        description: data['description'] as string,
        resource: data['resource'] as string,
        columns: data['columns'] as DirectoryColumn[],
        mode: (data['mode'] as 'editable' | 'append-only' | 'read-only' | undefined) ?? 'editable'
      })),
      distinctUntilChanged((previous, current) => previous.resource === current.resource),
      switchMap((config) => {
        this.title = config.title;
        this.description = config.description;
        this.resource = config.resource;
        this.columns = config.columns;
        this.mode = config.mode;
        this.fieldSuggestions = {};
        this.successMessage = '';
        this.actionError = '';
        this.currentPage = 1;
        this.query = '';
        this.statusFilter = 'All statuses';
        this.sortKey = '';
        this.sortDescending = false;
        this.loading = true;
        this.errorMessage = '';
        return this.loadDirectory(config.resource);
      })
    ).subscribe({
      next: (response) => {
        this.records = this.visibleRecords(response.records);
        this.loading = false;
      },
      error: () => {
        this.errorMessage = `We could not load ${this.title.toLowerCase()}. Please refresh to try again.`;
        this.loading = false;
      }
    });
  }

  get hasModuleWorkflow(): boolean {
    return this.workflows.getStatuses(this.resource).length > 0;
  }

  can(action: PermissionAction): boolean {
    return this.rolePermissions.can(this.resource, action);
  }

  refresh(): void {
    this.loading = true;
    this.loadDirectory(this.resource).subscribe({
      next: (response) => {
        this.records = this.visibleRecords(response.records);
        this.loading = false;
      },
      error: () => {
        this.errorMessage = `We could not load ${this.title.toLowerCase()}. Please refresh to try again.`;
        this.loading = false;
      }
    });
  }

  openCreate(): void {
    if (this.mode === 'read-only' || !this.can('create')) return;
    this.editorMode = 'create';
    this.editorRecord = Object.fromEntries(this.columns.map((column) => [column.key, '']));
    this.fieldSuggestions = Object.fromEntries(this.columns.map((column) => [column.key, this.buildSuggestions(column.key)]));
    this.editingId = '';
    this.actionError = '';
    this.successMessage = '';
    this.validationAttempted = false;
    this.editorOpen = true;
  }

  openEdit(record: Record<string, string | number>): void {
    if (this.mode !== 'editable' || !this.can('update')) return;
    this.editorMode = 'edit';
    this.editorRecord = { ...record };
    if (this.resource === 'batches' && this.editorRecord['initialBirds'] === undefined) {
      this.editorRecord['initialBirds'] = record['birds'] ?? 0;
    }
    this.editingId = String(record['_demoId'] ?? '');
    this.actionError = '';
    this.successMessage = '';
    this.validationAttempted = false;
    this.editorOpen = true;
  }

  closeEditor(): void {
    if (this.saving) return;
    this.editorOpen = false;
    this.actionError = '';
  }

  fieldInputType(key: string): string {
    const current = this.editorRecord[key];
    if (this.isDateField(key) && (current === undefined || String(current).trim() === '' ||
      (typeof current === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(current)))) return 'date';
    if (this.editorMode === 'edit' && current !== undefined) {
      return typeof current === 'number' ? 'number' : 'text';
    }
    if (/email/i.test(key)) return 'email';
    if (/phone|mobile/i.test(key)) return 'tel';
    if (this.isDateField(key)) return 'date';
    return this.isNumericField(key) ? 'number' : 'text';
  }

  percentageMax(key: string): number | null {
    return /(humidity|fertility|hatchability|production|margin|mortality|livability|percentage|rate)$/i.test(key) ? 100 : null;
  }

  minimumValue(key: string): number | null {
    if (/temperature/i.test(key) || (this.resource === 'stock-ledger' && key === 'quantity')) return null;
    return this.isNumericField(key) ? 0 : null;
  }

  private isNumericField(key: string): boolean {
    if (key === 'items') return ['orders', 'sales'].includes(this.resource);
    return /(quantity|birds|females|males|capacity|eggs|amount|balance|profit|costs|revenue|margin|weight|fcr|feed|water|humidity|temperature|production|fertility|hatchability|variance|orders|sheds|onHand|opening|closing|mortality|culling|rate|price|total|paid|credit|limit|count|stock|available|planned|consumed|dosage|salary|distance|cost|value)/i.test(key);
  }

  statusOptions(): string[] {
    if (this.editorMode === 'create') {
      const initialStatuses = this.workflows.getInitialStatuses(this.resource);
      if (initialStatuses.length) return initialStatuses;
    }
    const current = this.statuses.filter((status) => status !== 'All statuses');
    const workflowStatuses = this.workflows.getStatuses(this.resource);
    return [...new Set([...workflowStatuses, ...current])].length
      ? [...new Set([...workflowStatuses, ...current])]
      : ['Active', 'Pending', 'Complete', 'Cancelled'];
  }

  get editorValid(): boolean {
    return this.columns.every((column) => this.fieldError(column.key) === '');
  }

  fieldError(key: string): string {
    const value = String(this.editorRecord[key] ?? '').trim();
    if (!value) {
      const original = this.records.find((record) => record['_demoId'] === this.editingId);
      return this.isOptionalField(key) || (this.editorMode === 'edit' && original?.[key] === undefined)
        ? ''
        : 'This field is required.';
    }
    if (/email/i.test(key) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address.';
    if (/phone|mobile/i.test(key)) {
      const digits = value.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) return 'Enter a valid phone number.';
    }
    if (this.isNumericField(key)) {
      const normalized = value.replace(/[−–]/g, '-').replace(/[$,%\s,]/g, '').replace(/[a-z]+$/i, '');
      const parsed = Number(normalized);
      if (!normalized || !Number.isFinite(parsed)) return 'Enter a valid number.';
      if (/(birds|capacity|occupancy|count|sheds)$/i.test(key) && !Number.isInteger(parsed)) return 'Enter a whole number.';
      const allowsNegative = /temperature/i.test(key) || (this.resource === 'stock-ledger' && key === 'quantity');
      if (parsed < 0 && !allowsNegative) return 'Value cannot be negative.';
      if (this.resource === 'stock-ledger' && key === 'quantity' && parsed === 0) return 'Movement quantity cannot be zero.';
      if (this.percentageMax(key) !== null && (parsed < 0 || parsed > 100)) {
        return 'Enter a percentage between 0 and 100.';
      }
      if (/(amount|price|total|cost|revenue)$/i.test(key) && parsed <= 0) return 'Enter an amount greater than zero.';
    }
    if (this.isDateField(key) && Number.isNaN(Date.parse(value.replace(/\s*·\s*/, ' ')))) return 'Enter a valid date.';
    if (this.isUniqueField(key) && this.isDuplicateValue(key, value)) return 'This value is already used by another record.';
    if (value.length > this.maxFieldLength(key)) return `Use ${this.maxFieldLength(key)} characters or fewer.`;
    return '';
  }

  showFieldError(key: string): boolean {
    return this.validationAttempted && !!this.fieldError(key);
  }

  workflowActions(record: Record<string, string | number>): WorkflowAction[] {
    if (this.mode === 'read-only' || this.mode === 'append-only') return [];
    return this.workflows.getActions(this.resource, record);
  }

  runWorkflowAction(record: Record<string, string | number>, action: WorkflowAction): void {
    const id = String(record['_demoId'] ?? '');
    if (!id || this.saving || this.mode !== 'editable' || !this.can('transition')) return;
    this.saving = true;
    this.actionError = '';
    this.successMessage = '';
    if (this.resource === 'vehicles' && action.nextStatus === 'Sold') {
      const requiredSaleDetails = ['saleDate', 'salePrice', 'soldTo'];
      if (requiredSaleDetails.some((key) => !String(record[key] ?? '').trim())) {
        this.actionError = 'Add the sale date, sale price, and buyer to the vehicle record before recording its sale.';
        this.saving = false;
        return;
      }
      this.directories.getDirectory('vehicle-assignments').subscribe({
        next: (response) => {
          if (response.records.some((assignment) =>
            assignment['vehicleId'] === id && assignment['status'] === 'Assigned'
          )) {
            this.actionError = 'Return this vehicle from its current driver before recording the sale.';
            this.saving = false;
            return;
          }
          this.directories.updateRecord(this.resource, id, { ...record, status: action.nextStatus }).subscribe({
            next: (updated) => this.finishWorkflowAction(record, updated, action),
            error: () => this.failWorkflowAction(action)
          });
        },
        error: () => {
          this.actionError = 'Could not verify vehicle assignments. The vehicle sale was not recorded.';
          this.saving = false;
        }
      });
      return;
    }
    if (this.resource !== 'batches') {
      this.directories.updateRecord(this.resource, id, { ...record, status: action.nextStatus }).subscribe({
        next: (updated) => this.finishWorkflowAction(record, updated, action),
        error: () => this.failWorkflowAction(action)
      });
      return;
    }

    if (['closed', 'completed', 'cancelled'].includes(action.nextStatus.toLowerCase()) && Number(record['birds'] ?? 0) > 0) {
      this.actionError = 'Record a sale, lifting, or other bird-out movement before closing or cancelling this batch.';
      this.saving = false;
      return;
    }
    this.farmOperations.loadData().subscribe({
      next: (data) => {
        if (action.nextStatus === 'Partially sold' && !data.transactions.some((transaction) =>
          transaction['batch'] === record['batch'] && transaction['type'] === 'Sale / lifting'
        )) {
          this.actionError = 'Record a sale/lifting bird movement before marking this batch partially sold.';
          this.saving = false;
          return;
        }
        const nextRecord: Record<string, string | number> = { ...record, status: action.nextStatus };
        if (action.label === 'Place flock') {
          const farm = data.farms.find((item) => item['name'] === record['farm']);
          const shed = data.sheds.find((item) => item['farm'] === record['farm'] && item['name'] === record['shed']);
          if (!farm || String(farm['status'] ?? '').toLowerCase() !== 'active' ||
            !shed || (shed['status'] && String(shed['status']).toLowerCase() !== 'active')) {
            this.actionError = 'The selected farm and shed must be active before placing this flock.';
            this.saving = false;
            return;
          }
          nextRecord['birds'] = Number(record['initialBirds'] ?? record['placementQuantity'] ?? record['birds'] ?? 0);
          if (!nextRecord['placementDate']) nextRecord['placementDate'] = new Date().toISOString().slice(0, 10);
        }
        this.directories.updateRecord('batches', id, nextRecord).subscribe({
          next: (updated) => this.farmOperations.applyBatchOccupancyChange(record, updated, data).subscribe({
            next: () => this.finishWorkflowAction(record, updated, action),
            error: () => {
              this.records = this.records.map((existing) => existing['_demoId'] === id ? updated : existing);
              this.actionError = 'Batch status changed, but farm/shed occupancy could not be synchronized. Refresh and reconcile capacity counts.';
              this.saving = false;
            }
          }),
          error: () => this.failWorkflowAction(action)
        });
      },
      error: () => {
        this.actionError = 'Could not load capacity data. The batch status was not changed.';
        this.saving = false;
      }
    });
  }

  private finishWorkflowAction(
    previous: Record<string, string | number>,
    updated: Record<string, string | number>,
    action: WorkflowAction
  ): void {
    this.records = this.records.map((existing) => existing['_demoId'] === previous['_demoId'] ? updated : existing);
    this.successMessage = `${action.label} completed. Status is now ${action.nextStatus}.`;
    this.saving = false;
  }

  private failWorkflowAction(action: WorkflowAction): void {
    this.actionError = `Could not ${action.label.toLowerCase()}. The record was not changed.`;
    this.saving = false;
  }

  private isOptionalField(key: string): boolean {
    if (this.resource === 'employees' && ['licenseNo', 'licenseDueDate'].includes(key)) {
      const isDriver = String(this.editorRecord['department'] ?? '').trim().toLowerCase() === 'driver' ||
        String(this.editorRecord['designation'] ?? '').trim().toLowerCase() === 'driver';
      return !isDriver;
    }
    return /(notes?|comments?|remark|email|assignedTo|breed|saleDate|salePrice|soldTo)/i.test(key);
  }

  private isDateField(key: string): boolean {
    return /(date|scheduled|reported|issued|joined|closeDate|validUntil|due)$/i.test(key);
  }

  private isUniqueField(key: string): boolean {
    return this.workflows.getUniqueFields(this.resource).includes(key);
  }

  private isDuplicateValue(key: string, value: string): boolean {
    return this.records.some((record) =>
      record['_demoId'] !== this.editingId &&
      String(record[key] ?? '').trim().toLocaleLowerCase() === value.toLocaleLowerCase()
    );
  }

  private maxFieldLength(key: string): number {
    return /(notes?|description|comments?|remark|address)/i.test(key) ? 500 : 120;
  }

  get recordValidationError(): string {
    const source = String(this.editorRecord['from'] ?? '').trim();
    const destination = String(this.editorRecord['to'] ?? '').trim();
    if (this.resource === 'transfers' && source && destination && source.toLocaleLowerCase() === destination.toLocaleLowerCase()) {
      return 'Choose different source and destination locations.';
    }
    if (this.resource === 'vehicles' && String(this.editorRecord['status'] ?? '').toLowerCase() === 'sold' &&
      ['saleDate', 'salePrice', 'soldTo'].some((key) => !String(this.editorRecord[key] ?? '').trim())) {
      return 'Enter the sale date, sale price, and buyer for a sold vehicle.';
    }
    if (this.resource === 'batches') {
      const initial = Number(this.editorRecord['initialBirds'] ?? this.editorRecord['placementQuantity']);
      const current = Number(this.editorRecord['birds'] ?? this.editorRecord['currentBirds']);
      if (Number.isFinite(initial) && Number.isFinite(current) && current > initial) return 'Current birds cannot exceed the initial placement quantity.';
      if (Number.isFinite(initial) && (!Number.isInteger(initial) || initial <= 0)) return 'Initial placement must be a positive whole number.';
      if (Number.isFinite(current) && (!Number.isInteger(current) || current < 0)) return 'Current birds must be a whole number and cannot be negative.';
    }
    if (this.resource === 'farms' && Number(this.editorRecord['birds']) > Number(this.editorRecord['capacity'])) {
      return 'Farm capacity cannot be lower than its current bird occupancy.';
    }
    if (this.resource === 'sheds' && Number(this.editorRecord['occupancy']) > Number(this.editorRecord['capacity'])) {
      return 'Shed capacity cannot be lower than its current occupancy.';
    }
    return '';
  }

  detailPath(record: Record<string, string | number>): string[] | null {
    if (this.resource === 'farms' && record['code']) return ['/farm-operations/farms', String(record['code'])];
    if (this.resource === 'batches' && record['batch']) return ['/farm-operations/batches', String(record['batch'])];
    return null;
  }

  get hasSuggestions(): boolean {
    return this.columns.some((column) => column.key !== 'status' && this.suggestionsFor(column.key).length > 0);
  }

  suggestionsFor(key: string): string[] {
    return this.fieldSuggestions[key] ?? [];
  }

  private buildSuggestions(key: string): string[] {
    const suggestions = new Map<string, string>();
    for (const record of this.records) {
      const value = String(record[key] ?? '').trim();
      if (value && !suggestions.has(value.toLocaleLowerCase())) {
        suggestions.set(value.toLocaleLowerCase(), value);
      }
    }
    return [...suggestions.values()];
  }

  suggestionsId(key: string): string {
    return `record-suggestions-${this.resource}-${key}`;
  }

  saveRecord(): void {
    this.validationAttempted = true;
    const requiredAction = this.editorMode === 'create' ? 'create' : 'update';
    if (this.mode === 'read-only' || (this.mode === 'append-only' && this.editorMode !== 'create') ||
      !this.can(requiredAction) || !this.editorValid || this.recordValidationError || this.saving) return;
    this.saving = true;
    this.actionError = '';
    this.successMessage = '';
    const record = { ...this.editorRecord };
    for (const column of this.columns) {
      if (this.fieldInputType(column.key) === 'number' && String(record[column.key] ?? '').trim()) {
        record[column.key] = Number(record[column.key]);
      }
    }
    const creating = this.editorMode === 'create';
    const previous = this.records.find((existing) => existing['_demoId'] === this.editingId);
    if (['batches', 'farms', 'sheds'].includes(this.resource)) {
      this.farmOperations.loadData().subscribe({
        next: (data) => {
          const masterError = this.masterDataChangeError(record, previous, data);
          if (masterError) {
            this.actionError = masterError;
            this.saving = false;
            return;
          }
          if (this.resource === 'batches') {
            const capacity = this.farmOperations.validateBatchPlacement(record, previous, data);
            if (!capacity.valid) {
              this.actionError = capacity.message;
              this.saving = false;
              return;
            }
          }
          this.persistRecord(record, creating, previous, this.resource === 'batches' ? data : undefined);
        },
        error: () => {
          this.actionError = 'Farm, shed, and batch references could not be checked. The record was not saved.';
          this.saving = false;
        }
      });
      return;
    }
    this.persistRecord(record, creating, previous);
  }

  private persistRecord(
    record: Record<string, string | number>,
    creating: boolean,
    previous?: Record<string, string | number>,
    data?: FarmOperationsData
  ): void {
    if (!this.rolePermissions.canAccessRecord(this.resource, record)) {
      this.actionError = 'The record is outside your assigned organization scope.';
      this.saving = false;
      return;
    }
    const mutation = creating
      ? this.directories.createRecord(this.resource, record)
      : this.directories.updateRecord(this.resource, this.editingId, record);
    mutation.subscribe({
      next: (saved) => {
        if (creating) this.records = [...this.records, saved];
        else this.records = this.records.map((existing) => existing['_demoId'] === this.editingId ? saved : existing);
        const complete = () => {
          this.currentPage = this.pageCount;
          this.successMessage = creating ? 'Record created successfully.' : 'Changes saved successfully.';
          this.editorOpen = false;
          this.saving = false;
        };
        if (data && this.resource === 'batches') {
          this.farmOperations.applyBatchOccupancyChange(previous, saved, data).subscribe({
            next: complete,
            error: () => {
              this.actionError = 'The batch was saved, but farm/shed occupancy could not be synchronized. Refresh and reconcile capacity counts.';
              this.editorOpen = false;
              this.saving = false;
            }
          });
          return;
        }
        complete();
      },
      error: () => {
        this.actionError = 'The record could not be saved. Your existing data has not been changed.';
        this.saving = false;
      }
    });
  }

  requestDelete(record: Record<string, string | number>): void {
    if (this.mode !== 'editable' || !this.can('delete')) return;
    this.deleteCandidate = record;
    this.actionError = '';
    this.successMessage = '';
  }

  cancelDelete(): void {
    this.deleteCandidate = undefined;
    this.actionError = '';
  }

  deleteRecord(): void {
    const candidate = this.deleteCandidate;
    const id = String(candidate?.['_demoId'] ?? '');
    if (!candidate || !id || !this.can('delete')) return;
    if (['vehicles', 'employees'].includes(this.resource)) {
      this.saving = true;
      this.directories.getDirectory('vehicle-assignments').subscribe({
        next: (response) => {
          const isReferenced = response.records.some((assignment) =>
            this.resource === 'vehicles'
              ? assignment['vehicleId'] === id
              : (assignment['employeeId'] ?? assignment['driverId']) === id
          );
          if (isReferenced) {
            this.actionError = 'This record has assignment history and cannot be deleted. Keep it to preserve the fleet history.';
            this.saving = false;
            return;
          }
          this.removeRecord(id);
        },
        error: () => {
          this.actionError = 'Could not verify vehicle assignment history. Nothing was deleted.';
          this.saving = false;
        }
      });
      return;
    }
    if (['farms', 'sheds', 'batches'].includes(this.resource)) {
      this.saving = true;
      this.farmOperations.loadData().subscribe({
        next: (data) => {
          const name = String(candidate['name'] ?? '');
          const farm = name;
          if (this.resource === 'farms' && (
            data.sheds.some((shed) => shed['farm'] === farm) ||
            data.batches.some((batch) => batch['farm'] === farm) ||
            Number(candidate['birds'] ?? 0) > 0
          )) {
            this.actionError = 'This farm is still in use. Remove its batches and sheds, and clear bird occupancy before deleting it.';
            this.saving = false;
            return;
          }
          if (this.resource === 'sheds' && (
            data.batches.some((batch) => batch['farm'] === candidate['farm'] && batch['shed'] === name) ||
            Number(candidate['occupancy'] ?? 0) > 0
          )) {
            this.actionError = 'This shed is still in use. Remove its batches and clear bird occupancy before deleting it.';
            this.saving = false;
            return;
          }
          if (this.resource === 'batches' && Number(candidate['birds'] ?? 0) > 0) {
            this.actionError = 'A batch with live birds cannot be deleted. Record the bird movements and close it first.';
            this.saving = false;
            return;
          }
          if (this.resource === 'batches' && (
            data.transactions.some((transaction) => transaction['batch'] === candidate['batch']) ||
            data.dailyRecords.some((daily) => daily['batch'] === candidate['batch'])
          )) {
            this.actionError = 'This batch has operational history and cannot be deleted. Close it to preserve the audit trail.';
            this.saving = false;
            return;
          }
          this.removeRecord(id);
        },
        error: () => {
          this.actionError = 'Could not verify farm capacity and dependent records. Nothing was deleted.';
          this.saving = false;
        }
      });
      return;
    }
    this.removeRecord(id);
  }

  private removeRecord(id: string): void {
    this.saving = true;
    this.directories.deleteRecord(this.resource, id).subscribe({
      next: () => {
        this.records = this.records.filter((record) => record['_demoId'] !== id);
        this.currentPage = Math.min(this.currentPage, this.pageCount);
        this.deleteCandidate = undefined;
        this.successMessage = 'Record removed successfully.';
        this.saving = false;
      },
      error: () => {
        this.actionError = 'The record could not be removed. Please try again.';
        this.saving = false;
      }
    });
  }

  private masterDataChangeError(
    next: Record<string, string | number>,
    previous: Record<string, string | number> | undefined,
    data: FarmOperationsData
  ): string {
    if (this.resource === 'sheds' && !data.farms.some((farm) => farm['name'] === next['farm'])) {
      return 'Choose an existing farm for this shed.';
    }
    if (!previous || this.resource === 'batches') return '';
    if (this.resource === 'farms' && previous['name'] !== next['name'] && (
      data.sheds.some((shed) => shed['farm'] === previous['name']) ||
      data.batches.some((batch) => batch['farm'] === previous['name'])
    )) return 'Farm name cannot be changed while sheds or batches reference it.';
    if (this.resource === 'farms') {
      const plannedBirds = data.batches
        .filter((batch) => batch['farm'] === next['name'] && String(batch['status'] ?? '').toLowerCase() === 'planned')
        .reduce((total, batch) => total + this.farmOperations.numberValue(batch['initialBirds'] ?? batch['placementQuantity'] ?? batch['birds']), 0);
      if (Number(next['capacity'] ?? 0) < Number(next['birds'] ?? 0) + plannedBirds) {
        return 'Farm capacity cannot be lower than live occupancy plus planned flock reservations.';
      }
    }
    if (this.resource === 'sheds' && (previous['name'] !== next['name'] || previous['farm'] !== next['farm']) &&
      data.batches.some((batch) => batch['farm'] === previous['farm'] && batch['shed'] === previous['name'])
    ) return 'Shed farm or name cannot be changed while a batch references it.';
    if (this.resource === 'sheds') {
      const plannedBirds = data.batches
        .filter((batch) => batch['farm'] === next['farm'] && batch['shed'] === next['name'] && String(batch['status'] ?? '').toLowerCase() === 'planned')
        .reduce((total, batch) => total + this.farmOperations.numberValue(batch['initialBirds'] ?? batch['placementQuantity'] ?? batch['birds']), 0);
      if (Number(next['capacity'] ?? 0) < Number(next['occupancy'] ?? 0) + plannedBirds) {
        return 'Shed capacity cannot be lower than current occupancy plus planned flock reservations.';
      }
    }
    return '';
  }

  private loadDirectory(resource: string) {
    return this.directories.getDirectory(resource).pipe(
      tap((response) => {
        this.records = this.visibleRecords(response.records);
        this.loading = false;
        this.errorMessage = '';
      }),
      catchError(() => {
        this.errorMessage = `We could not load ${this.title.toLowerCase()}. Please refresh to try again.`;
        this.loading = false;
        return of({ records: [] });
      })
    );
  }

  private visibleRecords(records: Record<string, string | number>[]): Record<string, string | number>[] {
    return records.filter((record) => this.rolePermissions.canAccessRecord(this.resource, record));
  }

  get filteredRecords(): Record<string, string | number>[] {
    const normalizedQuery = this.query.trim().toLowerCase();
    const filtered = this.records.filter((record) => {
      const matchesQuery = !normalizedQuery || Object.values(record).some((value) => String(value).toLowerCase().includes(normalizedQuery));
      const status = String(record['status'] ?? '');
      const matchesStatus = this.statusFilter === 'All statuses' || status === this.statusFilter;
      return matchesQuery && matchesStatus;
    });
    if (this.sortKey) {
      filtered.sort((left, right) => {
        const first = String(left[this.sortKey] ?? '').toLocaleLowerCase();
        const second = String(right[this.sortKey] ?? '').toLocaleLowerCase();
        const result = first.localeCompare(second, undefined, { numeric: true, sensitivity: 'base' });
        return this.sortDescending ? -result : result;
      });
    }
    return filtered;
  }

  get pagedRecords(): Record<string, string | number>[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredRecords.slice(start, start + this.pageSize);
  }

  get pageCount(): number {
    return Math.max(1, Math.ceil(this.filteredRecords.length / this.pageSize));
  }

  toggleSort(key: string): void {
    if (this.sortKey === key) this.sortDescending = !this.sortDescending;
    else {
      this.sortKey = key;
      this.sortDescending = false;
    }
    this.currentPage = 1;
  }

  setQuery(value: string): void {
    this.query = value;
    this.currentPage = 1;
  }

  setStatus(value: string): void {
    this.statusFilter = value;
    this.currentPage = 1;
  }

  previousPage(): void {
    this.currentPage = Math.max(1, this.currentPage - 1);
  }

  nextPage(): void {
    this.currentPage = Math.min(this.pageCount, this.currentPage + 1);
  }

  get statuses(): string[] {
    return ['All statuses', ...new Set(this.records.map((record) => String(record['status'] ?? '')).filter(Boolean))];
  }

  statusClass(value: string | number): string {
    const normalized = String(value).toLowerCase();
    if (['active', 'healthy', 'delivered', 'paid', 'on track', 'closed', 'complete', 'completed', 'approved', 'resolved', 'received', 'recorded', 'posted', 'available', 'accepted'].includes(normalized)) return 'positive';
    if (['low stock', 'watch', 'in transit', 'ordered', 'partially received', 'ready for sale', 'review', 'scheduled', 'pending', 'due soon', 'qualified', 'sent', 'open', 'unread', 'investigating', 'high', 'overdue'].includes(normalized)) return 'warning';
    if (['maintenance', 'on hold', 'expiring soon', 'read', 'cancelled', 'cancelled'].includes(normalized)) return 'muted';
    return 'neutral';
  }
}
