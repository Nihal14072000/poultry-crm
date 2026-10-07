import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { catchError, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { BusinessDataService } from '../../../common/services/business-data.service';
import { DirectoryColumn, ProductionResponse } from '../../../common/models/directory.model';
import { ProductionPerformanceViewComponent } from './components/production-performance-view/production-performance-view.component';
import { ProductionRecordsComponent } from './components/production-records/production-records.component';

@Component({
  selector: 'app-production-page',
  standalone: true,
  imports: [CommonModule, ProductionPerformanceViewComponent, ProductionRecordsComponent],
  templateUrl: './production-page.component.html',
  styleUrl: './production-page.component.css'
})
export class ProductionPageComponent implements OnInit {
  title = '';
  description = '';
  resource = '';
  columns: DirectoryColumn[] = [];
  records: Record<string, string | number>[] = [];
  metrics: ProductionResponse['performance']['metrics'] = [];
  charts: ProductionResponse['performance']['charts'] = [];
  insight = '';
  selectedTab: 'records' | 'performance' = 'records';
  loading = true;
  errorMessage = '';
  query = '';

  constructor(private readonly route: ActivatedRoute, private readonly data: BusinessDataService) {}

  ngOnInit(): void {
    this.route.data.pipe(
      map((routeData) => ({
        title: routeData['title'] as string,
        description: routeData['description'] as string,
        resource: routeData['resource'] as string,
        columns: routeData['columns'] as DirectoryColumn[]
      })),
      distinctUntilChanged((previous, current) => previous.resource === current.resource),
      switchMap((config) => {
        this.title = config.title;
        this.description = config.description;
        this.resource = config.resource;
        this.columns = config.columns;
        this.selectedTab = 'records';
        this.loading = true;
        this.errorMessage = '';
        return this.data.get<ProductionResponse>(config.resource).pipe(
          catchError(() => {
            this.errorMessage = `We could not load ${config.title.toLowerCase()} data. Please refresh to try again.`;
            return of(null);
          })
        );
      })
    ).subscribe((response) => {
      if (response) {
        this.records = response.records;
        if (response.performance && Array.isArray(response.performance.metrics) && Array.isArray(response.performance.charts)) {
          this.metrics = response.performance.metrics;
          this.charts = response.performance.charts;
          this.insight = response.performance.insight;
          this.errorMessage = '';
        } else {
          this.metrics = [];
          this.charts = [];
          this.errorMessage = `Performance data is not configured for ${this.title.toLowerCase()}.`;
        }
      }
      this.loading = false;
    });
  }

}
