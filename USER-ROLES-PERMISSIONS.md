# Users, Roles & Permissions

## Purpose and status

This document translates the requirements in
[`functional-requirement.md`](./functional-requirement.md) into a recommended
identity and access-control model for the poultry ERP. It covers the
organization, farm, production, trading, finance, logistics, HR, reporting,
documents, notifications, audit, and administration capabilities.

The roles below are starting templates. The current application includes a
browser-only demo sign-in and client-side role, action, and scope checks backed
by JSON fixtures and browser storage. The demo password is `demo1234` for every
active fixture account. This is not secure authentication or production-grade
authorization: the password is shared, and a user can bypass client checks.
In production, permissions must be granted and enforced by the backend;
hiding a button or route in Angular is not authorization.

## Demo implementation available in this frontend

- Sign in with an active fixture user email and the shared demo password.
  The session lasts for the current browser tab and can be ended from the
  profile control.
- Route and navigation visibility, common create/edit/delete/workflow actions,
  farm/batch access, and daily bird-movement entry are checked against the
  user's role and assigned demo scope.
- Organization Admin can add/deactivate demo users, assign available roles
  and scopes, and edit local permission templates. Super Admin cannot be
  assigned from this screen; platform administration is not implemented.
- Demo users: Alex Morgan (`alex.morgan@example.test`, Organization Admin),
  Meera Joshi (`meera.joshi@example.test`, Farm Manager), and Ravi Patil
  (`ravi.patil@example.test`, Warehouse Manager). All use `demo1234`.
- Assignments and role-template overrides are browser-local. They are not a
  substitute for tenant isolation, server-side authorization, secure password
  storage, session revocation, or audit logging.

## 1. User and organization model

```text
Platform
└── Organization (tenant)
    ├── Business units / branches / offices
    ├── Farms ── Sheds ── Batches
    ├── Warehouses
    └── Users
        └── Role assignments + resource scope
```

- A **user** is an individual identity that can sign in. Users may have more
  than one role when their duties require it.
- A **role** is a named bundle of permissions, such as Farm Manager or
  Accountant.
- A **permission** is an atomic capability on a resource, such as
  `batch.place` or `payment.post`.
- A **scope** limits where a permission applies: platform, organization,
  business unit, assigned farm/shed/batch, warehouse, or self.
- Each organization is a tenant. Business records and user access must never
  cross organization boundaries unless a separately authorized platform
  support function is used.
- User activation/deactivation, role changes, and scope changes must be
  audited. Deactivated users cannot obtain new sessions; existing sessions
  should be revoked.

## 2. User populations

Create named user accounts for the people who perform these jobs. A person is
assigned one or more of the roles in section 3; job title alone does not grant
access.

| User population | Typical work | Recommended default |
|---|---|---|
| Business owner / executive | Organization-wide oversight, profitability, reports, approvals | Owner |
| Organization administrator | Organization configuration, users, role assignments, master data | Organization Admin |
| Farm manager | Farm, shed, flock lifecycle, production and staff oversight | Farm Manager, scoped to managed farms |
| Farm supervisor / poultry operator | Placement and daily on-farm records, mortality and feed entries | Farm Supervisor or Farm Worker / Operator, scoped to assigned farms |
| Veterinarian / animal-health staff | Health incidents, treatment, vaccination, medicine usage | Veterinarian, scoped to assigned flocks/farms |
| Broiler / layer / breeder production staff | Flock-specific production, weights, eggs, fertility and hatch data | Production Manager or Farm Supervisor, scoped to assigned flocks |
| Hatchery staff | Egg setting, candling, transfer, hatch results, chick grading | Hatchery Manager / Technician |
| Warehouse staff | Receipts, stock movements, counts, issues and transfers | Warehouse Manager or Warehouse Operator, scoped to warehouses |
| Procurement staff | Supplier relationships, purchase orders, receipts and purchasing approvals | Procurement Manager or Procurement Officer |
| Sales / customer-service staff | CRM, quotations, customer orders, sales and delivery coordination | Sales Manager or Sales Executive |
| Finance staff | Invoices, receivables, payables, receipts, payments, expenses and P&L | Accountant |
| HR staff | Employee records and HR administration | HR Manager |
| Transport / dispatch staff | Vehicles, drivers, dispatches, deliveries and trip status | Transport Manager or Driver |
| Internal reviewer | Read-only operational or financial review | Read Only, with explicit scope |
| Platform operations staff | Platform configuration and tenant support | Super Admin, platform scope only |

## 3. Role catalogue

