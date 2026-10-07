import { Injectable } from '@angular/core';
import { concatMap, forkJoin, map, Observable, of, throwError } from 'rxjs';
import { DirectoryService } from './directory.service';
import { RolePermissionService } from './role-permission.service';

function localDateString(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export interface FarmOperationsData {
  farms: Record<string, string | number>[];
  sheds: Record<string, string | number>[];
  batches: Record<string, string | number>[];
  dailyRecords: Record<string, string | number>[];
  transactions: Record<string, string | number>[];
}

export interface BatchCapacityCheck {
  valid: boolean;
  message: string;
  availableFarmCapacity: number;
  availableShedCapacity: number;
}

@Injectable({ providedIn: 'root' })
export class FarmOperationsService {
  constructor(
    private readonly directories: DirectoryService,
    private readonly rolePermissions: RolePermissionService
  ) {}

  loadData(): Observable<FarmOperationsData> {
    return forkJoin({
      farms: this.directories.getDirectory('farms'),
      sheds: this.directories.getDirectory('sheds'),
      batches: this.directories.getDirectory('batches'),
      daily: this.directories.getDirectory('daily-operations'),
      transactions: this.directories.getDirectory('batch-transactions')
    }).pipe(map(({ farms, sheds, batches, daily, transactions }) => ({
      farms: farms.records,
      sheds: sheds.records,
      batches: batches.records,
      dailyRecords: daily.records,
      transactions: transactions.records
    })));
  }

  validateBatchPlacement(
    record: Record<string, string | number>,
    existing: Record<string, string | number> | undefined,
    data: FarmOperationsData
  ): BatchCapacityCheck {
    const farmName = String(record['farm'] ?? '').trim();
    const shedName = String(record['shed'] ?? '').trim();
    const farm = data.farms.find((item) => item['name'] === farmName);
    const shed = data.sheds.find((item) => item['farm'] === farmName && item['name'] === shedName);
    const placement = this.numberValue(record['initialBirds'] ?? record['placementQuantity'] ?? record['birds']);
    if (!farm) return this.invalid('Choose an existing farm.', 0, 0);
    if (!shed) return this.invalid('Choose a shed that belongs to the selected farm.', 0, 0);
    if (farm['status'] && String(farm['status']).toLowerCase() !== 'active') return this.invalid('Choose an active farm for flock placement.', 0, 0);
    if (shed['status'] && String(shed['status']).toLowerCase() !== 'active') return this.invalid('Choose an active shed for flock placement.', 0, 0);
    if (!Number.isInteger(placement) || placement <= 0) return this.invalid('Placement quantity must be a positive whole number.', 0, 0);

    const oldReservesCapacity = existing && this.reservesCapacity(existing);
    const existingBirds = oldReservesCapacity ? this.capacityReservation(existing) : 0;
    const plannedFarmBirds = data.batches
      .filter((batch) => batch['farm'] === farmName && String(batch['_demoId'] ?? '') !== String(existing?.['_demoId'] ?? '') && this.isPlanned(batch))
      .reduce((total, batch) => total + this.capacityReservation(batch), 0);
    const plannedShedBirds = data.batches
      .filter((batch) => batch['farm'] === farmName && batch['shed'] === shedName && String(batch['_demoId'] ?? '') !== String(existing?.['_demoId'] ?? '') && this.isPlanned(batch))
      .reduce((total, batch) => total + this.capacityReservation(batch), 0);
    const sameFarm = existing?.['farm'] === farmName;
    const sameShed = sameFarm && existing?.['shed'] === shedName;
    const farmOccupancy = this.numberValue(farm['birds']) + plannedFarmBirds;
    const shedOccupancy = this.numberValue(shed['occupancy']) + plannedShedBirds;
    const farmCapacity = this.numberValue(farm['capacity']);
    const shedCapacity = this.numberValue(shed['capacity']);
    const availableFarmCapacity = Math.max(0, farmCapacity - farmOccupancy + (sameFarm ? existingBirds : 0));
    const availableShedCapacity = Math.max(0, shedCapacity - shedOccupancy + (sameShed ? existingBirds : 0));
    const requested = this.reservesCapacity(record) ? this.capacityReservation(record) : 0;

    if (requested > availableFarmCapacity) {
      return this.invalid(`Farm capacity exceeded. Only ${availableFarmCapacity.toLocaleString()} birds can be reserved.`, availableFarmCapacity, availableShedCapacity);
    }
    if (requested > availableShedCapacity) {
      return this.invalid(`Shed capacity exceeded. Only ${availableShedCapacity.toLocaleString()} birds can be placed in ${shedName}.`, availableFarmCapacity, availableShedCapacity);
    }
    return { valid: true, message: '', availableFarmCapacity, availableShedCapacity };
  }

  applyBatchOccupancyChange(
    previous: Record<string, string | number> | undefined,
    next: Record<string, string | number>,
    data: FarmOperationsData
  ): Observable<unknown> {
    const updates: Observable<unknown>[] = [];
    const previousActive = previous && this.occupiesCapacity(previous);
    const nextActive = this.occupiesCapacity(next);
    const previousBirds = previousActive ? this.numberValue(previous?.['birds']) : 0;
    const nextBirds = nextActive ? this.numberValue(next['birds']) : 0;
    const previousFarm = previous ? String(previous['farm'] ?? '') : '';
    const nextFarm = String(next['farm'] ?? '');
    const previousShed = previous ? String(previous['shed'] ?? '') : '';
    const nextShed = String(next['shed'] ?? '');

    const farmDeltas = new Map<string, number>();
    if (previousFarm) farmDeltas.set(previousFarm, (farmDeltas.get(previousFarm) ?? 0) - previousBirds);
    if (nextFarm) farmDeltas.set(nextFarm, (farmDeltas.get(nextFarm) ?? 0) + nextBirds);
    for (const [farmName, delta] of farmDeltas) {
      if (!delta) continue;
      const farm = data.farms.find((item) => item['name'] === farmName);
      if (!farm) continue;
      updates.push(this.directories.updateRecord('farms', String(farm['_demoId'] ?? ''), {
        ...farm,
        birds: Math.max(0, this.numberValue(farm['birds']) + delta)
      }));
    }

    const shedDeltas = new Map<string, number>();
    if (previousShed) shedDeltas.set(`${previousFarm}\n${previousShed}`, (shedDeltas.get(`${previousFarm}\n${previousShed}`) ?? 0) - previousBirds);
    if (nextShed) shedDeltas.set(`${nextFarm}\n${nextShed}`, (shedDeltas.get(`${nextFarm}\n${nextShed}`) ?? 0) + nextBirds);
    for (const [key, delta] of shedDeltas) {
      if (!delta) continue;
      const [farmName, shedName] = key.split('\n');
      const shed = data.sheds.find((item) => item['farm'] === farmName && item['name'] === shedName);
      if (!shed) continue;
      updates.push(this.directories.updateRecord('sheds', String(shed['_demoId'] ?? ''), {
        ...shed,
        occupancy: Math.max(0, this.numberValue(shed['occupancy']) + delta)
      }));
    }
    return updates.length ? forkJoin(updates) : of([]);
  }

  farmOccupancy(farm: Record<string, string | number>, sheds: Record<string, string | number>[]): number {
    if (farm['birds'] !== undefined) return this.numberValue(farm['birds']);
    const associatedSheds = sheds.filter((shed) => shed['farm'] === farm['name']);
    if (associatedSheds.length) return associatedSheds.reduce((total, shed) => total + this.numberValue(shed['occupancy']), 0);
    return this.numberValue(farm['birds']);
  }

  getBatchAlerts(
    batch: Record<string, string | number>,
    dailyRecords: Record<string, string | number>[],
    transactions: Record<string, string | number>[]
  ): string[] {
    const batchId = String(batch['batch'] ?? '');
    const daily = dailyRecords.filter((record) => record['batch'] === batchId);
    const batchTransactions = transactions.filter((record) => record['batch'] === batchId);
    const alerts: string[] = [];
    const initialBirds = this.numberValue(batch['initialBirds'] ?? batch['placementQuantity'] ?? batch['birds']);
    const mortality = this.batchMortalityCount(daily, batchTransactions);
    if (initialBirds > 0 && mortality / initialBirds * 100 > 1.5) alerts.push('Mortality is above the 1.5% reference threshold.');

    const latest = daily.sort((left, right) => String(right['date'] ?? '').localeCompare(String(left['date'] ?? '')))[0];
    const fcr = this.numberValue(latest?.['fcr'] ?? batch['fcr']);
    if (fcr > 1.62 && String(batch['type']).toLowerCase() === 'broiler') alerts.push(`Latest FCR ${fcr.toFixed(2)} is above the 1.62 reference target.`);
    const currentWeight = this.numberValue(latest?.['averageWeight'] ?? batch['averageWeight']);
    const targetWeight = this.numberValue(batch['targetWeight']);
    if (targetWeight > 0 && currentWeight > 0 && currentWeight < targetWeight * 0.95) {
      alerts.push('Average weight is more than 5% below target.');
    }
    return alerts;
  }

  batchMortalityCount(
    dailyRecords: Record<string, string | number>[],
    transactions: Record<string, string | number>[]
  ): number {
    const dailyDatesInLedger = new Set(transactions
      .filter((record) => record['type'] === 'Mortality' && record['notes'] === 'Recorded from daily operations')
      .map((record) => String(record['date'] ?? '')));
    const ledgerMortality = transactions
      .filter((record) => record['type'] === 'Mortality')
      .reduce((total, record) => total + this.numberValue(record['quantity']), 0);
    const unledgeredDailyMortality = dailyRecords
      .filter((record) => !dailyDatesInLedger.has(String(record['date'] ?? '')))
      .reduce((total, record) => total + this.numberValue(record['mortality']), 0);
    return ledgerMortality + unledgeredDailyMortality;
  }

  recordBatchTransaction(
    batch: Record<string, string | number>,
    type: string,
    quantity: number,
    date: string,
    notes: string
  ): Observable<Record<string, string | number>> {
    if (!this.rolePermissions.can('daily-operations', 'create')) {
      return throwError(() => new Error('Your role cannot record bird movements.'));
    }
    return this.loadData().pipe(concatMap((data) => {
      const currentBatch = data.batches.find((record) => record['_demoId'] === batch['_demoId']);
      if (!currentBatch) return throwError(() => new Error('This batch could not be found in local demo data.'));
      const batchId = String(currentBatch?.['_demoId'] ?? '');
      const currentBirds = this.numberValue(currentBatch?.['birds']);
      if (!batchId) return throwError(() => new Error('This batch is missing its local record identifier.'));
      if (!Number.isInteger(quantity) || quantity <= 0) return throwError(() => new Error('Enter a positive whole-number quantity.'));
      if (quantity > currentBirds) return throwError(() => new Error('Transaction quantity cannot exceed the batch’s current bird count.'));
      if (!this.occupiesCapacity(currentBatch)) return throwError(() => new Error('Place the batch before recording bird movements.'));
      if (!date || Number.isNaN(Date.parse(date)) || date > localDateString()) {
        return throwError(() => new Error('Enter a valid transaction date that is not in the future.'));
      }
      if (!['Mortality', 'Culling', 'Sale / lifting', 'Transfer out', 'Adjustment out'].includes(type)) {
        return throwError(() => new Error('Choose a supported bird movement type.'));
      }

      const initialBirds = this.numberValue(currentBatch?.['initialBirds'] ?? currentBatch?.['placementQuantity'] ?? currentBirds);
      const updatedBatch = { ...currentBatch, initialBirds, birds: currentBirds - quantity };
      const transaction = {
        batch: currentBatch?.['batch'] ?? '',
        farm: currentBatch?.['farm'] ?? '',
        shed: currentBatch?.['shed'] ?? '',
        type,
        date,
        quantity,
        birdsBefore: currentBirds,
        birdsAfter: currentBirds - quantity,
        notes
      };
      return this.directories.createRecord('batch-transactions', transaction).pipe(
        concatMap(() => this.directories.updateRecord('batches', batchId, updatedBatch)),
        concatMap((updated) => this.applyBatchOccupancyChange(currentBatch, updated, data).pipe(map(() => updated)))
      );
    }));
  }

  numberValue(value: unknown): number {
    const normalized = String(value ?? '').replace(/[−–]/g, '-').replace(/,/g, '').replace(/[^0-9.+-]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  reservesCapacity(record: Record<string, string | number>): boolean {
    return !['cancelled', 'closed', 'completed'].includes(String(record['status'] ?? '').toLowerCase());
  }

  occupiesCapacity(record: Record<string, string | number>): boolean {
    return this.reservesCapacity(record) && !this.isPlanned(record);
  }

  private isPlanned(record: Record<string, string | number>): boolean {
    return String(record['status'] ?? '').toLowerCase() === 'planned';
  }

  private capacityReservation(record: Record<string, string | number>): number {
    return this.isPlanned(record)
      ? this.numberValue(record['initialBirds'] ?? record['placementQuantity'] ?? record['birds'])
      : this.numberValue(record['birds']);
  }

  private invalid(message: string, availableFarmCapacity: number, availableShedCapacity: number): BatchCapacityCheck {
    return { valid: false, message, availableFarmCapacity, availableShedCapacity };
  }
}
