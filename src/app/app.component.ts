import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { HeaderControlsComponent } from './common/components/header-controls/header-controls.component';
import { ToastContainerComponent } from './common/components/toast-container/toast-container.component';
import { navigationScreenResources } from './common/config/screen-visibility.config';
import { RolePermissionService } from './common/services/role-permission.service';
import { SessionAuthService } from './common/services/session-auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [HeaderControlsComponent, ToastContainerComponent, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  mobileNavigationOpen = false;

  constructor(
    readonly auth: SessionAuthService,
    private readonly rolePermissions: RolePermissionService,
    private readonly router: Router
  ) {}

  readonly expandedGroups: Record<string, boolean> = Object.fromEntries(
    ['Platform', 'Logistics', 'Entities', 'Farm operations', 'Inventory', 'Customer relations', 'Finance', 'Administration']
      .map((label) => [label, false])
  );

  readonly navigation = [
    {
      label: 'Platform',
      links: [
        { label: 'Tenants', path: '/tenants', icon: 'organization' }
      ]
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
      label: 'Customer relations',
      links: [
        { label: 'Leads', path: '/customer-relations/leads', icon: 'leads' },
        { label: 'Opportunities', path: '/customer-relations/opportunities', icon: 'opportunities' },
        { label: 'Follow-ups', path: '/customer-relations/follow-ups', icon: 'followups' },
        { label: 'Complaints', path: '/customer-relations/complaints', icon: 'complaints' }
      ]
    },
    {
      label: 'Logistics',
      links: [
        { label: 'Overview', path: '/people-logistics/overview', icon: 'dispatch' },
        { label: 'Trips', path: '/people-logistics/trips', icon: 'dispatch' },
        { label: 'Deliveries', path: '/people-logistics/deliveries', icon: 'dispatch' }
      ]
    },
    {
      label: 'Entities',
      links: [
        { label: 'Sundry Creditors', path: '/people-logistics/buying-parties', icon: 'suppliers' },
        { label: 'Sundry Debtors', path: '/people-logistics/selling-parties', icon: 'customers' },
        { label: 'Vehicles', path: '/people-logistics/vehicles', icon: 'fleet' }
      ]
    },
    {
      label: 'Finance',
      links: [
        { label: 'Finance overview', path: '/finance/overview', icon: 'finance' },
        { label: 'Receivables', path: '/finance/receivables', icon: 'receivables' },
        { label: 'Payables', path: '/finance/payables', icon: 'payables' },
        { label: 'Payments', path: '/finance/payments', icon: 'payments' },
        { label: 'Trip payment summary', path: '/finance/trip-summary', icon: 'finance' },
        { label: 'Expenses', path: '/finance/expenses', icon: 'expenses' },
        { label: 'Profitability', path: '/finance/profitability', icon: 'profitability' }
      ]
    },
    {
      label: 'Administration',
      links: [
        { label: 'Employees', path: '/people-logistics/employees', icon: 'employees' },
        { label: 'Roles & permissions', path: '/roles', icon: 'users' }
      ]
    }
  ];

  get showApplicationShell(): boolean {
    return !!this.auth.currentUser && !this.router.url.startsWith('/info');
  }

  get visibleNavigation(): typeof this.navigation {
    return this.navigation
      .map((group) => ({
        ...group,
        links: group.links.filter((link) =>
          this.rolePermissions.canAccessRoute(navigationScreenResources[link.path] ?? '')
        )
      }))
      .filter((group) => group.links.length > 0);
  }

  get organizationName(): string {
    return this.auth.currentUser?.tenantName?.trim() || 'Product Owner';
  }

  get organizationInitial(): string {
    return this.organizationName.charAt(0).toUpperCase();
  }

  get userInitials(): string {
    return (this.auth.currentUser?.name ?? 'User')
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  toggleGroup(label: string): void {
    this.expandedGroups[label] = !this.expandedGroups[label];
  }

  closeNavigation(): void {
    this.closeMobileNavigation();
  }

  toggleMobileNavigation(): void {
    this.mobileNavigationOpen = !this.mobileNavigationOpen;
  }

  closeMobileNavigation(): void {
    this.mobileNavigationOpen = false;
  }

}
