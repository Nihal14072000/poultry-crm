import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { ColDef } from 'ag-grid-community';
import { Router, RouterLink } from '@angular/router';
import { DataGridComponent } from '../../../common/components/data-grid/data-grid.component';
import { GridActionsCellComponent } from '../../../common/components/data-grid/grid-actions-cell.component';
import { DashboardData } from '../../../common/models/dashboard.model';
import { DashboardService } from '../../../common/services/dashboard.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, DataGridComponent, FormsModule, NgSelectModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  dashboard?: DashboardData;
  loading = true;
  errorMessage = '';
  selectedPeriod = 'Last 30 days';

  constructor(private readonly dashboardService: DashboardService, private readonly router: Router) {}

  get farmGridRows(): object[] {
    return (this.dashboard?.farmPerformance ?? []).map((farm) => ({
      name: farm.name,
      location: farm.location,
      birds: farm.birds,
      mortality: `${farm.mortality}%`,
      fcr: farm.fcr,
      trend: farm.trend.join(' · '),
      status: farm.status
    }));
  }

  get farmGridColumns(): ColDef[] {
    return [
      {
        field: 'name',
        headerName: 'FARM',
        cellRenderer: GridActionsCellComponent,
        valueGetter: (params) => [{ label: String(params.data?.['name'] ?? ''), action: 'view' }],
        cellRendererParams: {
          onAction: (_action: string, row: Record<string, unknown>) => {
            void this.router.navigate(['/farm-operations/farms', row['name']]);
          }
        }
      },
      { field: 'location', headerName: 'LOCATION' },
      { field: 'birds', headerName: 'ACTIVE BIRDS', valueFormatter: (params) => Number(params.value ?? 0).toLocaleString() },
      { field: 'mortality', headerName: 'MORTALITY' },
      { field: 'fcr', headerName: 'FCR' },
      { field: 'trend', headerName: '7-DAY TREND' },
      { field: 'status', headerName: 'STATUS' }
    ];
  }

  ngOnInit(): void {
    this.dashboardService.getDashboard().subscribe({
      next: (data) => {
        this.dashboard = data;
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'We could not load the dashboard. Please refresh to try again.';
        this.loading = false;
      }
    });
  }

  chartPoint(index: number, value: number): string {
    const x = index * (760 / Math.max((this.dashboard?.revenueTrend.length ?? 2) - 1, 1));
    const y = 205 - (value / 85) * 170;
    return `${x},${y}`;
  }

  chartX(index: number): number {
    return index * (760 / Math.max((this.dashboard?.revenueTrend.length ?? 2) - 1, 1));
  }

  chartY(value: number): number {
    return 205 - (value / 85) * 170;
  }

  revenuePoints(): string {
    return this.dashboard?.revenueTrend.map((point, index) => this.chartPoint(index, point.value)).join(' ') ?? '';
  }

  revenueAreaPoints(): string {
    return `0,220 ${this.revenuePoints()} 760,220`;
  }

  sparkline(values: number[]): string {
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    return values.map((value, index) => {
      const x = index * (70 / Math.max(values.length - 1, 1));
      const y = 24 - ((value - min) / range) * 19;
      return `${x},${y}`;
    }).join(' ');
  }
}
