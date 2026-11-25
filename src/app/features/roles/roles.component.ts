import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../common/services/toast.service';

interface RoleRecord {
  id: number;
  name: string;
  resources: string[];
  actions: Record<string, string[]>;
}

const AVAILABLE_SCREENS = [
  { key: 'dashboard', label: 'Overview' },
  { key: 'employees', label: 'Employees' },
  { key: 'suppliers', label: 'Buying parties' },
  { key: 'vendor-destinations', label: 'Selling parties' },
  { key: 'vehicles', label: 'Vehicles' },
  { key: 'trips', label: 'Trips' },
  { key: 'deliveries', label: 'Deliveries' },
  { key: 'finance', label: 'Finance' },
  { key: 'payments', label: 'Payments' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'users-roles', label: 'Roles & permissions' }
] as const;

const AVAILABLE_ACTIONS = ['create', 'update', 'delete', 'transition', 'approve', 'export', 'manage'] as const;

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './roles.component.html',
  styleUrl: './roles.component.css'
})
export class RolesComponent implements OnInit {
  private readonly baseUrl = `${environment.apiUrl.replace(/\/+$/, '')}/roles`;

  readonly availableScreens = AVAILABLE_SCREENS;
  readonly availableActions = AVAILABLE_ACTIONS;

  roles: RoleRecord[] = [];
  loading = true;
  saving = false;
  error = '';

  editingId: number | null = null;
  name = '';
  selectedResources = new Set<string>(['dashboard']);
  selectedActions = new Set<string>();

  constructor(
    private readonly http: HttpClient,
    private readonly toast: ToastService
  ) {}

  ngOnInit(): void {
    this.loadRoles();
  }

  loadRoles(): void {
    this.loading = true;
    this.error = '';
    this.http.get<RoleRecord[]>(this.baseUrl).subscribe({
      next: (rows) => {
        this.roles = rows ?? [];
        this.loading = false;
      },
      error: (err: HttpErrorResponse) => {
        this.error = err.error?.message || err.message || 'Unable to load roles.';
        this.loading = false;
      }
    });
  }

  screenNames(role: RoleRecord): string {
    return role.resources?.length ? role.resources.join(', ') : 'None';
  }

  actionNames(role: RoleRecord): string {
    const keys = Object.keys(role.actions ?? {}).filter((k) => (role.actions[k]?.length ?? 0) > 0);
    return keys.length ? keys.join(', ') : 'Read only';
  }

  toggleResource(key: string): void {
    if (this.selectedResources.has(key)) {
      this.selectedResources.delete(key);
    } else {
      this.selectedResources.add(key);
    }
  }

  toggleAction(action: string): void {
    if (this.selectedActions.has(action)) {
      this.selectedActions.delete(action);
    } else {
      this.selectedActions.add(action);
    }
  }

  startEdit(role: RoleRecord): void {
    this.error = '';
    this.editingId = role.id;
    this.name = role.name;
    this.selectedResources = new Set(role.resources ?? []);
    this.selectedActions = new Set(Object.keys(role.actions ?? {}).filter((key) => (role.actions[key]?.length ?? 0) > 0));
  }

  cancelEdit(): void {
    this.editingId = null;
    this.name = '';
    this.selectedResources = new Set(['dashboard']);
    this.selectedActions = new Set();
  }

  saveRole(): void {
    const trimmed = this.name.trim();
    if (!trimmed) {
      this.error = 'Role name is required.';
      return;
    }
    const resources = Array.from(this.selectedResources);
    const actions: Record<string, string[]> = {};
    for (const action of this.selectedActions) {
      if (resources.length) {
        actions[action] = resources;
      }
    }

    this.saving = true;
    this.error = '';
    const request$ = this.editingId !== null
      ? this.http.put<RoleRecord>(`${this.baseUrl}/${this.editingId}`, { name: trimmed, resources, actions })
      : this.http.post<RoleRecord>(this.baseUrl, { name: trimmed, resources, actions });

    request$.subscribe({
      next: (saved) => {
        this.saving = false;
        if (this.editingId !== null) {
          this.roles = this.roles.map((r) => r.id === saved.id ? saved : r);
          this.toast.success(`Role "${saved.name}" updated.`);
        } else {
          this.roles = [...this.roles, saved];
          this.toast.success(`Role "${saved.name}" created.`);
        }
        this.cancelEdit();
      },
      error: (err: HttpErrorResponse) => {
        this.saving = false;
        this.error = err.error?.message || err.message || 'Unable to save role.';
      }
    });
  }

  deleteRole(role: RoleRecord): void {
    this.saving = true;
    this.error = '';
    this.http.delete<void>(`${this.baseUrl}/${role.id}`).subscribe({
      next: () => {
        this.saving = false;
        this.roles = this.roles.filter((r) => r.id !== role.id);
        this.toast.success(`Role "${role.name}" deleted.`);
      },
      error: (err: HttpErrorResponse) => {
        this.saving = false;
        this.error = err.error?.message || err.message || 'Unable to delete role.';
      }
    });
  }
}
