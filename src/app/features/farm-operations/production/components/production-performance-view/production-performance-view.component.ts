import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { PerformanceChart, PerformanceMetric, PerformanceSeries } from '../../../../../common/models/directory.model';

@Component({
  selector: 'app-production-performance-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './production-performance-view.component.html',
  styleUrl: './production-performance-view.component.css'
})
export class ProductionPerformanceViewComponent {
  @Input() title = '';
  @Input() metrics: PerformanceMetric[] = [];
  @Input() charts: PerformanceChart[] = [];
  @Input() insight = '';

  chartPoints(chart: PerformanceChart, series: PerformanceSeries): string {
    const allValues = chart.series.flatMap((item) => item.values);
    const min = Math.min(0, ...allValues);
    const max = Math.max(...allValues, min + 1);
    const range = max - min || 1;
    return series.values.map((value, index) => {
      const x = index * (480 / Math.max(chart.labels.length - 1, 1));
      const y = 150 - ((value - min) / range) * 132;
      return `${x},${y}`;
    }).join(' ');
  }

  chartX(chart: PerformanceChart, index: number): number {
    return index * (480 / Math.max(chart.labels.length - 1, 1));
  }

  chartY(chart: PerformanceChart, value: number): number {
    const values = chart.series.flatMap((series) => series.values);
    const min = Math.min(0, ...values);
    const max = Math.max(...values, min + 1);
    return 150 - ((value - min) / (max - min || 1)) * 132;
  }
}
