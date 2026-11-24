import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { GeneratedReport, GenerateReportRequest, ReportsApiService } from '../../common/services/reports-api.service';

type ReportType = 'SALES' | 'PURCHASE' | 'PAYMENTS' | 'OUTSTANDING' | 'DELIVERIES' | 'TRIP_SUMMARY';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.css'
})
export class ReportsComponent implements OnInit, OnDestroy {
  readonly reportTypes: { value: ReportType; label: string; description: string }[] = [
    { value: 'SALES', label: 'Sales report', description: 'Sales activity for a selected period.' },
    { value: 'PURCHASE', label: 'Purchase report', description: 'Purchase activity for a selected period.' },
    { value: 'PAYMENTS', label: 'Payments report', description: 'Receipts and payouts for a selected period.' },
    { value: 'OUTSTANDING', label: 'Outstanding report', description: 'Party balances as of the selected date.' },
    { value: 'DELIVERIES', label: 'Deliveries report', description: 'Delivery activity for a selected period.' },
    { value: 'TRIP_SUMMARY', label: 'Trip Summary PDF', description: 'Trip assignment, orders, payments and expenses.' }
  ];

  reportType: ReportType = 'SALES';
  fromDate = this.localDate();
  toDate = this.localDate();
  tripId = '';
  partyId = '';
  paymentType = '';
  paymentStatus = '';
  reports: GeneratedReport[] = [];
  loading = true;
  generating = false;
  downloadingId: number | null = null;
  retryingId: number | null = null;
  errorMessage = '';
  successMessage = '';
  private pollHandle: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(private readonly reportsApi: ReportsApiService) {}

  ngOnInit(): void {
    void this.refreshReports();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.pollHandle) clearTimeout(this.pollHandle);
  }

  get selectedReportDescription(): string {
    return this.reportTypes.find((item) => item.value === this.reportType)?.description ?? '';
  }

  get isTripSummary(): boolean {
    return this.reportType === 'TRIP_SUMMARY';
  }

  get supportsTripFilter(): boolean {
    return ['SALES', 'PURCHASE', 'PAYMENTS', 'DELIVERIES'].includes(this.reportType);
  }

  get supportsPartyFilter(): boolean {
    return this.reportType !== 'TRIP_SUMMARY';
  }

  get supportsPaymentFilters(): boolean {
    return this.reportType === 'PAYMENTS';
  }

  async generateReport(): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';

    const filters: Record<string, string | number> = {};
    if (this.isTripSummary) {
      const id = Number(this.tripId);
      if (!Number.isSafeInteger(id) || id < 1) {
        this.errorMessage = 'Enter a valid positive Trip ID.';
        return;
      }
      filters['tripId'] = id;
    } else {
      if (!this.fromDate || !this.toDate) {
        this.errorMessage = 'Select both the start date and end date.';
        return;
      }
      if (this.fromDate > this.toDate) {
        this.errorMessage = 'Start date must be on or before end date.';
        return;
      }
      if (this.supportsTripFilter && this.tripId.trim()) {
        const id = Number(this.tripId);
        if (!Number.isSafeInteger(id) || id < 1) {
          this.errorMessage = 'Trip ID must be a positive integer.';
          return;
        }
        filters['tripId'] = id;
      }
      if (this.partyId.trim()) {
        const id = Number(this.partyId);
        if (!Number.isSafeInteger(id) || id < 1) {
          this.errorMessage = 'Party ID must be a positive integer.';
          return;
        }
        filters['partyId'] = id;
      }
      if (this.supportsPaymentFilters && this.paymentType) filters['paymentType'] = this.paymentType;
      if (this.supportsPaymentFilters && this.paymentStatus) filters['status'] = this.paymentStatus;
    }

    const request: GenerateReportRequest = {
      reportType: this.reportType,
      format: 'PDF',
      ...(this.isTripSummary ? {} : { fromDate: this.fromDate, toDate: this.toDate }),
      ...(Object.keys(filters).length ? { filters } : {})
    };

    this.generating = true;
    try {
      const result = await this.reportsApi.generate(request);
      this.successMessage = result.message || 'Report generation has been queued.';
      await this.refreshReports();
      this.schedulePolling();
    } catch (error) {
      this.errorMessage = this.readError(error, 'The report could not be generated. Try again.');
    } finally {
      this.generating = false;
    }
  }

  async refreshReports(): Promise<void> {
    this.errorMessage = this.errorMessage && !this.loading ? this.errorMessage : '';
    try {
      this.reports = await this.reportsApi.list();
      this.reports.sort((left, right) => right.id - left.id);
      this.schedulePolling();
    } catch (error) {
      this.errorMessage = this.readError(error, 'Report history could not be loaded.');
    } finally {
      this.loading = false;
    }
  }

  async downloadReport(report: GeneratedReport): Promise<void> {
    this.errorMessage = '';
    this.downloadingId = report.id;
    try {
      const blob = await this.reportsApi.download(report.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = report.fileName || `report-${report.id}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      this.errorMessage = this.readError(error, 'The PDF could not be downloaded.');
    } finally {
      this.downloadingId = null;
    }
  }

  async retryReport(report: GeneratedReport): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';
    this.retryingId = report.id;
    try {
      await this.reportsApi.retry(report.id);
      this.successMessage = `Report #${report.id} has been queued for retry.`;
      await this.refreshReports();
      this.schedulePolling();
    } catch (error) {
      this.errorMessage = this.readError(error, 'The report could not be queued for retry.');
    } finally {
      this.retryingId = null;
    }
  }

  statusClass(status: string): string {
    return `status-${status.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  }

  isActive(status: string): boolean {
    return ['QUEUED', 'PROCESSING', 'RUNNING', 'IN_PROGRESS', 'GENERATING'].includes(status.toUpperCase());
  }

  formatDate(value: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }

  reportPeriod(report: GeneratedReport): string {
    if (report.reportType === 'TRIP_SUMMARY') return report.fromDate ? `Trip date: ${report.fromDate}` : 'Trip Summary';
    if (report.reportType === 'OUTSTANDING') return report.toDate ? `As of ${report.toDate}` : '—';
    return report.fromDate && report.toDate ? `${report.fromDate} – ${report.toDate}` : '—';
  }

  private schedulePolling(): void {
    if (this.destroyed || !this.reports.some((report) => this.isActive(report.status))) return;
    if (this.pollHandle) clearTimeout(this.pollHandle);
    this.pollHandle = setTimeout(() => {
      this.pollHandle = null;
      void this.refreshReports();
    }, 3000);
  }

  private readError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as { message?: string; detail?: string } | string | null;
      if (typeof body === 'string' && body.trim()) return body;
      if (body && typeof body === 'object' && (body.message || body.detail)) return body.message || body.detail || fallback;
    }
    return error instanceof Error ? error.message : fallback;
  }

  private localDate(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