The first fourteen roles below are explicitly named as examples in the
requirements. Roles marked **Recommended extension** cover operational
responsibilities in the required modules. Organizations should be able to
create custom roles by combining permissions without changing application
code.

| Role | Scope | Intended access and limits |
|---|---|---|
| **Super Admin** | Platform | Manages platform health and tenant provisioning. No routine access to tenant business data. Any exceptional support access is time-limited, reason-recorded, and audited. |
| **Organization Admin** | One organization | Manages company profile, branches/business units, fiscal year, currency, tax/numbering/time-zone settings, users, role assignments, organization-wide master data, and access policy. Does not automatically approve or post financial transactions. |
| **Owner** | One organization, all assigned units | Organization-wide read access to dashboards, operations, finance, profitability, and reports; may approve high-impact business actions when explicitly granted. Cannot manage platform tenants. |
| **Farm Manager** | Assigned farms | Manages farms/sheds, batch placement and lifecycle, daily operations, feed, production, flock health visibility, farm staff coordination, and farm-level reporting. Cannot change organization-wide security or post accounting payments by default. |
| **Farm Supervisor** | Assigned farms/sheds | Enters and reviews daily flock data, mortality/culling, feed and environmental readings; can perform permitted batch tasks. No farm deletion, organization configuration, user/role administration, or unrestricted closeout. |
| **Veterinarian** | Assigned farms/batches | Records health incidents, diagnoses, treatment plans, medication, and vaccination; views relevant flock and mortality history. No sales, payroll, or finance access by default. |
| **Warehouse Manager** | Assigned warehouses | Manages warehouse/product stock, receipts, issues, counts, inventory transfers, expiry/lot data, and warehouse staff. Cannot approve supplier payments or alter posted financial records. |
| **Procurement Manager** | Organization or assigned units | Manages suppliers, purchase requests/quotations, purchase orders, goods receipts, and procurement reports; approves orders within configured limits. Payment execution remains Finance. |
| **Sales Manager** | Organization or assigned units | Manages customers, CRM pipeline, quotations, sales orders, pricing/discount approvals, sales reporting, and sales staff. Dispatch completion may be assigned but must be auditable. |
| **Sales Executive** | Assigned customers/territory | Manages assigned leads/customers, follow-ups, quotations, and sales orders within configured price/credit limits. Cannot approve their own exception or discount beyond their limit. |
| **Accountant** | Organization or assigned units | Manages invoices, receivables, payables, receipts, payments, expenses, reconciliations, finance reports, and profitability. Cannot alter flock, inventory, or sales source records to bypass their workflows. |
| **HR Manager** | Organization or assigned units | Manages employee records, employment details, HR-related documents, and HR reports. Sensitive personal data is restricted to HR-authorized users. |
| **Transport Manager** | Organization or assigned units | Manages fleet, vehicles, drivers, trip assignments, dispatch planning, delivery status, and logistics reports. Cannot edit sales prices or post customer receipts. |
| **Read Only** | Explicitly assigned scope | Views only explicitly permitted modules and reports. No create, edit, delete, approve, post, lifecycle transition, or administrative access. Export/download must be a separate permission. |
| **Farm Worker / Operator** *(Recommended extension)* | Assigned farm/shed/batch | Captures assigned daily observations and permitted mortality/feed/weight records. No master-data, approval, finance, or staff-management access. |
| **Production Manager** *(Recommended extension)* | Assigned production areas/farms | Oversees broiler, layer, and breeder KPIs and production records; can approve corrections and production actions explicitly delegated. Does not receive veterinary or finance permissions by default. |
| **Hatchery Manager / Technician** *(Recommended extension)* | Assigned hatchery/site | Records egg intake, setting, candling, transfers, hatch outcomes, grading, and chick records. Manager may approve configured adjustments; technician enters assigned records. |
| **Warehouse Operator** *(Recommended extension)* | Assigned warehouses | Executes approved receipts, issues, counts, and movements; cannot adjust stock without a reason or approve their own material variances. |
| **Procurement Officer** *(Recommended extension)* | Assigned units/categories | Creates supplier requests and purchase orders and records receipts, subject to approval thresholds. No payment posting. |
| **Driver** *(Recommended extension)* | Assigned vehicle/trip/delivery | Views own assignments and updates allowed trip/delivery milestones. No access to unrelated customer, finance, HR, or fleet administration data. |
| **CRM / Customer Service Agent** *(Recommended extension)* | Assigned customer set | Manages assigned leads, opportunities, follow-ups, and complaints. Sales order or credit actions require separately granted permissions. |

