import { Injectable } from '@angular/core';
import { PermissionAction } from '../models/auth.model';
import {
  canRoleAccess,
  getDefaultRouteForRole,
  navigationScreenResources,
  permissionActions as configuredActions,
  recordScopeBypassRoles,
  roleVisibility
} from '../config/screen-visibility.config';
import { SessionAuthService } from './session-auth.service';

@Injectable({ providedIn: 'root' })
export class RolePermissionService {
  constructor(private readonly auth: SessionAuthService) { }

  can(resource: string, action: PermissionAction = 'read'): boolean {
    const user = this.auth.currentUser;
    return !!user && user.status.toLowerCase() === 'active' && canRoleAccess(user.role, resource, action);
  }

  canAccessRoute(resource: string): boolean {
    return this.can(resource, 'read');
  }

  getDefaultRoute(): string {
    const user = this.auth.currentUser;
    const route = user ? getDefaultRouteForRole(user.role) : '/access-denied';
    const resource = navigationScreenResources[route];
    return resource && this.canAccessRoute(resource) ? route : '/access-denied';
  }

  canAccessRecord(resource: string, record: Record<string, string | number>): boolean {
    const user = this.auth.currentUser;
    if (!user || !this.canAccessRoute(resource)) return false;
    if (recordScopeBypassRoles.includes(user.role)) return true;
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
    return Object.keys(roleVisibility)
      .filter((role) => !['Authenticated', 'Supervisor'].includes(role))
      .sort((left, right) => left.localeCompare(right));
  }

  getRolePermissions(role: string): string[] {
    const resources = roleVisibility[role]?.resources ?? [];
    if (role === 'Organization Admin') return resources.map((resource) => `${resource}.*`);
    return resources.flatMap((resource) => configuredActions
      .filter((action) => canRoleAccess(role, resource, action))
      .map((action) => `${resource}.${action}`));
  }

  canManageRoles(): boolean {
    return this.can('users-roles', 'manage');
  }
}
