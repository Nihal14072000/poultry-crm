import { Injectable } from '@angular/core';
import { PermissionAction } from '../models/auth.model';
import { SessionAuthService } from './session-auth.service';

const allResources = [
  'dashboard', 'farms', 'sheds', 'batches', 'daily-operations', 'broiler', 'layer', 'breeder', 'hatchery',
  'feed-health', 'feed', 'health', 'medication', 'products', 'warehouses', 'inventory', 'transfers',
  'stock-ledger', 'suppliers', 'procurement', 'customers', 'quotations', 'orders', 'sales', 'dispatch',
  'leads', 'opportunities', 'follow-ups', 'complaints', 'employees', 'fleet', 'vehicles', 'vehicle-assignments', 'finance', 'receivables',
  'payables', 'payments', 'expenses', 'profitability', 'reports', 'analytics', 'notifications',
  'organization', 'users-roles', 'documents', 'audit', 'administration'
];

const readOnlyRoles = new Set(['Owner', 'Read Only']);
const overrideStorageKey = 'flockwise.demo.role-permission-overrides';
const editableActions: PermissionAction[] = ['read', 'create', 'update', 'delete', 'transition', 'approve', 'export'];

const roleResources: Record<string, string[]> = {
  'Organization Admin': allResources,
  Owner: allResources,
  'Farm Manager': ['dashboard', 'farms', 'sheds', 'batches', 'daily-operations', 'broiler', 'layer', 'breeder', 'hatchery', 'feed-health', 'feed', 'health', 'medication', 'employees', 'documents', 'notifications', 'reports', 'analytics', 'audit'],
  'Farm Supervisor': ['dashboard', 'farms', 'sheds', 'batches', 'daily-operations', 'broiler', 'layer', 'breeder', 'feed-health', 'feed', 'health', 'medication', 'documents', 'notifications'],
  Veterinarian: ['dashboard', 'farms', 'sheds', 'batches', 'daily-operations', 'health', 'medication', 'feed-health', 'documents', 'notifications', 'reports'],
  'Warehouse Manager': ['dashboard', 'products', 'warehouses', 'inventory', 'transfers', 'stock-ledger', 'suppliers', 'feed-health', 'documents', 'notifications', 'reports'],
  'Procurement Manager': ['dashboard', 'products', 'warehouses', 'inventory', 'transfers', 'stock-ledger', 'suppliers', 'procurement', 'expenses', 'documents', 'notifications', 'reports'],
  'Sales Manager': ['dashboard', 'customers', 'quotations', 'orders', 'sales', 'dispatch', 'leads', 'opportunities', 'follow-ups', 'complaints', 'products', 'receivables', 'documents', 'notifications', 'reports', 'analytics'],
  'Sales Executive': ['dashboard', 'customers', 'quotations', 'orders', 'sales', 'dispatch', 'leads', 'opportunities', 'follow-ups', 'complaints', 'products', 'documents', 'notifications'],
  Accountant: ['dashboard', 'finance', 'receivables', 'payables', 'payments', 'expenses', 'profitability', 'sales', 'procurement', 'reports', 'analytics', 'documents', 'notifications', 'audit'],
  'HR Manager': ['dashboard', 'employees', 'administration', 'documents', 'notifications', 'reports'],
  'Transport Manager': ['dashboard', 'fleet', 'vehicles', 'employees', 'vehicle-assignments', 'dispatch', 'sales', 'customers', 'documents', 'notifications', 'reports'],
  'Farm Worker / Operator': ['dashboard', 'farms', 'sheds', 'batches', 'daily-operations', 'feed', 'documents', 'notifications'],
  'Production Manager': ['dashboard', 'farms', 'sheds', 'batches', 'daily-operations', 'broiler', 'layer', 'breeder', 'hatchery', 'feed', 'health', 'medication', 'reports', 'analytics', 'documents', 'notifications'],
  'Hatchery Manager / Technician': ['dashboard', 'farms', 'batches', 'hatchery', 'documents', 'notifications', 'reports'],
  'Warehouse Operator': ['dashboard', 'products', 'warehouses', 'inventory', 'transfers', 'stock-ledger', 'feed-health', 'documents', 'notifications'],
  'Procurement Officer': ['dashboard', 'products', 'warehouses', 'suppliers', 'procurement', 'documents', 'notifications'],
  Driver: ['dashboard', 'dispatch', 'fleet', 'vehicles', 'employees', 'vehicle-assignments', 'documents', 'notifications'],
  'CRM / Customer Service Agent': ['dashboard', 'customers', 'leads', 'opportunities', 'follow-ups', 'complaints', 'documents', 'notifications'],
  'Super Admin': [],
  'Read Only': allResources.filter((resource) => !['users-roles', 'administration', 'employees', 'audit'].includes(resource))
};

