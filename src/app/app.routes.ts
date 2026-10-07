import { Route, Routes } from '@angular/router';
import { DirectoryColumn } from './common/models/directory.model';
import { requirePermissionGuard, requireSessionGuard, signedOutOnlyGuard } from './common/services/auth-guards';

interface DirectoryPage {
  path: string;
  title: string;
  description: string;
  resource: string;
  columns: DirectoryColumn[];
  mode?: 'editable' | 'append-only' | 'read-only';
  production?: boolean;
}

const farmOperations: DirectoryPage[] = [
  { path: 'farms', title: 'Farms & sheds', description: 'Manage farm locations, shed capacity and current bird occupancy.', resource: 'farms', columns: [{ key: 'code', label: 'FARM CODE' }, { key: 'name', label: 'FARM NAME' }, { key: 'location', label: 'LOCATION' }, { key: 'sheds', label: 'SHEDS' }, { key: 'capacity', label: 'CAPACITY' }, { key: 'birds', label: 'ACTIVE BIRDS' }, { key: 'status', label: 'STATUS' }] },
  { path: 'sheds', title: 'Poultry sheds', description: 'Review shed capacity, current occupancy and available placement space.', resource: 'sheds', columns: [{ key: 'code', label: 'SHED CODE' }, { key: 'name', label: 'SHED' }, { key: 'farm', label: 'FARM' }, { key: 'type', label: 'TYPE' }, { key: 'capacity', label: 'CAPACITY' }, { key: 'occupancy', label: 'OCCUPANCY' }, { key: 'status', label: 'STATUS' }] },
  { path: 'batches', title: 'Flocks & batches', description: 'Follow flock placement, lifecycle, age, weight and performance across your farms.', resource: 'batches', columns: [{ key: 'batch', label: 'BATCH' }, { key: 'farm', label: 'FARM' }, { key: 'shed', label: 'SHED' }, { key: 'type', label: 'TYPE' }, { key: 'breed', label: 'BREED' }, { key: 'placementDate', label: 'PLACED' }, { key: 'initialBirds', label: 'PLACED BIRDS' }, { key: 'birds', label: 'CURRENT BIRDS' }, { key: 'age', label: 'AGE' }, { key: 'averageWeight', label: 'AVG. WEIGHT' }, { key: 'targetWeight', label: 'TARGET WEIGHT' }, { key: 'fcr', label: 'FCR' }, { key: 'status', label: 'STATUS' }] },
  { path: 'feed-health', title: 'Feed & health', description: 'Monitor feed availability and health supplies that need attention.', resource: 'feed-health', columns: [{ key: 'item', label: 'ITEM' }, { key: 'category', label: 'CATEGORY' }, { key: 'location', label: 'LOCATION' }, { key: 'onHand', label: 'ON HAND' }, { key: 'nextAction', label: 'NEXT ACTION' }, { key: 'status', label: 'STATUS' }] },
  { path: 'broiler', title: 'Broiler performance', description: 'Monitor broiler growth, weight, feed conversion and flock readiness.', resource: 'broiler', production: true, columns: [{ key: 'batch', label: 'BATCH' }, { key: 'farm', label: 'FARM' }, { key: 'age', label: 'AGE' }, { key: 'birds', label: 'LIVE BIRDS' }, { key: 'averageWeight', label: 'AVG. WEIGHT' }, { key: 'fcr', label: 'FCR' }, { key: 'status', label: 'STATUS' }] },
  { path: 'layer', title: 'Layer production', description: 'Review flock production, saleable eggs and feed use.', resource: 'layer', production: true, columns: [{ key: 'batch', label: 'FLOCK' }, { key: 'farm', label: 'FARM' }, { key: 'birds', label: 'LIVE BIRDS' }, { key: 'eggsToday', label: 'EGGS TODAY' }, { key: 'production', label: 'PRODUCTION' }, { key: 'feed', label: 'FEED / DAY' }, { key: 'status', label: 'STATUS' }] },
  { path: 'breeder', title: 'Breeder operations', description: 'Track breeder flock ratios, fertility and hatchable egg output.', resource: 'breeder', production: true, columns: [{ key: 'flock', label: 'FLOCK' }, { key: 'farm', label: 'FARM' }, { key: 'females', label: 'FEMALES' }, { key: 'males', label: 'MALES' }, { key: 'fertility', label: 'FERTILITY' }, { key: 'eggsToday', label: 'EGGS TODAY' }, { key: 'status', label: 'STATUS' }] },
  { path: 'hatchery', title: 'Hatchery', description: 'Follow egg setting, candling, hatch results and chick grading.', resource: 'hatchery', production: true, columns: [{ key: 'set', label: 'SET ID' }, { key: 'setDate', label: 'SET DATE' }, { key: 'eggsSet', label: 'EGGS SET' }, { key: 'fertile', label: 'FERTILE' }, { key: 'hatched', label: 'HATCHED' }, { key: 'hatchability', label: 'HATCHABILITY' }, { key: 'status', label: 'STATUS' }] },
  { path: 'health', title: 'Flock health', description: 'Review health incidents, diagnosis and veterinary follow-up.', resource: 'health', columns: [{ key: 'incident', label: 'INCIDENT' }, { key: 'batch', label: 'BATCH' }, { key: 'farm', label: 'FARM' }, { key: 'reported', label: 'REPORTED' }, { key: 'birdsAffected', label: 'BIRDS AFFECTED' }, { key: 'vet', label: 'VETERINARIAN' }, { key: 'status', label: 'STATUS' }] },
  { path: 'medication', title: 'Medication & vaccination', description: 'Track planned treatments, doses and vaccination schedules.', resource: 'medication', columns: [{ key: 'record', label: 'RECORD' }, { key: 'batch', label: 'BATCH' }, { key: 'treatment', label: 'MEDICINE / VACCINE' }, { key: 'scheduled', label: 'SCHEDULED' }, { key: 'dosage', label: 'DOSAGE' }, { key: 'vet', label: 'VETERINARIAN' }, { key: 'status', label: 'STATUS' }] },
  { path: 'feed', title: 'Feed management', description: 'Review feed plans, consumption and variance by flock.', resource: 'feed', columns: [{ key: 'batch', label: 'BATCH' }, { key: 'farm', label: 'FARM' }, { key: 'feedType', label: 'FEED TYPE' }, { key: 'planned', label: 'PLANNED' }, { key: 'consumed', label: 'CONSUMED' }, { key: 'variance', label: 'VARIANCE' }, { key: 'status', label: 'STATUS' }] }
];

