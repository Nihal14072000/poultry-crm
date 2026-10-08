import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { HeaderControlsComponent } from './common/components/header-controls/header-controls.component';
import { RolePermissionService } from './common/services/role-permission.service';
import { SessionAuthService } from './common/services/session-auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [HeaderControlsComponent, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  constructor(
    readonly auth: SessionAuthService,
    private readonly rolePermissions: RolePermissionService
  ) {}

  readonly expandedGroups: Record<string, boolean> = Object.fromEntries(
    ['Workspace', 'Farm operations', 'Inventory', 'Trading', 'Customer relations', 'People & logistics', 'Finance', 'Insights & admin']
      .map((label) => [label, false])
  );

  readonly navigation = [
    {
      label: 'Workspace',
      links: [{ label: 'Overview', path: '/workspace/overview', icon: 'overview' }]
    },
    {
      label: 'Farm operations',
      links: [
        { label: 'Farms & sheds', path: '/farm-operations/farms', icon: 'farm' },
        { label: 'Shed capacity', path: '/farm-operations/sheds', icon: 'farm' },
        { label: 'Flocks & batches', path: '/farm-operations/batches', icon: 'flock' },
        { label: 'Daily operations', path: '/farm-operations/daily-operations', icon: 'daily' },
        { label: 'Broiler', path: '/farm-operations/broiler', icon: 'broiler' },
        { label: 'Layer', path: '/farm-operations/layer', icon: 'layer' },
        { label: 'Breeder', path: '/farm-operations/breeder', icon: 'breeder' },
        { label: 'Hatchery', path: '/farm-operations/hatchery', icon: 'hatchery' },
        { label: 'Health', path: '/farm-operations/health', icon: 'health' },
        { label: 'Medication & vaccines', path: '/farm-operations/medication', icon: 'medication' },
        { label: 'Feed management', path: '/farm-operations/feed', icon: 'feed' }
      ]
    },
    {
      label: 'Inventory',
      links: [
        { label: 'Products', path: '/inventory/products', icon: 'products' },
        { label: 'Warehouses', path: '/inventory/warehouses', icon: 'warehouse' },
        { label: 'Inventory', path: '/inventory/stock', icon: 'inventory' },
        { label: 'Stock transfers', path: '/inventory/transfers', icon: 'transfer' },
        { label: 'Stock ledger', path: '/inventory/stock-ledger', icon: 'ledger' }
      ]
    },
    {
      label: 'Trading',
      links: [
        { label: 'Customers', path: '/trading/customers', icon: 'customers' },
        { label: 'Suppliers', path: '/trading/suppliers', icon: 'suppliers' },
        { label: 'Sales & dispatch', path: '/trading/sales', icon: 'sales' },
        { label: 'Order desk', path: '/trading/order-desk', icon: 'orders' },
        { label: 'Quotations', path: '/trading/quotations', icon: 'quotes' },
        { label: 'Orders', path: '/trading/orders', icon: 'orders' },
        { label: 'Procurement', path: '/trading/procurement', icon: 'procurement' },
        { label: 'Dispatch', path: '/trading/dispatch', icon: 'dispatch' }
      ]
    },
    {
      label: 'Customer relations',
      links: [
        { label: 'Leads', path: '/customer-relations/leads', icon: 'leads' },
        { label: 'Opportunities', path: '/customer-relations/opportunities', icon: 'opportunities' },
        { label: 'Follow-ups', path: '/customer-relations/follow-ups', icon: 'followups' },
        { label: 'Complaints', path: '/customer-relations/complaints', icon: 'complaints' }
      ]
    },
    {
      label: 'People & logistics',
      links: [
        { label: 'Employees', path: '/people-logistics/employees', icon: 'employees' },
        { label: 'Vehicles', path: '/people-logistics/vehicles', icon: 'fleet' },
        { label: 'Vehicle assignments', path: '/people-logistics/vehicle-assignments', icon: 'dispatch' }
      ]
    },
    {
      label: 'Finance',
      links: [
        { label: 'Finance overview', path: '/finance/overview', icon: 'finance' },
        { label: 'Receivables', path: '/finance/receivables', icon: 'receivables' },
        { label: 'Payables', path: '/finance/payables', icon: 'payables' },
        { label: 'Payments', path: '/finance/payments', icon: 'payments' },
        { label: 'Expenses', path: '/finance/expenses', icon: 'expenses' },
        { label: 'Profitability', path: '/finance/profitability', icon: 'profitability' }
      ]
    },
    {
      label: 'Insights & admin',
      links: [
        { label: 'Reports', path: '/insights-admin/reports', icon: 'reports' },
        { label: 'Analytics', path: '/insights-admin/analytics', icon: 'analytics' },
        { label: 'Notifications', path: '/insights-admin/notifications', icon: 'notifications' },
        { label: 'Organization', path: '/insights-admin/organization', icon: 'organization' },
        { label: 'Users & roles', path: '/insights-admin/users-roles', icon: 'users' },
        { label: 'Documents', path: '/insights-admin/documents', icon: 'documents' },
        { label: 'Audit history', path: '/insights-admin/audit', icon: 'audit' },
        { label: 'Administration', path: '/insights-admin/administration', icon: 'administration' }
      ]
    }
  ];

  get visibleNavigation(): typeof this.navigation {
    return this.navigation
      .map((group) => ({
        ...group,
        links: group.links.filter((link) => this.rolePermissions.canAccessRoute(this.resourceForPath(link.path)))
      }))
      .filter((group) => group.links.length > 0);
  }

  get userInitials(): string {
    return (this.auth.currentUser?.name ?? 'User')
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  private resourceForPath(path: string): string {
    const segment = path.split('/').filter(Boolean).pop() ?? 'dashboard';
    const routeResources: Record<string, string> = {
      overview: 'dashboard',
      farms: 'farms',
      sheds: 'sheds',
      batches: 'batches',
      'daily-operations': 'daily-operations',
      'order-desk': 'orders',
      'feed-health': 'feed-health',
      'stock': 'inventory',
      'finance': 'finance',
      'receivables': 'receivables',
      'payables': 'payables',
      'payments': 'payments',
      'profitability': 'profitability',
      'reports': 'reports',
      'analytics': 'analytics',
      'notifications': 'notifications',
      'organization': 'organization',
      'users-roles': 'users-roles',
      'administration': 'administration',
      'audit': 'audit'
    };
    if (path === '/finance/overview') return 'finance';
    if (path === '/workspace/overview') return 'dashboard';
    return routeResources[segment] ?? segment;
  }

  toggleGroup(label: string): void {
    this.expandedGroups[label] = !this.expandedGroups[label];
  }

  closeNavigationGroups(): void {
    for (const group of Object.keys(this.expandedGroups)) {
      this.expandedGroups[group] = false;
    }
  }

}