@Injectable({ providedIn: 'root' })
export class RolePermissionService {
  constructor(private readonly auth: SessionAuthService) {}

  can(resource: string, action: PermissionAction = 'read'): boolean {
    const user = this.auth.currentUser;
    if (!user || user.status.toLowerCase() !== 'active') return false;
    const allowedResources = roleResources[user.role] ?? [];
    if (!allowedResources.includes(resource)) return false;
    const override = this.readOverrides()[user.role];
    if (override) return override.includes(`${resource}.${action}`) || override.includes(`${resource}.*`);
    if (action === 'read') return true;
    if (readOnlyRoles.has(user.role)) return action === 'export' && user.role === 'Owner';
    if (user.role === 'Super Admin') return false;

    if (user.role === 'Organization Admin') {
      if (resource === 'audit' || resource === 'reports' || resource === 'analytics') return action !== 'delete';
      return true;
    }

    const permissions: Record<string, Partial<Record<PermissionAction, string[]>>> = {
      'Farm Manager': {
        create: ['farms', 'sheds', 'batches', 'daily-operations', 'feed', 'health', 'medication', 'expenses'],
        update: ['farms', 'sheds', 'batches', 'daily-operations', 'feed', 'health', 'medication', 'employees'],
        delete: ['daily-operations'],
        transition: ['batches', 'health', 'medication', 'feed']
      },
      'Farm Supervisor': {
        create: ['daily-operations', 'feed', 'health', 'medication'],
        update: ['daily-operations', 'feed', 'health', 'medication'],
        transition: ['health', 'medication', 'feed']
      },
      Veterinarian: {
        create: ['health', 'medication'],
        update: ['health', 'medication'],
        transition: ['health', 'medication']
      },
      'Warehouse Manager': {
        create: ['products', 'warehouses', 'transfers', 'stock-ledger'],
        update: ['products', 'warehouses', 'transfers'],
        delete: ['products', 'warehouses'],
        transition: ['transfers']
      },
      'Procurement Manager': {
        create: ['procurement', 'suppliers', 'expenses'],
        update: ['procurement', 'suppliers', 'expenses'],
        transition: ['procurement', 'expenses'],
        approve: ['procurement', 'expenses']
      },
      'Sales Manager': {
        create: ['customers', 'quotations', 'orders', 'sales', 'dispatch', 'leads', 'opportunities', 'follow-ups', 'complaints'],
        update: ['customers', 'quotations', 'orders', 'sales', 'dispatch', 'leads', 'opportunities', 'follow-ups', 'complaints'],
        transition: ['quotations', 'orders', 'sales', 'dispatch', 'leads', 'opportunities', 'follow-ups', 'complaints'],
        approve: ['orders', 'sales']
      },
      'Sales Executive': {
        create: ['quotations', 'orders', 'leads', 'opportunities', 'follow-ups', 'complaints'],
        update: ['quotations', 'orders', 'leads', 'opportunities', 'follow-ups', 'complaints'],
        transition: ['quotations', 'orders', 'leads', 'opportunities', 'follow-ups', 'complaints']
      },
      Accountant: {
        create: ['payments', 'expenses', 'receivables', 'payables'],
        update: ['payments', 'expenses', 'receivables', 'payables'],
        transition: ['payments', 'expenses', 'receivables', 'payables'],
        approve: ['payments', 'expenses']
      },
      'HR Manager': {
        create: ['employees'],
        update: ['employees'],
        delete: ['employees']
      },
      'Transport Manager': {
        create: ['fleet', 'vehicles', 'employees', 'vehicle-assignments', 'dispatch'],
        update: ['fleet', 'vehicles', 'employees', 'vehicle-assignments', 'dispatch'],
        transition: ['fleet', 'vehicles', 'vehicle-assignments', 'dispatch']
      },
      'Farm Worker / Operator': {
        create: ['daily-operations', 'feed'],
        update: ['daily-operations', 'feed']
      },
      'Production Manager': {
        create: ['daily-operations', 'broiler', 'layer', 'breeder', 'hatchery', 'feed', 'health', 'medication'],
        update: ['daily-operations', 'broiler', 'layer', 'breeder', 'hatchery', 'feed', 'health', 'medication'],
        transition: ['batches', 'hatchery', 'health', 'medication', 'feed']
      },
      'Hatchery Manager / Technician': {
        create: ['hatchery'],
        update: ['hatchery'],
        transition: ['hatchery']
      },
      'Warehouse Operator': {
        create: ['transfers', 'stock-ledger'],
        update: ['transfers'],
        transition: ['transfers']
      },
      'Procurement Officer': {
        create: ['procurement', 'suppliers'],
        update: ['procurement', 'suppliers'],
        transition: ['procurement']
      },
      Driver: {
        update: ['dispatch', 'fleet', 'vehicle-assignments'],
        transition: ['dispatch', 'fleet', 'vehicle-assignments']
      },
      'CRM / Customer Service Agent': {
        create: ['leads', 'opportunities', 'follow-ups', 'complaints'],
        update: ['leads', 'opportunities', 'follow-ups', 'complaints'],
        transition: ['leads', 'opportunities', 'follow-ups', 'complaints']
      }
    };

    if (action === 'export') return ['reports', 'analytics', 'profitability'].includes(resource);
    return (permissions[user.role]?.[action] ?? []).includes(resource);
  }