const inventoryPages: DirectoryPage[] = [
  { path: 'products', title: 'Products', description: 'Browse saleable products, feed, medicines and supplies.', resource: 'products', columns: [{ key: 'sku', label: 'SKU' }, { key: 'product', label: 'PRODUCT' }, { key: 'category', label: 'CATEGORY' }, { key: 'unit', label: 'UNIT' }, { key: 'salePrice', label: 'SALE PRICE' }, { key: 'status', label: 'STATUS' }] },
  { path: 'warehouses', title: 'Warehouses', description: 'View storage locations and the stock held at each site.', resource: 'warehouses', columns: [{ key: 'code', label: 'CODE' }, { key: 'warehouse', label: 'WAREHOUSE' }, { key: 'location', label: 'LOCATION' }, { key: 'items', label: 'ITEMS' }, { key: 'manager', label: 'MANAGER' }, { key: 'status', label: 'STATUS' }] },
  { path: 'stock', title: 'Inventory', description: 'Keep stock, reorder thresholds and expiry status in view.', resource: 'inventory', mode: 'read-only', columns: [{ key: 'sku', label: 'SKU' }, { key: 'product', label: 'PRODUCT' }, { key: 'category', label: 'CATEGORY' }, { key: 'warehouse', label: 'WAREHOUSE' }, { key: 'onHand', label: 'ON HAND' }, { key: 'reorderAt', label: 'REORDER AT' }, { key: 'status', label: 'STATUS' }] },
  { path: 'transfers', title: 'Stock transfers', description: 'Follow stock movements between farms and warehouses.', resource: 'transfers', columns: [{ key: 'transfer', label: 'TRANSFER' }, { key: 'date', label: 'DATE' }, { key: 'from', label: 'FROM' }, { key: 'to', label: 'TO' }, { key: 'items', label: 'ITEMS' }, { key: 'quantity', label: 'QUANTITY' }, { key: 'status', label: 'STATUS' }] },
  { path: 'stock-ledger', title: 'Stock ledger', description: 'Review auditable inventory movements and running balances.', resource: 'stock-ledger', mode: 'append-only', columns: [{ key: 'reference', label: 'REFERENCE' }, { key: 'date', label: 'DATE' }, { key: 'product', label: 'PRODUCT' }, { key: 'warehouse', label: 'WAREHOUSE' }, { key: 'movement', label: 'MOVEMENT' }, { key: 'quantity', label: 'QUANTITY' }, { key: 'status', label: 'STATUS' }] }
];

