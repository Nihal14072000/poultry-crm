import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DashboardData } from '../../../common/models/dashboard.model';
import { DashboardService } from '../../../common/services/dashboard.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  dashboard?: DashboardData;
  loading = true;
  errorMessage = '';
  selectedPeriod = 'Last 30 days';

  constructor(private readonly dashboardService: DashboardService) {}

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