  canAccessRoute(resource: string): boolean {
    return this.can(resource, 'read');
  }

  canAccessRecord(resource: string, record: Record<string, string | number>): boolean {
    const user = this.auth.currentUser;
    if (!user || !this.canAccessRoute(resource)) return false;
    if (['Organization Admin', 'Owner'].includes(user.role)) return true;
    const assignedScopes = (user.businessUnit ?? '').split(/[;,]/).map((scope) => scope.trim().toLowerCase()).filter(Boolean);
    if (!assignedScopes.length || assignedScopes.some((scope) => ['organization', 'all farms', 'all warehouses'].includes(scope))) return true;
    const farm = String(record['farm'] ?? '').trim().toLowerCase();
    const farmName = String(record['name'] ?? '').trim().toLowerCase();
    const businessUnit = String(record['businessUnit'] ?? '').trim().toLowerCase();
    const warehouse = String(record['warehouse'] ?? '').trim().toLowerCase();
    const location = String(record['location'] ?? '').trim().toLowerCase();
    const scopeValues = [farm, farmName, businessUnit, warehouse, location].filter(Boolean);
    return scopeValues.some((value) => assignedScopes.some((scope) => value === scope || value.includes(scope) || scope.includes(value)));
  }

  get roleNames(): string[] {
    return Object.keys(roleResources).sort((left, right) => left.localeCompare(right));
  }

  getRolePermissions(role: string): string[] {
    const override = this.readOverrides()[role];
    if (override) return override;
    const resources = roleResources[role] ?? [];
    if (readOnlyRoles.has(role)) return resources.map((resource) => `${resource}.read`);
    const actions: PermissionAction[] = ['read', 'create', 'update', 'delete', 'transition', 'approve'];
    if (role === 'Organization Admin') return resources.map((resource) => `${resource}.*`);
    return resources.flatMap((resource) => actions
      .filter((action) => action === 'read' || this.canAsRole(role, resource, action))
      .map((action) => `${resource}.${action}`));
  }

  get permissionActions(): PermissionAction[] {
    return editableActions;
  }

  get permissionResources(): string[] {
    return allResources;
  }

  saveRolePermissions(role: string, permissions: string[]): void {
    if (!this.canManageRoles() || ['Organization Admin', 'Super Admin'].includes(role)) {
      throw new Error('This role permission template cannot be edited.');
    }
    const overrides = this.readOverrides();
    overrides[role] = [...new Set(permissions)];
    localStorage.setItem(overrideStorageKey, JSON.stringify(overrides));
  }

  canManageRoles(): boolean {
    return this.auth.currentUser?.role === 'Organization Admin' &&
      this.auth.currentUser.status.toLowerCase() === 'active';
  }