const tradingPages: DirectoryPage[] = [
  { path: 'customers', title: 'Customers', description: 'Know your customers, recent orders and outstanding balances.', resource: 'customers', columns: [{ key: 'code', label: 'CUSTOMER CODE' }, { key: 'name', label: 'CUSTOMER' }, { key: 'type', label: 'TYPE' }, { key: 'phone', label: 'PHONE' }, { key: 'orders', label: 'ORDERS' }, { key: 'outstanding', label: 'OUTSTANDING' }, { key: 'status', label: 'STATUS' }] },
  { path: 'suppliers', title: 'Suppliers', description: 'Review supplier contacts and purchasing relationships.', resource: 'suppliers', columns: [{ key: 'code', label: 'SUPPLIER CODE' }, { key: 'name', label: 'SUPPLIER' }, { key: 'category', label: 'CATEGORY' }, { key: 'phone', label: 'PHONE' }, { key: 'orders', label: 'ORDERS' }, { key: 'outstanding', label: 'OUTSTANDING' }, { key: 'status', label: 'STATUS' }] },
  { path: 'sales', title: 'Sales & dispatch', description: 'Review sales orders, payment status and delivery progress.', resource: 'sales', columns: [{ key: 'order', label: 'ORDER' }, { key: 'customer', label: 'CUSTOMER' }, { key: 'date', label: 'DATE' }, { key: 'items', label: 'ITEMS' }, { key: 'total', label: 'TOTAL' }, { key: 'payment', label: 'PAYMENT' }, { key: 'status', label: 'STATUS' }] },
  { path: 'quotations', title: 'Quotations', description: 'Track customer quotations and their conversion progress.', resource: 'quotations', columns: [{ key: 'quotation', label: 'QUOTATION' }, { key: 'customer', label: 'CUSTOMER' }, { key: 'date', label: 'DATE' }, { key: 'validUntil', label: 'VALID UNTIL' }, { key: 'total', label: 'TOTAL' }, { key: 'owner', label: 'OWNER' }, { key: 'status', label: 'STATUS' }] },
  { path: 'orders', title: 'Sales orders', description: 'Review customer orders, fulfillment and payment progress.', resource: 'orders', columns: [{ key: 'order', label: 'ORDER' }, { key: 'customer', label: 'CUSTOMER' }, { key: 'date', label: 'DATE' }, { key: 'items', label: 'ITEMS' }, { key: 'total', label: 'TOTAL' }, { key: 'payment', label: 'PAYMENT' }, { key: 'status', label: 'STATUS' }] },
  { path: 'procurement', title: 'Procurement', description: 'Track supplier orders, receipts and purchasing activity.', resource: 'procurement', columns: [{ key: 'order', label: 'PURCHASE ORDER' }, { key: 'supplier', label: 'SUPPLIER' }, { key: 'date', label: 'ORDER DATE' }, { key: 'items', label: 'ITEMS' }, { key: 'total', label: 'TOTAL' }, { key: 'received', label: 'RECEIVED' }, { key: 'status', label: 'STATUS' }] },
  { path: 'dispatch', title: 'Dispatch & delivery', description: 'Track delivery schedules, vehicle assignments and proof of delivery.', resource: 'dispatch', columns: [{ key: 'delivery', label: 'DELIVERY' }, { key: 'order', label: 'ORDER' }, { key: 'customer', label: 'CUSTOMER' }, { key: 'vehicle', label: 'VEHICLE' }, { key: 'driver', label: 'DRIVER' }, { key: 'scheduled', label: 'SCHEDULED' }, { key: 'status', label: 'STATUS' }] }
];

