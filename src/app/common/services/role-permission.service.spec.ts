import { UserSession } from '../models/auth.model';
import { RolePermissionService } from './role-permission.service';
import { SessionAuthService } from './session-auth.service';

describe('RolePermissionService', () => {
  let service: RolePermissionService;
  let currentUser: UserSession;

  beforeEach(() => {
    currentUser = {
      name: 'Test User',
      email: 'test@example.com',
      role: 'Sales Manager',
      permissions: '',
      status: 'Active',
      authenticatedAt: new Date().toISOString()
    };
    const auth = jasmine.createSpyObj<SessionAuthService>('SessionAuthService', [], ['currentUser']);
    Object.defineProperty(auth, 'currentUser', { get: () => currentUser });
    service = new RolePermissionService(auth);
  });

  it('uses the central policy for all role resource and action checks', () => {
    expect(service.canAccessRoute('trips')).toBeTrue();
    expect(service.can('trips', 'create')).toBeTrue();
    expect(service.can('trips', 'update')).toBeTrue();
    expect(service.can('trips', 'delete')).toBeTrue();
    expect(service.can('trips', 'transition')).toBeTrue();
    expect(service.can('trips', 'approve')).toBeFalse();

    currentUser.role = 'Warehouse Manager';
    expect(service.canAccessRoute('inventory')).toBeTrue();
    expect(service.canAccessRoute('trips')).toBeFalse();
    expect(service.can('inventory', 'update')).toBeFalse();
  });

  it('routes delivery-only roles to deliveries and roles without access to access denied', () => {
    for (const role of ['Driver', 'Supervisor']) {
      currentUser.role = role;
      expect(service.canAccessRoute('deliveries')).toBeTrue();
      expect(service.canAccessRoute('trips')).toBeFalse();
      expect(service.getDefaultRoute()).toBe('/people-logistics/deliveries');
    }

    currentUser.role = 'Super Admin';
    expect(service.getDefaultRoute()).toBe('/access-denied');
  });

  it('does not route inactive users to a protected screen', () => {
    currentUser.role = 'Driver';
    currentUser.status = 'Inactive';

    expect(service.getDefaultRoute()).toBe('/access-denied');
  });

  it('grants Organization Admin access from the central policy, including role management', () => {
    currentUser.role = 'Organization Admin';

    expect(service.canAccessRoute('users-roles')).toBeTrue();
    expect(service.can('employees', 'update')).toBeTrue();
    expect(service.can('employees', 'delete')).toBeTrue();
    expect(service.can('reports', 'delete')).toBeFalse();
    expect(service.canManageRoles()).toBeTrue();
    expect(service.getRolePermissions('Organization Admin')).toContain('employees.*');
  });

  it('does not use browser-stored role overrides', () => {
    currentUser.role = 'Farm Manager';
    spyOn(localStorage, 'getItem').and.returnValue(JSON.stringify({
      'Farm Manager': ['inventory.read', 'users-roles.*']
    }));

    expect(service.canAccessRoute('farms')).toBeTrue();
    expect(service.canAccessRoute('inventory')).toBeFalse();
    expect(service.canAccessRoute('users-roles')).toBeFalse();
    expect(localStorage.getItem).not.toHaveBeenCalled();
  });

  it('allows generic authenticated sessions the configured read access only', () => {
    currentUser.role = 'Authenticated';

    expect(service.canAccessRoute('dashboard')).toBeTrue();
    expect(service.canAccessRoute('employees')).toBeTrue();
    expect(service.can('employees', 'create')).toBeTrue();
    expect(service.can('employees', 'update')).toBeFalse();
    expect(service.can('users-roles', 'manage')).toBeFalse();
  });

  it('denies access to inactive users', () => {
    currentUser.status = 'Inactive';

    expect(service.canAccessRoute('dashboard')).toBeFalse();
    expect(service.canManageRoles()).toBeFalse();
  });
});
