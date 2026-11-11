import { PermissionAction } from '../models/auth.model';

export const screenResources = [
  'dashboard', 'farms', 'sheds', 'batches', 'daily-operations', 'broiler', 'layer', 'breeder', 'hatchery',
  'feed-health', 'feed', 'health', 'medication', 'products', 'warehouses', 'inventory', 'transfers',
  'stock-ledger', 'suppliers', 'vendor-destinations', 'procurement', 'customers', 'quotations', 'orders', 'sales', 'dispatch',
  'leads', 'opportunities', 'follow-ups', 'complaints', 'employees', 'fleet', 'vehicles', 'vehicle-assignments', 'trips', 'finance', 'receivables',
  'payables', 'payments', 'expenses', 'profitability', 'reports', 'analytics', 'notifications',
  'organization', 'users-roles', 'documents', 'audit', 'administration' , 'deliveries'
] as const;

type ScreenResource = typeof screenResources[number];
type ActionGrants = Partial<Record<PermissionAction, readonly ScreenResource[]>>;

interface RoleVisibility {
  resources: readonly ScreenResource[];
  actions?: ActionGrants;
}

export const enabledFeatures = [
  'employees', 'fleet', 'vehicles', 'trips', 'finance',
  'payments', 'expenses', 'reports', 'analytics', 'notifications',
  'organization', 'users-roles', 'documents', 'audit', 'administration' , 'deliveries'
] as const;

const allScreens: readonly ScreenResource[] = enabledFeatures;
const organizationAdminScreens: readonly ScreenResource[] = [...allScreens, 'suppliers', 'vendor-destinations'];
const organizationAdminActions: ActionGrants = {
  create: organizationAdminScreens,
  update: organizationAdminScreens,
  delete: organizationAdminScreens.filter((resource) => !['audit', 'reports', 'analytics'].includes(resource)),
  transition: organizationAdminScreens,
  approve: organizationAdminScreens,
  export: organizationAdminScreens,
  manage: organizationAdminScreens
};