  private readOverrides(): Record<string, string[]> {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(overrideStorageKey);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Saved demo role permissions are invalid.');
    }
    return parsed as Record<string, string[]>;
  }

  private canAsRole(role: string, resource: string, action: PermissionAction): boolean {
    if (this.auth.currentUser?.role === role) return this.can(resource, action);
    const permittedResources = roleResources[role] ?? [];
    if (!permittedResources.includes(resource) || readOnlyRoles.has(role) || role === 'Super Admin') return false;
    if (role === 'Organization Admin') return true;
    const permissionLists: Record<string, Partial<Record<PermissionAction, string[]>>> = {
      'Farm Manager': { create: ['farms', 'sheds', 'batches', 'daily-operations', 'feed', 'health', 'medication', 'expenses'], update: ['farms', 'sheds', 'batches', 'daily-operations', 'feed', 'health', 'medication', 'employees'], delete: ['daily-operations'], transition: ['batches', 'health', 'medication', 'feed'] },
      'Farm Supervisor': { create: ['daily-operations', 'feed', 'health', 'medication'], update: ['daily-operations', 'feed', 'health', 'medication'], transition: ['health', 'medication', 'feed'] },
      Veterinarian: { create: ['health', 'medication'], update: ['health', 'medication'], transition: ['health', 'medication'] },
      'Warehouse Manager': { create: ['products', 'warehouses', 'transfers', 'stock-ledger'], update: ['products', 'warehouses', 'transfers'], delete: ['products', 'warehouses'], transition: ['transfers'] },
      'Procurement Manager': { create: ['procurement', 'suppliers', 'expenses'], update: ['procurement', 'suppliers', 'expenses'], transition: ['procurement', 'expenses'], approve: ['procurement', 'expenses'] },
      'Sales Manager': { create: ['customers', 'quotations', 'orders', 'sales', 'dispatch', 'leads', 'opportunities', 'follow-ups', 'complaints'], update: ['customers', 'quotations', 'orders', 'sales', 'dispatch', 'leads', 'opportunities', 'follow-ups', 'complaints'], transition: ['quotations', 'orders', 'sales', 'dispatch', 'leads', 'opportunities', 'follow-ups', 'complaints'], approve: ['orders', 'sales'] },
      'Sales Executive': { create: ['quotations', 'orders', 'leads', 'opportunities', 'follow-ups', 'complaints'], update: ['quotations', 'orders', 'leads', 'opportunities', 'follow-ups', 'complaints'], transition: ['quotations', 'orders', 'leads', 'opportunities', 'follow-ups', 'complaints'] },
      Accountant: { create: ['payments', 'expenses', 'receivables', 'payables'], update: ['payments', 'expenses', 'receivables', 'payables'], transition: ['payments', 'expenses', 'receivables', 'payables'], approve: ['payments', 'expenses'] },
      'HR Manager': { create: ['employees'], update: ['employees'], delete: ['employees'] },
      'Transport Manager': { create: ['fleet', 'vehicles', 'employees', 'vehicle-assignments', 'dispatch'], update: ['fleet', 'vehicles', 'employees', 'vehicle-assignments', 'dispatch'], transition: ['fleet', 'vehicles', 'vehicle-assignments', 'dispatch'] },
      'Farm Worker / Operator': { create: ['daily-operations', 'feed'], update: ['daily-operations', 'feed'] },
      'Production Manager': { create: ['daily-operations', 'broiler', 'layer', 'breeder', 'hatchery', 'feed', 'health', 'medication'], update: ['daily-operations', 'broiler', 'layer', 'breeder', 'hatchery', 'feed', 'health', 'medication'], transition: ['batches', 'hatchery', 'health', 'medication', 'feed'] },
      'Hatchery Manager / Technician': { create: ['hatchery'], update: ['hatchery'], transition: ['hatchery'] },
      'Warehouse Operator': { create: ['transfers', 'stock-ledger'], update: ['transfers'], transition: ['transfers'] },
      'Procurement Officer': { create: ['procurement', 'suppliers'], update: ['procurement', 'suppliers'], transition: ['procurement'] },
      Driver: { update: ['dispatch', 'fleet', 'vehicle-assignments'], transition: ['dispatch', 'fleet', 'vehicle-assignments'] },
      'CRM / Customer Service Agent': { create: ['leads', 'opportunities', 'follow-ups', 'complaints'], update: ['leads', 'opportunities', 'follow-ups', 'complaints'], transition: ['leads', 'opportunities', 'follow-ups', 'complaints'] }
    };
    if (action === 'export') return ['reports', 'analytics', 'profitability'].includes(resource);
    return (permissionLists[role]?.[action] ?? []).includes(resource);
  }
}