const crmPages: DirectoryPage[] = [
  { path: 'leads', title: 'CRM leads', description: 'Review potential customers and their qualification progress.', resource: 'leads', columns: [{ key: 'lead', label: 'LEAD' }, { key: 'company', label: 'BUSINESS' }, { key: 'contact', label: 'CONTACT' }, { key: 'source', label: 'SOURCE' }, { key: 'owner', label: 'OWNER' }, { key: 'nextFollowUp', label: 'NEXT FOLLOW-UP' }, { key: 'status', label: 'STATUS' }] },
  { path: 'opportunities', title: 'Opportunities', description: 'Review pipeline value and the next customer decision.', resource: 'opportunities', columns: [{ key: 'opportunity', label: 'OPPORTUNITY' }, { key: 'customer', label: 'CUSTOMER' }, { key: 'value', label: 'VALUE' }, { key: 'stage', label: 'STAGE' }, { key: 'owner', label: 'OWNER' }, { key: 'closeDate', label: 'EXPECTED CLOSE' }, { key: 'status', label: 'STATUS' }] },
  { path: 'follow-ups', title: 'Follow-ups', description: 'Keep customer calls, reminders and next actions on schedule.', resource: 'follow-ups', columns: [{ key: 'task', label: 'FOLLOW-UP' }, { key: 'customer', label: 'CUSTOMER' }, { key: 'due', label: 'DUE' }, { key: 'owner', label: 'OWNER' }, { key: 'type', label: 'TYPE' }, { key: 'notes', label: 'NOTES' }, { key: 'status', label: 'STATUS' }] },
  { path: 'complaints', title: 'Customer complaints', description: 'Track reported issues, ownership and resolution progress.', resource: 'complaints', columns: [{ key: 'case', label: 'CASE' }, { key: 'customer', label: 'CUSTOMER' }, { key: 'subject', label: 'SUBJECT' }, { key: 'reported', label: 'REPORTED' }, { key: 'owner', label: 'OWNER' }, { key: 'priority', label: 'PRIORITY' }, { key: 'status', label: 'STATUS' }] }
];

const peoplePages: DirectoryPage[] = [
  { path: 'employees', title: 'Employees', description: 'Manage employees across all departments, including driver licence details for transport staff.', resource: 'employees', columns: [{ key: 'employee', label: 'EMPLOYEE' }, { key: 'department', label: 'DEPARTMENT' }, { key: 'designation', label: 'DESIGNATION' }, { key: 'farm', label: 'ASSIGNED LOCATION' }, { key: 'phone', label: 'PHONE' }, { key: 'licenseNo', label: 'LICENSE NO.' }, { key: 'licenseDueDate', label: 'LICENSE DUE DATE' }, { key: 'joined', label: 'JOINED' }, { key: 'status', label: 'STATUS' }] },
  { path: 'vehicles', title: 'Company vehicles', description: 'Maintain each company vehicle as a separate asset, including purchase, sale, permit, certificate and tax details.', resource: 'vehicles', columns: [
    { key: 'vehicle', label: 'VEHICLE NUMBER' },
    { key: 'state', label: 'STATE' },
    { key: 'type', label: 'TYPE' },
    { key: 'capacityKg', label: 'CAPACITY (KG)' },
    { key: 'purchaseDate', label: 'PURCHASE DATE' },
    { key: 'purchasePrice', label: 'PURCHASE PRICE (₹)' },
    { key: 'purchasedFrom', label: 'PURCHASED FROM' },
    { key: 'rePassingDueDate', label: 'RE PASSING DUE DATE' },
    { key: 'roadTaxDueDate', label: 'ROAD TAX DUE DATE' },
    { key: 'goodsPermitDueDate', label: 'GOODS PERMIT DUE DATE' },
    { key: 'statePermitDueDate', label: 'STATE PERMIT DUE DATE' },
    { key: 'pucDueDate', label: 'PUC DUE DATE' },
    { key: 'insuranceDueDate', label: 'INSURANCE DUE DATE' },
    { key: 'drCertificateDueDate', label: 'DR CERTIFICATE DUE DATE' },
    { key: 'foodCertificateDueDate', label: 'FOOD CERTIFICATE DUE DATE' },
    { key: 'location', label: 'LOCATION' },
    { key: 'saleDate', label: 'SALE DATE' },
    { key: 'salePrice', label: 'SALE PRICE (₹)' },
    { key: 'soldTo', label: 'SOLD TO' },
    { key: 'status', label: 'STATUS' }
  ] },
];