export const roleVisibility: Record<string, RoleVisibility> = {
  'Organization Admin': { resources: organizationAdminScreens, actions: organizationAdminActions },
  Owner: { resources: allScreens, actions: { export: ['reports', 'analytics', 'profitability'] } },
  'Farm Manager': {
    resources: ['dashboard', 'farms', 'sheds', 'batches', 'daily-operations', 'broiler', 'layer', 'breeder', 'hatchery', 'feed-health', 'feed', 'health', 'medication', 'employees', 'documents', 'notifications', 'reports', 'analytics', 'audit'],
    actions: {
      create: ['farms', 'sheds', 'batches', 'daily-operations', 'feed', 'health', 'medication', 'expenses'],
      update: ['farms', 'sheds', 'batches', 'daily-operations', 'feed', 'health', 'medication', 'employees'],
      delete: ['daily-operations'],
      transition: ['batches', 'health', 'medication', 'feed']
    }
  },
  'Farm Supervisor': {
    resources: ['dashboard', 'farms', 'sheds', 'batches', 'daily-operations', 'broiler', 'layer', 'breeder', 'feed-health', 'feed', 'health', 'medication', 'trips', 'documents', 'notifications'],
    actions: {
      create: ['daily-operations', 'feed', 'health', 'medication'],
      update: ['daily-operations', 'feed', 'health', 'medication'],
      transition: ['health', 'medication', 'feed', 'trips']
    }
  },
  Veterinarian: {
    resources: ['dashboard', 'farms', 'sheds', 'batches', 'daily-operations', 'health', 'medication', 'feed-health', 'documents', 'notifications', 'reports'],
    actions: {
      create: ['health', 'medication'],
      update: ['health', 'medication'],
      transition: ['health', 'medication']
    }
  },
  'Warehouse Manager': {
    resources: ['dashboard', 'products', 'warehouses', 'inventory', 'transfers', 'stock-ledger', 'suppliers', 'feed-health', 'documents', 'notifications', 'reports'],
    actions: {
      create: ['products', 'warehouses', 'transfers', 'stock-ledger'],
      update: ['products', 'warehouses', 'transfers'],
      delete: ['products', 'warehouses'],
      transition: ['transfers']
    }
  },
  'Procurement Manager': {
    resources: ['dashboard', 'products', 'warehouses', 'inventory', 'transfers', 'stock-ledger', 'suppliers', 'procurement', 'expenses', 'documents', 'notifications', 'reports'],
    actions: {
      create: ['procurement', 'suppliers', 'expenses'],
      update: ['procurement', 'suppliers', 'expenses'],
      transition: ['procurement', 'expenses'],
      approve: ['procurement', 'expenses']
    }
  },
  'Sales Manager': {
    resources: ['dashboard', 'customers', 'quotations', 'orders', 'sales', 'dispatch', 'leads', 'opportunities', 'follow-ups', 'complaints', 'products', 'receivables', 'suppliers', 'vendor-destinations', 'vehicles', 'employees', 'trips', 'documents', 'notifications', 'reports', 'analytics'],
    actions: {
      create: ['customers', 'quotations', 'orders', 'sales', 'dispatch', 'trips', 'vendor-destinations', 'leads', 'opportunities', 'follow-ups', 'complaints'],
      update: ['customers', 'quotations', 'orders', 'sales', 'dispatch', 'trips', 'vendor-destinations', 'leads', 'opportunities', 'follow-ups', 'complaints'],
      delete: ['trips'],
      transition: ['quotations', 'orders', 'sales', 'dispatch', 'trips', 'leads', 'opportunities', 'follow-ups', 'complaints'],
      approve: ['orders', 'sales']
    }
  },
  'Sales Executive': {
    resources: ['dashboard', 'customers', 'quotations', 'orders', 'sales', 'dispatch', 'leads', 'opportunities', 'follow-ups', 'complaints', 'products', 'documents', 'notifications'],
    actions: {
      create: ['quotations', 'orders', 'leads', 'opportunities', 'follow-ups', 'complaints'],
      update: ['quotations', 'orders', 'leads', 'opportunities', 'follow-ups', 'complaints'],
      transition: ['quotations', 'orders', 'leads', 'opportunities', 'follow-ups', 'complaints']
    }
  },
  Accountant: {
    resources: ['dashboard', 'finance', 'receivables', 'payables', 'payments', 'expenses', 'profitability', 'sales', 'procurement', 'reports', 'analytics', 'documents', 'notifications', 'audit'],
    actions: {
      create: ['payments', 'expenses', 'receivables', 'payables'],
      update: ['payments', 'expenses', 'receivables', 'payables'],
      transition: ['payments', 'expenses', 'receivables', 'payables'],
      approve: ['payments', 'expenses']
    }
  },
  'HR Manager': {
    resources: ['dashboard', 'employees', 'administration', 'documents', 'notifications', 'reports'],
    actions: { create: ['employees'], update: ['employees'], delete: ['employees'] }
  },
  'Transport Manager': {
    resources: ['dashboard', 'fleet', 'vehicles', 'employees', 'vehicle-assignments', 'dispatch', 'sales', 'customers', 'documents', 'notifications', 'reports'],
    actions: {
      create: ['fleet', 'vehicles', 'employees', 'vehicle-assignments', 'dispatch'],
      update: ['fleet', 'vehicles', 'employees', 'vehicle-assignments', 'dispatch'],
      transition: ['fleet', 'vehicles', 'vehicle-assignments', 'dispatch']
    }
  },
  'Farm Worker / Operator': {
    resources: ['dashboard', 'farms', 'sheds', 'batches', 'daily-operations', 'feed', 'documents', 'notifications'],
    actions: { create: ['daily-operations', 'feed'], update: ['daily-operations', 'feed'] }
  },
  'Production Manager': {
    resources: ['dashboard', 'farms', 'sheds', 'batches', 'daily-operations', 'broiler', 'layer', 'breeder', 'hatchery', 'feed', 'health', 'medication', 'reports', 'analytics', 'documents', 'notifications'],
    actions: {
      create: ['daily-operations', 'broiler', 'layer', 'breeder', 'hatchery', 'feed', 'health', 'medication'],
      update: ['daily-operations', 'broiler', 'layer', 'breeder', 'hatchery', 'feed', 'health', 'medication'],
      transition: ['batches', 'hatchery', 'health', 'medication', 'feed']
    }
  },
  'Hatchery Manager / Technician': {
    resources: ['dashboard', 'farms', 'batches', 'hatchery', 'documents', 'notifications', 'reports'],
    actions: { create: ['hatchery'], update: ['hatchery'], transition: ['hatchery'] }
  },
  'Warehouse Operator': {
    resources: ['dashboard', 'products', 'warehouses', 'inventory', 'transfers', 'stock-ledger', 'feed-health', 'documents', 'notifications'],
    actions: { create: ['transfers', 'stock-ledger'], update: ['transfers'], transition: ['transfers'] }
  },
  'Procurement Officer': {
    resources: ['dashboard', 'products', 'warehouses', 'suppliers', 'procurement', 'documents', 'notifications'],
    actions: { create: ['procurement', 'suppliers'], update: ['procurement', 'suppliers'], transition: ['procurement'] }
  },
  Driver: {
    resources: ['deliveries'],
    actions: { update: ['deliveries'], transition: ['deliveries'] }
  },
  Supervisor: {
    resources: ['deliveries'],
    actions: { update: ['deliveries'], transition: ['deliveries'] }
  },
  'CRM / Customer Service Agent': {
    resources: ['dashboard', 'customers', 'leads', 'opportunities', 'follow-ups', 'complaints', 'documents', 'notifications'],
    actions: {
      create: ['leads', 'opportunities', 'follow-ups', 'complaints'],
      update: ['leads', 'opportunities', 'follow-ups', 'complaints'],
      transition: ['leads', 'opportunities', 'follow-ups', 'complaints']
    }
  },
  'Super Admin': { resources: [] },
  'Read Only': { resources: allScreens.filter((resource) => !['users-roles', 'administration', 'employees', 'audit'].includes(resource)) },
  Authenticated: { resources: allScreens, actions: { create: ['employees'] } },
};