## 4. Permission vocabulary

Permissions should use stable resource/action identifiers. The following
actions are reusable across modules:

| Action | Meaning |
|---|---|
| `read` | View records and permitted fields |
| `create` | Create a new draft or record |
| `update` | Edit an unposted record |
| `delete` | Delete/soft-delete an eligible record; never imply permission to erase posted history |
| `submit` | Submit a record into an approval/workflow state |
| `approve` / `reject` | Decide a submitted request, subject to approval limits and separation of duties |
| `post` | Finalize a financially or operationally consequential transaction |
| `transition` | Perform an explicitly allowed lifecycle action, such as place, dispatch, receive, or close |
| `export` | Export/download records; grant separately from read |
| `import` / `bulk_update` | Run bulk data operations; grant separately and audit |
| `manage` | Administer configuration for the specific resource, not an implicit all-access permission |

Examples of permission identifiers:

```text
organization.settings.manage
user.read                       user.create  user.update  user.deactivate
role.read                       role.manage  permission.assign
farm.read                       farm.create  farm.update  farm.delete
shed.read                       shed.create  shed.update  shed.delete
batch.read                      batch.create  batch.place  batch.close
batch.daily_record.create       batch.mortality.record  batch.movement.record
feed.transaction.create         health.incident.create  medication.administer
inventory.read                 inventory.receipt.post  inventory.adjust
purchase_order.create          purchase_order.approve  goods_receipt.post
sales_order.create             sales_order.approve  dispatch.transition
invoice.create                 payment.post  expense.approve
employee.read                  employee.manage
report.read                    report.export
document.read                  document.upload  document.delete
audit.read                     notification.read  notification.acknowledge
```

Permissions may additionally constrain fields (for example, hide payroll or
personal contact fields), amount/discount thresholds, allowed lifecycle
transitions, and assigned resource IDs.

## 5. Role-to-module access matrix

Legend: **M** = manage within scope; **E** = execute/create/update assigned
work; **A** = approve/post only when a matching permission and limit are
configured; **R** = read; **—** = no default access. A role may receive more
or less access through explicit organization policy. “Manage” does not bypass
workflow rules, audit history, or separation-of-duties checks.

| Module / capability | Super Admin | Org Admin | Owner | Farm Manager | Farm Supervisor | Veterinarian | Warehouse Manager | Procurement Manager | Sales Manager | Sales Executive | Accountant | HR Manager | Transport Manager | Read Only |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Platform / tenant operations | M | — | — | — | — | — | — | — | — | — | — | — | — | — |
| Organization configuration | — | M | R | — | — | — | — | — | — | — | R | — | — | R* |
| Users, roles, permissions | —** | M | R | — | — | — | — | — | — | — | — | — | — | — |
| Farms, sheds, batches | — | M | R | M | E | R | — | — | R | R | R | — | R | R* |
| Daily operations / mortality | — | R | R | M | E | R | — | — | — | — | R | — | — | R* |
| Broiler / layer / breeder production | — | R | R | M | E | R | — | — | R | — | R | — | — | R* |
| Health / medication / vaccination | — | R | R | E* | E* | M | R* | — | — | — | R* | — | — | R* |
| Hatchery / chick records | — | R | R | E* | E* | R | — | — | R | — | R | — | — | R* |
| Feed / feed transactions | — | R | R | M | E | R | E* | — | — | — | R | — | — | R* |
| Products / inventory / warehouses | — | M | R | R* | — | R* | M | E* | R* | — | R | — | R* | R* |
| Suppliers / procurement / purchase | — | M | R | R* | — | — | E* | M | — | — | R/A* | — | — | R* |
| Customers / CRM / quotations | — | M | R | — | — | — | — | — | M | E | R | — | R* | R* |
| Sales orders / poultry trading | — | M | R/A* | — | — | — | — | — | M/A* | E | R | — | E* | R* |
| Dispatch / fleet / delivery | — | M | R | R* | — | — | E* | — | E* | E* | R | — | M | R* |
| Invoices / receivables / payables | — | R | R | — | — | — | R* | R* | R* | — | M | — | — | R* |
| Payments / receipts / reconciliation | — | R | R/A* | — | — | — | — | — | — | — | M/A* | — | — | R* |
| Expenses / profitability | — | R | R/A* | E* | — | — | E* | E* | E* | — | M/A* | E* | E* | R* |
| Employees / HR | — | M* | R* | R* | — | — | — | — | — | — | R* | M | — | R* |
| Documents | — | M* | R | E* | E* | E* | E* | E* | E* | E* | E* | E* | E* | R* |
| Notifications | — | M* | R | R | R | R | R | R | R | R | R | R | R | R* |
| Reports / analytics / AI insights | — | M* | R/export* | R* | R* | R* | R* | R* | R* | R* | R* | R* | R* | R* |
| Audit history | —** | M* | R* | R* | — | — | — | — | — | — | R* | — | — | R* |