const financePages: DirectoryPage[] = [
  { path: 'overview', title: 'Finance', description: 'A clear view of receivables, payables and recent financial activity.', resource: 'finance', mode: 'read-only', columns: [{ key: 'reference', label: 'REFERENCE' }, { key: 'counterparty', label: 'CUSTOMER / SUPPLIER' }, { key: 'type', label: 'TYPE' }, { key: 'dueDate', label: 'DUE DATE' }, { key: 'amount', label: 'AMOUNT' }, { key: 'status', label: 'STATUS' }] },
  { path: 'receivables', title: 'Receivables', description: 'Review customer invoices, balances and collection status.', resource: 'receivables', mode: 'read-only', columns: [{ key: 'invoice', label: 'INVOICE' }, { key: 'customer', label: 'CUSTOMER' }, { key: 'issued', label: 'ISSUED' }, { key: 'due', label: 'DUE DATE' }, { key: 'amount', label: 'AMOUNT' }, { key: 'balance', label: 'BALANCE' }, { key: 'status', label: 'STATUS' }] },
  { path: 'payables', title: 'Payables', description: 'Review supplier bills, due dates and amounts outstanding.', resource: 'payables', mode: 'read-only', columns: [{ key: 'bill', label: 'BILL' }, { key: 'supplier', label: 'SUPPLIER' }, { key: 'issued', label: 'ISSUED' }, { key: 'due', label: 'DUE DATE' }, { key: 'amount', label: 'AMOUNT' }, { key: 'balance', label: 'BALANCE' }, { key: 'status', label: 'STATUS' }] },
  { path: 'payments', title: 'Payments & receipts', description: 'Review incoming receipts and outgoing supplier payments.', resource: 'payments', mode: 'append-only', columns: [{ key: 'reference', label: 'REFERENCE' }, { key: 'party', label: 'CUSTOMER / SUPPLIER' }, { key: 'type', label: 'TYPE' }, { key: 'date', label: 'DATE' }, { key: 'method', label: 'METHOD' }, { key: 'amount', label: 'AMOUNT' }, { key: 'status', label: 'STATUS' }] },
  { path: 'expenses', title: 'Expenses', description: 'Review operating expenses by category and farm.', resource: 'expenses', columns: [{ key: 'reference', label: 'REFERENCE' }, { key: 'category', label: 'CATEGORY' }, { key: 'farm', label: 'FARM / LOCATION' }, { key: 'date', label: 'DATE' }, { key: 'submittedBy', label: 'SUBMITTED BY' }, { key: 'amount', label: 'AMOUNT' }, { key: 'status', label: 'STATUS' }] },
  { path: 'profitability', title: 'Profitability', description: 'Compare sample revenue, costs and margins across operations.', resource: 'profitability', mode: 'read-only', columns: [{ key: 'scope', label: 'SCOPE' }, { key: 'period', label: 'PERIOD' }, { key: 'revenue', label: 'REVENUE' }, { key: 'costs', label: 'COSTS' }, { key: 'profit', label: 'PROFIT' }, { key: 'margin', label: 'MARGIN' }, { key: 'status', label: 'STATUS' }] }
];