export const recordScopeBypassRoles = ['Organization Admin', 'Owner'];

const employeeRoles: Record<string, string> = {
  DRIVER: 'Driver',
  SUPERVISOR: 'Supervisor',
  ACCOUNTANT: 'Accountant',
  LABOUR: 'Labour'
};

export function resolveAccountRole(role: string): string {
  if (role === 'ADMIN') return 'Organization Admin';
  const employeeRole = employeeRoles[role.toUpperCase()];
  if (employeeRole) return employeeRole;
  return roleVisibility[role] ? role : 'Authenticated';
}

export const navigationScreenResources: Record<string, ScreenResource> = {
  '/workspace/overview': 'dashboard',
  '/workspace/people-logistics': 'dashboard',
  '/farm-operations/farms': 'farms',
  '/farm-operations/sheds': 'sheds',
  '/farm-operations/batches': 'batches',
  '/farm-operations/daily-operations': 'daily-operations',
  '/farm-operations/broiler': 'broiler',
  '/farm-operations/layer': 'layer',
  '/farm-operations/breeder': 'breeder',
  '/farm-operations/hatchery': 'hatchery',
  '/farm-operations/health': 'health',
  '/farm-operations/medication': 'medication',
  '/farm-operations/feed': 'feed',
  '/inventory/products': 'products',
  '/inventory/warehouses': 'warehouses',
  '/inventory/stock': 'inventory',
  '/inventory/transfers': 'transfers',
  '/inventory/stock-ledger': 'stock-ledger',
  '/trading/sales': 'sales',
  '/trading/order-desk': 'orders',
  '/trading/quotations': 'quotations',
  '/trading/orders': 'orders',
  '/trading/procurement': 'procurement',
  '/trading/dispatch': 'dispatch',
  '/customer-relations/leads': 'leads',
  '/customer-relations/opportunities': 'opportunities',
  '/customer-relations/follow-ups': 'follow-ups',
  '/customer-relations/complaints': 'complaints',
  '/people-logistics/employees': 'employees',
  '/people-logistics/buying-parties': 'suppliers',
  '/people-logistics/selling-parties': 'vendor-destinations',
  '/people-logistics/vehicles': 'vehicles',
  '/people-logistics/vehicle-assignments': 'vehicle-assignments',
  '/people-logistics/trips': 'trips',
  '/people-logistics/deliveries': 'deliveries',
  '/finance/overview': 'finance',
  '/finance/receivables': 'receivables',
  '/finance/payables': 'payables',
  '/finance/payments': 'payments',
  '/finance/trip-summary': 'finance',
  '/finance/expenses': 'expenses',
  '/finance/profitability': 'profitability',
  '/insights-admin/reports': 'reports',
  '/insights-admin/analytics': 'analytics',
  '/insights-admin/notifications': 'notifications',
  '/insights-admin/organization': 'organization',
  '/insights-admin/users-roles': 'users-roles',
  '/insights-admin/documents': 'documents',
  '/insights-admin/audit': 'audit',
  '/insights-admin/administration': 'administration'
};

export const permissionActions: PermissionAction[] = ['read', 'create', 'update', 'delete', 'transition', 'approve', 'export'];

export function canRoleAccess(role: string, resource: string, action: PermissionAction): boolean {
  const visibility = roleVisibility[role];
  if (!visibility?.resources.includes(resource as ScreenResource)) return false;
  return action === 'read' || !!visibility.actions?.[action]?.includes(resource as ScreenResource);
}

export const roleDefaultRoutes: Record<string, string> = Object.fromEntries(
  Object.keys(roleVisibility).map((role) => [
    role,
    Object.entries(navigationScreenResources)
      .find(([, resource]) => canRoleAccess(role, resource, 'read'))?.[0] ?? '/access-denied'
  ])
);

export function getDefaultRouteForRole(role: string): string {
  return roleDefaultRoutes[role] ?? roleDefaultRoutes['Authenticated'] ?? '/access-denied';
}
