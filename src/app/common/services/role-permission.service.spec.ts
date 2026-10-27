import { UserSession } from '../models/auth.model';
import { RolePermissionService } from './role-permission.service';
import { SessionAuthService } from './session-auth.service';

describe('RolePermissionService trips permissions', () => {
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

  it('allows Sales Managers to read, create, and update trips only', () => {
    expect(service.can('trips', 'read')).toBeTrue();
    expect(service.can('trips', 'create')).toBeTrue();
    expect(service.can('trips', 'update')).toBeTrue();
    expect(service.can('trips', 'delete')).toBeFalse();
  });

  it('allows other active roles to view trips but not change them', () => {
    currentUser.role = 'Organization Admin';

    expect(service.can('trips', 'read')).toBeTrue();
    expect(service.can('trips', 'create')).toBeFalse();
    expect(service.can('trips', 'update')).toBeFalse();
    expect(service.getRolePermissions('Organization Admin')).toContain('trips.read');
    expect(service.getRolePermissions('Organization Admin')).not.toContain('trips.*');
  });

  it('allows employee creation requests but leaves write authorization to the backend', () => {
    currentUser.role = 'Authenticated';

    expect(service.canAccessRoute('dashboard')).toBeTrue();
    expect(service.canAccessRoute('employees')).toBeTrue();
    expect(service.can('employees', 'create')).toBeTrue();
    expect(service.can('employees', 'update')).toBeFalse();
    expect(service.can('users-roles', 'update')).toBeFalse();
  });
});