const insightPages: DirectoryPage[] = [
  { path: 'reports', title: 'Reports', description: 'Performance snapshots and operational reports for your business.', resource: 'reports', mode: 'read-only', columns: [{ key: 'report', label: 'REPORT' }, { key: 'category', label: 'CATEGORY' }, { key: 'period', label: 'PERIOD' }, { key: 'updated', label: 'LAST UPDATED' }, { key: 'status', label: 'STATUS' }] },
  { path: 'analytics', title: 'Analytics', description: 'Explore sample business indicators and operational trends.', resource: 'analytics', mode: 'read-only', columns: [{ key: 'metric', label: 'INDICATOR' }, { key: 'scope', label: 'SCOPE' }, { key: 'current', label: 'CURRENT' }, { key: 'previous', label: 'PREVIOUS' }, { key: 'change', label: 'CHANGE' }, { key: 'updated', label: 'UPDATED' }, { key: 'status', label: 'STATUS' }] },
  { path: 'notifications', title: 'Notifications', description: 'Review operational reminders and business alerts.', resource: 'notifications', mode: 'read-only', columns: [{ key: 'alert', label: 'ALERT' }, { key: 'category', label: 'CATEGORY' }, { key: 'relatedTo', label: 'RELATED TO' }, { key: 'created', label: 'CREATED' }, { key: 'recipient', label: 'RECIPIENT' }, { key: 'severity', label: 'SEVERITY' }, { key: 'status', label: 'STATUS' }] },
  { path: 'organization', title: 'Organization setup', description: 'Review demo organization settings and business locations.', resource: 'organization', columns: [{ key: 'unit', label: 'BUSINESS UNIT' }, { key: 'type', label: 'TYPE' }, { key: 'location', label: 'LOCATION' }, { key: 'manager', label: 'OWNER / MANAGER' }, { key: 'currency', label: 'CURRENCY' }, { key: 'timezone', label: 'TIME ZONE' }, { key: 'status', label: 'STATUS' }] },
  { path: 'users-roles', title: 'Users & roles', description: 'Review sample user access and role assignments.', resource: 'users-roles', columns: [{ key: 'name', label: 'USER' }, { key: 'email', label: 'EMAIL' }, { key: 'role', label: 'ROLE' }, { key: 'permissions', label: 'ACCESS SCOPE' }, { key: 'lastActive', label: 'LAST ACTIVE' }, { key: 'status', label: 'STATUS' }] },
  { path: 'documents', title: 'Documents', description: 'Browse sample business documents and their linked records.', resource: 'documents', columns: [{ key: 'document', label: 'DOCUMENT' }, { key: 'category', label: 'CATEGORY' }, { key: 'linkedTo', label: 'LINKED RECORD' }, { key: 'uploadedBy', label: 'UPLOADED BY' }, { key: 'updated', label: 'UPDATED' }, { key: 'size', label: 'SIZE' }, { key: 'status', label: 'STATUS' }] },
  { path: 'audit', title: 'Audit history', description: 'Review sample change events and transaction activity.', resource: 'audit', mode: 'read-only', columns: [{ key: 'event', label: 'EVENT' }, { key: 'record', label: 'RECORD' }, { key: 'performedBy', label: 'PERFORMED BY' }, { key: 'timestamp', label: 'TIMESTAMP' }, { key: 'change', label: 'CHANGE SUMMARY' }, { key: 'source', label: 'SOURCE' }, { key: 'status', label: 'STATUS' }] },
  { path: 'administration', title: 'Administration', description: 'Review demo organization users, roles and access status.', resource: 'administration', columns: [{ key: 'name', label: 'USER' }, { key: 'email', label: 'EMAIL' }, { key: 'role', label: 'ROLE' }, { key: 'businessUnit', label: 'BUSINESS UNIT' }, { key: 'lastActive', label: 'LAST ACTIVE' }, { key: 'access', label: 'ACCESS' }, { key: 'status', label: 'STATUS' }] }
];

