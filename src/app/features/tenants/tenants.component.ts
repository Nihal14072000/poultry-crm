import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../common/services/toast.service';

interface TenantRecord {
  id: number;
  name: string;
  active: boolean;
  isActive?: boolean;
  createdAt?: string;
  adminUsername?: string;
}

@Component({
  selector: 'app-tenants',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tenants.component.html',
  styleUrl: './tenants.component.css'
})
export class TenantsComponent implements OnInit {
  private readonly baseUrl = `${environment.apiUrl.replace(/\/+$/, '')}/tenants`;

  tenants: TenantRecord[] = [];
  loading = true;
  saving = false;
  error = '';

  name = '';
  adminUsername = '';
  adminPassword = '';

  editingId: number | null = null;
  editName = '';

  constructor(
    private readonly http: HttpClient,
    private readonly toast: ToastService
  ) {}

  ngOnInit(): void {
    this.loadTenants();
  }

  loadTenants(): void {
    this.loading = true;
    this.error = '';
    this.http.get<TenantRecord[]>(this.baseUrl).subscribe({
      next: (rows) => {
        this.tenants = rows ?? [];
        this.loading = false;
      },
      error: (err: HttpErrorResponse) => {
        this.error = err.error?.message || err.message || 'Unable to load tenants.';
        this.loading = false;
      }
    });
  }

  isTenantActive(tenant: TenantRecord): boolean {
    return tenant.isActive ?? tenant.active ?? true;
  }

  createTenant(): void {
    this.error = '';
    const trimmedName = this.name.trim();
    const trimmedAdmin = this.adminUsername.trim();
    if (!trimmedName) {
      this.error = 'Tenant name is required.';
      return;
    }
    if (trimmedAdmin && this.adminPassword.length < 6) {
      this.error = 'Admin password must be at least 6 characters when creating an admin user.';
      return;
    }

    this.saving = true;
    const payload = {
      name: trimmedName,
      isActive: true,
      adminUsername: trimmedAdmin || null,
      adminPassword: this.adminPassword ? this.adminPassword : null
    };

    this.http.post<TenantRecord>(this.baseUrl, payload).subscribe({
      next: (created) => {
        this.saving = false;
        this.name = '';
        this.adminUsername = '';
        this.adminPassword = '';
        this.tenants = [...this.tenants, created];
        const adminNote = created.adminUsername ? ` (Admin: ${created.adminUsername})` : '';
        this.toast.success(`Tenant "${created.name}" onboarded${adminNote}.`);
      },
      error: (err: HttpErrorResponse) => {
        this.saving = false;
        this.error = err.error?.message || err.message || 'Unable to onboard tenant.';
      }
    });
  }

  startEdit(tenant: TenantRecord): void {
    this.error = '';
    this.editingId = tenant.id;
    this.editName = tenant.name;
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editName = '';
  }

  saveEdit(tenant: TenantRecord): void {
    const trimmed = this.editName.trim();
    if (!trimmed) {
      this.error = 'Tenant name is required.';
      return;
    }
    this.saving = true;
    this.error = '';
    this.http.put<TenantRecord>(`${this.baseUrl}/${tenant.id}`, {
      name: trimmed,
      isActive: this.isTenantActive(tenant)
    }).subscribe({
      next: (updated) => {
        this.saving = false;
        this.editingId = null;
        this.editName = '';
        this.tenants = this.tenants.map((item) => item.id === updated.id ? updated : item);
        this.toast.success(`Tenant "${updated.name}" updated.`);
      },
      error: (err: HttpErrorResponse) => {
        this.saving = false;
        this.error = err.error?.message || err.message || 'Unable to update tenant.';
      }
    });
  }

  toggleStatus(tenant: TenantRecord): void {
    const nextActive = !this.isTenantActive(tenant);
    this.saving = true;
    this.error = '';
    this.http.put<TenantRecord>(`${this.baseUrl}/${tenant.id}`, {
      name: tenant.name,
      isActive: nextActive
    }).subscribe({
      next: (updated) => {
        this.saving = false;
        this.tenants = this.tenants.map((item) => item.id === updated.id ? updated : item);
        this.toast.success(`Tenant "${updated.name}" ${nextActive ? 'activated' : 'deactivated'}.`);
      },
      error: (err: HttpErrorResponse) => {
        this.saving = false;
        this.error = err.error?.message || err.message || 'Unable to update tenant.';
      }
    });
  }
}
