import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FarmOperationsData, FarmOperationsService } from '../../../common/services/farm-operations.service';
import { RolePermissionService } from '../../../common/services/role-permission.service';

@Component({
  selector: 'app-farm-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './farm-detail.component.html',
  styleUrl: './farm-detail.component.css'
})
export class FarmDetailComponent implements OnInit {
  data?: FarmOperationsData;
  farm?: Record<string, string | number>;
  error = '';
  loading = true;

  constructor(
    private readonly route: ActivatedRoute,
    readonly operations: FarmOperationsService,
    private readonly rolePermissions: RolePermissionService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const code = params.get('farmCode') ?? '';
      this.loading = true;
      this.operations.loadData().subscribe({
        next: (data) => {
          this.data = data;
          this.farm = data.farms.find((record) => record['code'] === code || record['name'] === code);
          this.error = !this.farm
            ? `Farm "${code}" was not found.`
            : this.rolePermissions.canAccessRecord('farms', this.farm) ? '' : 'This farm is outside your assigned organization scope.';
          this.loading = false;
        },
        error: () => {
          this.error = 'Farm details could not be loaded. Refresh the page to try again.';
          this.loading = false;
        }
      });
    });
  }

  get farmSheds(): Record<string, string | number>[] {
    return this.data?.sheds.filter((shed) => shed['farm'] === this.farm?.['name']) ?? [];
  }

  get farmBatches(): Record<string, string | number>[] {
    return this.data?.batches.filter((batch) => batch['farm'] === this.farm?.['name']) ?? [];
  }

  get activeBatches(): Record<string, string | number>[] {
    return this.farmBatches.filter((batch) => this.operations.occupiesCapacity(batch));
  }

  get occupancy(): number {
    if (this.farm?.['birds'] !== undefined) return this.operations.numberValue(this.farm['birds']);
    return this.farmSheds.reduce((total, shed) => total + this.operations.numberValue(shed['occupancy']), 0);
  }

  get capacity(): number {
    return this.operations.numberValue(this.farm?.['capacity']);
  }

  get utilization(): number {
    const planned = this.farmBatches
      .filter((batch) => String(batch['status'] ?? '').toLowerCase() === 'planned')
      .reduce((total, batch) => total + this.operations.numberValue(batch['initialBirds'] ?? batch['birds']), 0);
    return this.capacity ? Math.min(100, (this.occupancy + planned) / this.capacity * 100) : 0;
  }

  shedBatches(shed: Record<string, string | number>): Record<string, string | number>[] {
    return this.farmBatches.filter((batch) => batch['shed'] === shed['name']);
  }

  available(shed: Record<string, string | number>): number {
    return Math.max(0, this.operations.numberValue(shed['capacity']) - this.operations.numberValue(shed['occupancy']) - this.reservedBirds(shed));
  }

  reservedBirds(shed: Record<string, string | number>): number {
    return this.shedBatches(shed)
      .filter((batch) => String(batch['status'] ?? '').toLowerCase() === 'planned')
      .reduce((total, batch) => total + this.operations.numberValue(batch['initialBirds'] ?? batch['birds']), 0);
  }

  shedUtilization(shed: Record<string, string | number>): number {
    const capacity = this.operations.numberValue(shed['capacity']);
    const used = this.operations.numberValue(shed['occupancy']) + this.reservedBirds(shed);
    return capacity ? Math.min(100, used / capacity * 100) : 0;
  }
}