function pageRoute(page: DirectoryPage): Route {
  return {
    path: page.path,
    canActivate: [requirePermissionGuard],
    loadComponent: page.resource === 'users-roles'
      ? () => import('./features/identity/users-roles/users-roles.component').then((module) => module.UsersRolesComponent)
      : ['quotations', 'orders', 'sales', 'dispatch'].includes(page.resource)
      ? () => import('./features/trading/trading-desk/trading-desk.component').then((module) => module.TradingDeskComponent)
      : page.production
      ? page.resource === 'broiler'
        ? () => import('./features/farm-operations/broiler/broiler.component').then((module) => module.BroilerComponent)
        : () => import('./features/farm-operations/production/production-page.component').then((module) => module.ProductionPageComponent)
      : () => import('./common/components/directory-page/workspace-page.component').then((module) => module.WorkspacePageComponent),
    data: {
      title: page.title,
      description: page.description,
      resource: page.resource,
      mode: page.mode ?? 'editable',
      columns: page.columns
    }
  };
}

function sectionRoute(path: string, pages: DirectoryPage[], extraChildren: Route[] = []): Route {
  return {
    path,
    canActivate: [requireSessionGuard],
    children: [...pages.map(pageRoute), ...extraChildren]
  };
}

export const routes: Routes = [
  { path: 'login', canActivate: [signedOutOnlyGuard], loadComponent: () => import('./features/identity/login/login.component').then((module) => module.LoginComponent) },
  { path: 'access-denied', canActivate: [requireSessionGuard], loadComponent: () => import('./features/identity/access-denied/access-denied.component').then((module) => module.AccessDeniedComponent) },
  { path: '', pathMatch: 'full', redirectTo: 'workspace/overview' },
  {
    path: 'workspace',
    canActivate: [requireSessionGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      { path: 'overview', canActivate: [requirePermissionGuard], data: { resource: 'dashboard' }, loadComponent: () => import('./features/workspace/dashboard/dashboard.component').then((module) => module.DashboardComponent) }
    ]
  },
  sectionRoute('farm-operations', farmOperations, [
    { path: '', pathMatch: 'full', redirectTo: 'farms' },
    { path: 'farms/:farmCode', canActivate: [requirePermissionGuard], data: { resource: 'farms' }, loadComponent: () => import('./features/farm-operations/farm-detail/farm-detail.component').then((module) => module.FarmDetailComponent) },
    { path: 'batches/:batchId', canActivate: [requirePermissionGuard], data: { resource: 'batches' }, loadComponent: () => import('./features/farm-operations/batch-360/batch-360.component').then((module) => module.Batch360Component) },
    { path: 'daily-operations', canActivate: [requirePermissionGuard], data: { resource: 'daily-operations' }, loadComponent: () => import('./features/farm-operations/daily-operations/daily-operations.component').then((module) => module.DailyOperationsComponent) }
  ]),
  sectionRoute('inventory', inventoryPages, [{ path: '', pathMatch: 'full', redirectTo: 'stock' }]),
  sectionRoute('trading', tradingPages, [
    { path: '', pathMatch: 'full', redirectTo: 'customers' },
    { path: 'order-desk', canActivate: [requirePermissionGuard], data: { resource: 'orders' }, loadComponent: () => import('./features/trading/trading-desk/trading-desk.component').then((module) => module.TradingDeskComponent) }
  ]),
  sectionRoute('customer-relations', crmPages, [{ path: '', pathMatch: 'full', redirectTo: 'leads' }]),
  sectionRoute('people-logistics', peoplePages, [
    { path: '', pathMatch: 'full', redirectTo: 'employees' },
    { path: 'fleet', redirectTo: 'vehicles', pathMatch: 'full' },
    { path: 'vehicle-assignments', canActivate: [requirePermissionGuard], data: { resource: 'vehicle-assignments' }, loadComponent: () => import('./features/people-logistics/vehicle-assignments/vehicle-assignments.component').then((module) => module.VehicleAssignmentsComponent) }
  ]),
  sectionRoute('finance', financePages, [{ path: '', pathMatch: 'full', redirectTo: 'overview' }]),
  sectionRoute('insights-admin', insightPages, [{ path: '', pathMatch: 'full', redirectTo: 'reports' }]),
  { path: 'farms', redirectTo: 'farm-operations/farms', pathMatch: 'full' },
  { path: 'sheds', redirectTo: 'farm-operations/sheds', pathMatch: 'full' },
  { path: 'batches', redirectTo: 'farm-operations/batches', pathMatch: 'full' },
  { path: 'feed-health', redirectTo: 'farm-operations/feed-health', pathMatch: 'full' },
  { path: 'daily-operations', redirectTo: 'farm-operations/daily-operations', pathMatch: 'full' },
  { path: 'broiler', redirectTo: 'farm-operations/broiler', pathMatch: 'full' },
  { path: 'layer', redirectTo: 'farm-operations/layer', pathMatch: 'full' },
  { path: 'breeder', redirectTo: 'farm-operations/breeder', pathMatch: 'full' },
  { path: 'hatchery', redirectTo: 'farm-operations/hatchery', pathMatch: 'full' },
  { path: 'health', redirectTo: 'farm-operations/health', pathMatch: 'full' },
  { path: 'medication', redirectTo: 'farm-operations/medication', pathMatch: 'full' },
  { path: 'feed', redirectTo: 'farm-operations/feed', pathMatch: 'full' },
  { path: 'products', redirectTo: 'inventory/products', pathMatch: 'full' },
  { path: 'warehouses', redirectTo: 'inventory/warehouses', pathMatch: 'full' },
  { path: 'transfers', redirectTo: 'inventory/transfers', pathMatch: 'full' },
  { path: 'stock-ledger', redirectTo: 'inventory/stock-ledger', pathMatch: 'full' },
  { path: 'customers', redirectTo: 'trading/customers', pathMatch: 'full' },
  { path: 'suppliers', redirectTo: 'trading/suppliers', pathMatch: 'full' },
  { path: 'sales', redirectTo: 'trading/sales', pathMatch: 'full' },
  { path: 'quotations', redirectTo: 'trading/quotations', pathMatch: 'full' },
  { path: 'orders', redirectTo: 'trading/orders', pathMatch: 'full' },
  { path: 'procurement', redirectTo: 'trading/procurement', pathMatch: 'full' },
  { path: 'dispatch', redirectTo: 'trading/dispatch', pathMatch: 'full' },
  { path: 'leads', redirectTo: 'customer-relations/leads', pathMatch: 'full' },
  { path: 'opportunities', redirectTo: 'customer-relations/opportunities', pathMatch: 'full' },
  { path: 'follow-ups', redirectTo: 'customer-relations/follow-ups', pathMatch: 'full' },
  { path: 'complaints', redirectTo: 'customer-relations/complaints', pathMatch: 'full' },
  { path: 'employees', redirectTo: 'people-logistics/employees', pathMatch: 'full' },
  { path: 'fleet', redirectTo: 'people-logistics/vehicles', pathMatch: 'full' },
  { path: 'vehicles', redirectTo: 'people-logistics/vehicles', pathMatch: 'full' },
  { path: 'drivers', redirectTo: 'people-logistics/employees', pathMatch: 'full' },
  { path: 'vehicle-assignments', redirectTo: 'people-logistics/vehicle-assignments', pathMatch: 'full' },
  { path: 'receivables', redirectTo: 'finance/receivables', pathMatch: 'full' },
  { path: 'payables', redirectTo: 'finance/payables', pathMatch: 'full' },
  { path: 'payments', redirectTo: 'finance/payments', pathMatch: 'full' },
  { path: 'expenses', redirectTo: 'finance/expenses', pathMatch: 'full' },
  { path: 'profitability', redirectTo: 'finance/profitability', pathMatch: 'full' },
  { path: 'reports', redirectTo: 'insights-admin/reports', pathMatch: 'full' },
  { path: 'analytics', redirectTo: 'insights-admin/analytics', pathMatch: 'full' },
  { path: 'notifications', redirectTo: 'insights-admin/notifications', pathMatch: 'full' },
  { path: 'organization', redirectTo: 'insights-admin/organization', pathMatch: 'full' },
  { path: 'users-roles', redirectTo: 'insights-admin/users-roles', pathMatch: 'full' },
  { path: 'documents', redirectTo: 'insights-admin/documents', pathMatch: 'full' },
  { path: 'audit', redirectTo: 'insights-admin/audit', pathMatch: 'full' },
  { path: 'administration', redirectTo: 'insights-admin/administration', pathMatch: 'full' },
  { path: '**', redirectTo: 'workspace/overview' }
];
