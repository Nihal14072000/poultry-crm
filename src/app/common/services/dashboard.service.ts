import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BusinessDataService } from './business-data.service';
import { DashboardData } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private readonly data: BusinessDataService) {}

  getDashboard(): Observable<DashboardData> {
    return this.data.get<DashboardData>('dashboard');
  }
}
