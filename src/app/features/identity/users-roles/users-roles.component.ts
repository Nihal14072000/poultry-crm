import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DirectoryService } from '../../../common/services/directory.service';
import { RolePermissionService } from '../../../common/services/role-permission.service';
import { SessionAuthService } from '../../../common/services/session-auth.service';
import { DemoUser } from '../../../common/models/auth.model';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-users-roles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users-roles.component.html',
  styleUrl: './users-roles.component.css'
})
export class UsersRolesComponent implements OnInit {
  users: DemoUser[] = [];
  roleNames: string[] = [];
  selectedRole = 'Organization Admin';
  loading = true;
  savingId = '';
  error = '';
  success = '';
  addUserOpen = false;
  newUser = { name: '', email: '', role: 'Farm Supervisor', businessUnit: '' };
  permissionDraft: string[] = [];

  constructor(
    private readonly directories: DirectoryService,
    readonly rolePermissions: RolePermissionService,
    readonly auth: SessionAuthService
  ) {
    this.roleNames = rolePermissions.roleNames;
    this.permissionDraft = rolePermissions.getRolePermissions(this.selectedRole);
  }

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading = true;
    this.error = '';
    forkJoin({
      users: this.directories.getDirectory('users-roles'),
      profiles: this.directories.getDirectory('administration')
    }).subscribe({
      next: ({ users, profiles }) => {
        this.users = users.records.map((record) => {
          const profile = profiles.records.find((item) =>
            String(item['email'] ?? '').toLowerCase() === String(record['email'] ?? '').toLowerCase()
          );
          return this.toDemoUser({
            ...record,
            businessUnit: record['businessUnit'] ?? profile?.['businessUnit']
          });
        });
        this.loading = false;
      },
      error: () => {
        this.error = 'User accounts could not be loaded.';
        this.loading = false;
      }
    });
  }

  saveUser(user: DemoUser): void {
    const id = String(user['_demoId'] ?? '');
    if (!id || !this.rolePermissions.canManageRoles() || this.savingId) return;
    this.savingId = id;
    this.error = '';
    this.success = '';
    const updated = { ...user, permissions: this.permissionSummary(user.role) };
    this.directories.updateRecord('users-roles', id, updated as Record<string, string | number>).subscribe({
      next: (saved) => {
        const savedUser = this.toDemoUser(saved);
        this.users = this.users.map((item) => item['_demoId'] === id ? savedUser : item);
        this.auth.updateCurrentUser(savedUser);
        this.success = `Access updated for ${savedUser.name}.`;
        this.savingId = '';
      },
      error: () => {
        this.error = `Could not update access for ${user.name}.`;
        this.savingId = '';
      }
    });
  }

  addUser(): void {
    this.error = '';
    this.success = '';
    const name = this.newUser.name.trim();
    const email = this.newUser.email.trim().toLowerCase();
    if (!this.rolePermissions.canManageRoles()) return;
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.error = 'Enter a name and a valid email address.';
      return;
    }
    if (this.users.some((user) => user.email.toLowerCase() === email)) {
      this.error = 'A user with this email address already exists.';
      return;
    }
    if (this.requiresScope(this.newUser.role) && !this.newUser.businessUnit.trim()) {
      this.error = `Assign a farm, warehouse, business unit, or territory scope to ${this.newUser.role}.`;
      return;
    }
    this.savingId = 'new-user';
    const record: Record<string, string | number> = {
      name,
      email,
      role: this.newUser.role,
      permissions: this.permissionSummary(this.newUser.role),
      businessUnit: this.newUser.businessUnit.trim() || 'Organization',
      status: 'Active',
      lastActive: 'Never'
    };
    this.directories.createRecord('users-roles', record).subscribe({
      next: (created) => {
        this.users = [...this.users, this.toDemoUser(created)];
        this.newUser = { name: '', email: '', role: 'Farm Supervisor', businessUnit: '' };
        this.addUserOpen = false;
        this.success = `Created ${name}. This browser demo uses the shared password ${'demo1234'} for active accounts.`;
        this.savingId = '';
      },
      error: () => {
        this.error = 'User account could not be created.';
        this.savingId = '';
      }
    });
  }

  permissionSummary(role: string): string {
    return this.rolePermissions.getRolePermissions(role).length + ' permissions';
  }

  requiresScope(role: string): boolean {
    return [
      'Farm Manager', 'Farm Supervisor', 'Veterinarian', 'Warehouse Manager', 'Procurement Manager',
      'Sales Manager', 'Sales Executive', 'Accountant', 'HR Manager', 'Transport Manager',
      'Farm Worker / Operator', 'Production Manager', 'Hatchery Manager / Technician',
      'Warehouse Operator', 'Procurement Officer', 'Driver', 'CRM / Customer Service Agent'
    ].includes(role);
  }

  permissionsForSelectedRole(): string[] {
    return this.permissionDraft;
  }

  selectRole(role: string): void {
    this.selectedRole = role;
    this.permissionDraft = this.rolePermissions.getRolePermissions(role);
  }

  permissionKey(resource: string, action: string): string {
    return `${resource}.${action}`;
  }

  hasPermission(resource: string, action: string): boolean {
    return this.permissionDraft.includes(`${resource}.${action}`) ||
      this.permissionDraft.includes(`${resource}.*`);
  }

  togglePermission(resource: string, action: string, event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const permission = this.permissionKey(resource, action);
    this.permissionDraft = input.checked
      ? [...new Set([...this.permissionDraft, permission])]
      : this.permissionDraft.filter((item) => item !== permission);
  }

  savePermissionTemplate(): void {
    this.error = '';
    this.success = '';
    try {
      this.rolePermissions.saveRolePermissions(this.selectedRole, this.permissionDraft);
      this.success = `Saved the ${this.selectedRole} permission template for this browser.`;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Permission template could not be saved.';
    }
  }

  get canManageRoles(): boolean {
    return this.rolePermissions.canManageRoles();
  }

  get assignableRoleNames(): string[] {
    return this.roleNames.filter((role) => role !== 'Super Admin');
  }

  get canEditPermissionTemplate(): boolean {
    return this.canManageRoles && !['Organization Admin', 'Super Admin'].includes(this.selectedRole);
  }

  trackUser(user: DemoUser): string {
    return String(user['_demoId'] ?? user.email);
  }

  isCurrentUser(user: DemoUser): boolean {
    return user.email.toLowerCase() === (this.auth.currentUser?.email ?? '').toLowerCase();
  }

  private toDemoUser(record: Record<string, string | number>): DemoUser {
    const user: DemoUser = {
      name: String(record['name'] ?? ''),
      email: String(record['email'] ?? ''),
      role: String(record['role'] ?? ''),
      permissions: String(record['permissions'] ?? ''),
      status: String(record['status'] ?? '')
    };
    const businessUnit = record['businessUnit'];
    if (businessUnit !== undefined) user.businessUnit = String(businessUnit);
    const demoId = record['_demoId'];
    if (demoId !== undefined) user['_demoId'] = demoId;
    return user;
  }
}