`*` Must be explicitly granted and scoped; this is not automatically included
in the role. `**` Platform support or Super Admin access to organization
identity/audit data is exceptional, separately permissioned, reason-coded,
time-limited where feasible, and logged. Super Admin does not inherit routine
business permissions.

The table is a default-template guide, not a substitute for atomic backend
permission checks. For example, a Farm Manager’s `M` access applies only to
assigned farms, and an Accountant’s `A` access does not automatically permit
approving a transaction that the same person created.

## 6. Important workflow and separation-of-duties rules

1. **Tenant isolation:** every API query and mutation is constrained to the
   authenticated organization. A client-supplied organization ID never grants
   access to another tenant.
2. **Farm scope:** farm users see only assigned farms, sheds, batches, and
   related records. Access to a batch follows its authorized farm assignment;
   transfers between farms require explicit source and destination scope.
3. **Capacity and flock integrity:** create/place/move/close actions require
   the corresponding permission and backend validation of farm/shed capacity,
   current birds, valid batch status, and lifecycle history.
4. **Operational entry:** mortality, culling, daily records, feed use, health,
   and medication actions are limited to authorized active batches. Bird
   counts cannot become negative; closed/cancelled batches reject normal
   entries.
5. **Inventory integrity:** stock receipt, issue, transfer, count, and
   adjustment are distinct permissions. Adjustments require a reason and
   audit entry; negative stock follows explicit organization policy.
6. **Purchasing controls:** requesting/creating, approving, receiving, and
   paying for purchases are separable steps. Enforce configured monetary
   approval limits and prevent self-approval where policy requires.
7. **Sales and credit controls:** sales staff may be restricted by territory,
   customer ownership, price/discount limits, and customer credit limits.
   Approval above a limit is a separate permission. Order, dispatch, invoice,
   and payment statuses cannot be bypassed.
8. **Finance controls:** payment posting and reconciliation are finance-only
   by default. Enforce outstanding-balance and overpayment policy. Separate
   transaction creator and approver/poster for configured thresholds.
9. **Sensitive data:** payroll, employee personal information, credentials,
   secrets, and security configuration are not included in broad read access.
10. **Documents:** authorize by both document type and linked record; validate
    file type/size and audit upload, access where required, replacement, and
    deletion.
11. **Read-only and exports:** `read` never implies export, bulk download,
    update, workflow transition, or access to sensitive fields.
12. **Audit:** log actor, organization, action, resource, resource ID, time,
    outcome, and relevant before/after values for security-sensitive and
    business-critical actions. Do not expose audit-log mutation to normal users.

## 7. Identity lifecycle and access administration

- Invite/create users with verified email or the organization's selected
  identity method; collect only required profile details.
- Support login, logout, forgot/reset password, password policy, session
  management, and JWT/refresh-token handling as required by the system
  architecture.
- Activate, suspend, and deactivate accounts. Deactivation blocks new
  sessions and revokes active refresh sessions.
- Assign roles and scopes independently. A role without an applicable scope
  grants no access to scoped records.
- Review privileged access periodically; remove stale assignments when a user
  changes jobs, farms, business units, or leaves the organization.
- Record who invited a user, changed a role/scope, approved elevated access,
  and when those changes took effect.
- Provide a custom-role editor that selects permissions from the catalog,
  warns about high-risk combinations, and preserves a clear assignment audit.

## 8. Implementation notes

- Persist users, roles, permissions, role-permission links, user-role
  assignments, scope assignments, and audit events in the backend data model.
- Enforce authorization in Spring Security/service/API layers on every
  protected request. Derive effective permission and scope server-side from
  the authenticated principal.
- Return explicit `401` for unauthenticated access and `403` for authenticated
  users lacking permission/scope; do not rely on the Angular UI to protect
  data.
- The Angular application may use backend-provided permissions to hide or
  disable unavailable actions for usability, but the server remains the
  security boundary.
- Add tests for tenant isolation, scoped farm access, forbidden actions,
  approval limits, separation of duties, deactivated users, and all major
  lifecycle transitions.
- Revisit templates with the business owner before production. Permission
  bundles and approval thresholds are policy decisions and should be
  configurable, versioned, and auditable.
