import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface GeneratedReport {
  id: number;
  reportType: string;
  fromDate: string | null;
  toDate: string | null;
  format: string;
  status: string;
  fileName: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface GenerateReportResponse {
  reportId: number;
  status: string;
  message: string;
}

export interface GenerateReportRequest {
  reportType: string;
  format: 'PDF';
  fromDate?: string;
  toDate?: string;
  filters?: Record<string, string | number>;
}

@Injectable({ providedIn: 'root' })
export class ReportsApiService {
  private readonly reportsUrl = `${environment.apiUrl}/reports`;

  constructor(private readonly http: HttpClient) {}

  generate(request: GenerateReportRequest): Promise<GenerateReportResponse> {
    return firstValueFrom(this.http.post<GenerateReportResponse>(`${this.reportsUrl}/generate`, request));
  }

  list(): Promise<GeneratedReport[]> {
    return firstValueFrom(this.http.get<GeneratedReport[]>(this.reportsUrl));
  }

  get(id: number): Promise<GeneratedReport> {
    return firstValueFrom(this.http.get<GeneratedReport>(`${this.reportsUrl}/${id}`));
  }

  download(id: number): Promise<Blob> {
    return firstValueFrom(this.http.get(`${this.reportsUrl}/${id}/download`, { responseType: 'blob' }));
  }

  retry(id: number): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.reportsUrl}/${id}/retry`, {}));
  }
}
