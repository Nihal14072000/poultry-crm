import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DirectoryService } from '../../../common/services/directory.service';
import { DirectoryResponse } from '../../../common/models/directory.model';
import { concatMap, forkJoin, Observable, of } from 'rxjs';
import { FarmOperationsService } from '../../../common/services/farm-operations.service';
import { RolePermissionService } from '../../../common/services/role-permission.service';

@Component({
  selector: 'app-daily-operations',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './daily-operations.component.html',
  styleUrl: './daily-operations.component.css'
})
export class DailyOperationsComponent {
  readonly currentDate = new Date();
  readonly todayDate = this.toDateInput(this.currentDate);
  saved = false;
  saving = false;
  errorMessage = '';
  savedRecords: Record<string, string | number>[] = [];
  farms: Record<string, string | number>[] = [];
  sheds: Record<string, string | number>[] = [];
  batches: Record<string, string | number>[] = [];
  loadingMasterData = true;
  readonly form = this.formBuilder.group({
    farm: ['Greenfield North', Validators.required],
    shed: ['Shed 02', Validators.required],
    batch: ['FW-2412', Validators.required],
    date: [this.todayDate, [Validators.required, (control: AbstractControl) => control.value && control.value > this.todayDate ? { futureDate: true } : null]],
    openingBirds: [4820, [Validators.required, Validators.min(0)]],
    mortality: [12, [Validators.required, Validators.min(0)]],
    culling: [2, [Validators.required, Validators.min(0)]],
    feedConsumed: [612, [Validators.required, Validators.min(0)]],
    previousAverageWeight: [1.55, [Validators.required, Validators.min(0.01)]],
    averageWeight: [1.62, [Validators.required, Validators.min(0.01)]],
    water: [1080, [Validators.required, Validators.min(0)]],
    temperature: [27, [Validators.min(-10), Validators.max(60)]],
    humidity: [62, [Validators.min(0), Validators.max(100)]],
    notes: ['']
  });

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly directories: DirectoryService,
    private readonly farmOperations: FarmOperationsService,
    private readonly rolePermissions: RolePermissionService
  ) {
    this.loadSavedRecords();
    this.loadFarmOptions();
  }

  get closingBirds(): number {
    return Math.max(0, (this.form.controls.openingBirds.value ?? 0) - (this.form.controls.mortality.value ?? 0) - (this.form.controls.culling.value ?? 0));
  }

  get mortalityRate(): number {
    const opening = this.form.controls.openingBirds.value ?? 0;
    return opening ? ((this.form.controls.mortality.value ?? 0) / opening) * 100 : 0;
  }

  get fcr(): number | null {
    const weightGain = ((this.form.controls.averageWeight.value ?? 0) - (this.form.controls.previousAverageWeight.value ?? 0)) * this.closingBirds;
    return weightGain > 0 ? (this.form.controls.feedConsumed.value ?? 0) / weightGain : null;
  }

  get duplicateEntry(): boolean {
    const batch = this.form.controls.batch.value;
    const date = this.form.controls.date.value;
    return this.savedRecords.some((record) => record['batch'] === batch && record['date'] === date);
  }

  get outOfSequenceEntry(): boolean {
    const latest = this.latestSavedBatchEntry;
    const date = this.form.controls.date.value ?? '';
    return !!latest && date < String(latest['date'] ?? '');
  }

  get latestBatchEntry(): Record<string, string | number> | undefined {
    const batch = this.form.controls.batch.value;
    const date = this.form.controls.date.value ?? '';
    return this.savedRecords
      .filter((record) => record['batch'] === batch && String(record['date'] ?? '') < date)
      .sort((left, right) => String(right['date'] ?? '').localeCompare(String(left['date'] ?? '')))[0];
  }

  get latestSavedBatchEntry(): Record<string, string | number> | undefined {
    const batch = this.form.controls.batch.value;
    return this.savedRecords
      .filter((record) => record['batch'] === batch)
      .sort((left, right) => String(right['date'] ?? '').localeCompare(String(left['date'] ?? '')))[0];
  }

  get selectedBatch(): Record<string, string | number> | undefined {
    return this.availableBatches.find((batch) => batch['batch'] === this.form.controls.batch.value);
  }

  get todayLabel(): string {
    return new Intl.DateTimeFormat('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(this.currentDate);
  }

  get entryInvalid(): boolean {
    return !this.rolePermissions.can('daily-operations', 'create') || this.loadingMasterData || this.form.invalid || this.birdCountInvalid || (this.form.controls.mortality.value ?? 0) + (this.form.controls.culling.value ?? 0) > (this.form.controls.openingBirds.value ?? 0) || this.openingCountMismatch || this.duplicateEntry || this.outOfSequenceEntry;
  }

  get birdCountInvalid(): boolean {
    return ![
      this.form.controls.openingBirds.value,
      this.form.controls.mortality.value,
      this.form.controls.culling.value
    ].every((count) => Number.isInteger(count) && Number(count) >= 0);
  }

  isWholeNumber(value: unknown): boolean {
    return typeof value === 'number' && Number.isInteger(value);
  }

  get openingCountMismatch(): boolean {
    const batchBirds = Number(this.selectedBatch?.['birds'] ?? 0);
    return !!this.selectedBatch && this.form.controls.openingBirds.value !== batchBirds;
  }

  get availableSheds(): Record<string, string | number>[] {
    const farm = this.form.controls.farm.value;
    return this.sheds.filter((shed) => shed['farm'] === farm);
  }

  get availableBatches(): Record<string, string | number>[] {
    const farm = this.form.controls.farm.value;
    const shed = this.form.controls.shed.value;
    return this.batches.filter((batch) =>
      batch['farm'] === farm && batch['shed'] === shed &&
      this.farmOperations.occupiesCapacity(batch) && Number(batch['birds'] ?? 0) > 0
    );
  }

  onFarmChanged(): void {
    const currentShed = this.form.controls.shed.value;
    const selectedShed = this.availableSheds.find((shed) => shed['name'] === currentShed) ?? this.availableSheds[0];
    this.form.controls.shed.setValue(String(selectedShed?.['name'] ?? ''));
    this.onShedChanged();
  }

  onShedChanged(): void {
    const currentBatch = this.form.controls.batch.value;
    const selectedBatch = this.availableBatches.find((batch) => batch['batch'] === currentBatch) ?? this.availableBatches[0];
    this.form.controls.batch.setValue(String(selectedBatch?.['batch'] ?? ''));
    this.onBatchChanged();
  }

  onBatchChanged(): void {
    const batch = this.availableBatches.find((item) => item['batch'] === this.form.controls.batch.value);
    if (!batch) return;
    this.updateOpeningBirds(batch);
    const previousEntry = this.latestBatchEntry;
    const weight = Number(String(previousEntry?.['averageWeight'] ?? batch['averageWeight'] ?? '').replace(/[^\d.]/g, ''));
    if (weight > 0) {
      this.form.controls.previousAverageWeight.setValue(weight);
      this.form.controls.averageWeight.setValue(weight);
    }
  }

  onDateChanged(): void {
    this.onBatchChanged();
  }

  private updateOpeningBirds(batch: Record<string, string | number>): void {
    this.form.controls.openingBirds.setValue(Number(batch['birds'] ?? 0));
  }

  save(): void {
    this.saved = false;
    this.errorMessage = '';
    if (this.entryInvalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving = true;
    const value = this.form.getRawValue();
    const record: Record<string, string | number> = {
      farm: value.farm ?? '',
      shed: value.shed ?? '',
      batch: value.batch ?? '',
      date: value.date ?? '',
      openingBirds: value.openingBirds ?? 0,
      mortality: value.mortality ?? 0,
      culling: value.culling ?? 0,
      closingBirds: this.closingBirds,
      mortalityRate: Number(this.mortalityRate.toFixed(2)),
      feedConsumed: value.feedConsumed ?? 0,
      previousAverageWeight: value.previousAverageWeight ?? 0,
      averageWeight: value.averageWeight ?? 0,
      fcr: this.fcr ?? 0,
      water: value.water ?? 0,
      temperature: value.temperature ?? 0,
      humidity: value.humidity ?? 0,
      notes: value.notes ?? ''
    };
    const selectedBatch = this.selectedBatch;
    if (!selectedBatch) {
      this.errorMessage = 'Select an existing batch before saving daily operations.';
      this.saving = false;
      return;
    }
    const movements = [
      { type: 'Mortality', quantity: Number(value.mortality ?? 0) },
      { type: 'Culling', quantity: Number(value.culling ?? 0) }
    ].filter((movement) => movement.quantity > 0);
    let movementSequence: Observable<Record<string, string | number>> = of(selectedBatch);
    for (const movement of movements) {
      movementSequence = movementSequence.pipe(concatMap((batch) =>
        this.farmOperations.recordBatchTransaction(batch, movement.type, movement.quantity, String(value.date ?? ''), 'Recorded from daily operations')
      ));
    }
    this.directories.createRecord('daily-operations', record).subscribe({
      next: (savedRecord) => {
        this.savedRecords = [savedRecord, ...this.savedRecords];
        movementSequence.subscribe({
          next: (updatedBatch) => {
            this.batches = this.batches.map((batch) => batch['_demoId'] === updatedBatch['_demoId'] ? updatedBatch : batch);
            this.form.controls.openingBirds.setValue(Number(updatedBatch['birds'] ?? 0));
            this.saved = true;
            this.saving = false;
          },
          error: () => {
            this.errorMessage = 'The daily record was saved, but bird movement counts could not be fully synchronized. Review the batch 360 movement ledger and current bird count before retrying.';
            this.saving = false;
          }
        });
      },
      error: () => {
        this.errorMessage = 'The entry could not be saved to this browser. Your records have not been changed.';
        this.saving = false;
      }
    });
  }

  private loadSavedRecords(): void {
    this.directories.getDirectory('daily-operations').subscribe({
      next: (response: DirectoryResponse) => {
        this.savedRecords = response.records;
        if (!this.loadingMasterData) this.onDateChanged();
      },
      error: () => {
        this.errorMessage = 'Saved demo entries could not be loaded from this browser.';
      }
    });
  }

  private loadFarmOptions(): void {
    forkJoin({
      farms: this.directories.getDirectory('farms'),
      sheds: this.directories.getDirectory('sheds'),
      batches: this.directories.getDirectory('batches')
    }).subscribe({
      next: ({ farms, sheds, batches }) => {
        this.farms = farms.records.filter((farm) => farm['status'] === 'Active' && this.rolePermissions.canAccessRecord('farms', farm));
        this.sheds = sheds.records.filter((shed) => this.rolePermissions.canAccessRecord('sheds', shed));
        this.batches = batches.records.filter((batch) => this.rolePermissions.canAccessRecord('batches', batch));
        this.loadingMasterData = false;
        this.onFarmChanged();
      },
      error: () => {
        this.errorMessage = 'Farm, shed, or batch options could not be loaded. The entry has not been enabled.';
        this.loadingMasterData = false;
      }
    });
  }

  private toDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
