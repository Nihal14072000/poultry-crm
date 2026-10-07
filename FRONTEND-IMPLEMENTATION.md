# Flockwise Frontend — Demo Screens

## Purpose

This document records frontend work completed so far against
[`functional-requirement.md`](./functional-requirement.md). The requirement
describes a large poultry ERP. The current implementation is a responsive
frontend demo with sample-data screens and a replaceable data boundary; it is
not a complete production ERP.

## Requirements addressed

The first slice prioritizes the requirement's executive dashboard, responsive
navigation, farm/batch visibility, inventory and trading summaries, and the
fast mobile-oriented daily farm-entry workflow. Feature data is isolated behind
an adapter so UI components do not depend on JSON fixture files or REST details.

## Delivered

- Replaced the Angular starter page with an original Flockwise-branded,
  responsive operations workspace: dark navigation, organization switcher,
  global-search affordance, notification affordance, date control, and profile
  area. Sidebar navigation groups can be collapsed and expanded, including in
  the mobile navigation.
- Added a dashboard with bird, batch, revenue, and mortality metrics; revenue
  trend; farm performance; operational alerts; recent activity; and navigation
  links for drill-down.
- Wired the header notification control to load and display all local demo
  notifications, with loading, retry/error, empty, and notification-center link
  states. The header date control now opens a date-range picker with presets,
  date validation, and an applied range label.
- Added dedicated records/performance tabs for Broiler, Layer, Breeder, and
  Hatchery. Each area has its own sample KPIs, target/actual trend charts, and
  area-specific performance note backed by its JSON fixture data.
- Added a daily operations entry form for location, flock readings, and shed
  environment. Farm, shed, and batch choices load from local fixtures. It
  calculates closing birds, mortality rate, and FCR; prevents over-counting
  mortality/culling and duplicate batch/date entries; and stores successful
  entries in browser-local demo storage.
- Added reusable searchable, status-filterable directory views for farms and
  sheds, flocks and batches, broiler, layer, breeder, hatchery, flock health,
  medication and vaccination, feed, products, warehouses, inventory, stock
  transfers and ledger, customers, suppliers, quotations, orders, procurement,
  dispatch, CRM leads/opportunities/follow-ups/complaints, employees,
  vehicles/drivers, receivables, payables, payments, expenses, profitability,
  reports, analytics, notifications, organization, users/roles, documents,
  audit history, and administration.
- Added a separate [users, roles, and permissions guide](./USER-ROLES-PERMISSIONS.md)
  mapping the required organization roles, recommended operational roles,
  permission vocabulary, resource scopes, and separation-of-duties controls.
- Added a demo-only sign-in screen (`/login`), tab-scoped session, sign-out,
  route guard, role-filtered navigation, scoped record/action checks, an
  access-denied screen, and an Organization Admin users/role-template page.
  Use `demo1234` with an active fixture user's email. This is client-side
  demonstration behavior only; credentials, sessions, scopes, and permissions
  must be enforced by the future backend for production.
- Added demo create/edit/delete workflows to editable directories, append-only
  creation for stock-ledger and payment entries, read-only handling for
  inventory/receivable/payable/report snapshots and audit history,
  field-level required/email/phone/date/numeric/percentage validation, duplicate
  master identifier checks, contextual transfer/batch rules, and browser-local
  persistence using `localStorage`.
- Added state-transition actions for flock placement/closeout, stock transfer
  receipt, quotations, orders, procurement, dispatch, CRM leads/opportunities/
  follow-ups/complaints, health incidents, medication, feed, hatchery stages,
  fleet assignments, expense approvals, and notification acknowledgement.
  Actions are restricted to valid current-state transitions and display
  success or failure feedback.
- Added distinct initial statuses for new workflow records so a new order,
  quotation, flock, or transfer cannot be created directly in a terminal state.
- Improved daily operations sequencing: opening birds use the batch's current
  count and previous weight uses the latest earlier saved entry. Future and
  out-of-sequence dates are rejected, saved entries are acknowledged, and
  flock summary/status are bound to the selected batch rather than static
  sample labels.
- Added focused tests for workflow transitions and shared-form validation.
- Added client-side column sorting and pagination to the shared directory
  screen.
- Added farm drill-downs with farm-level capacity utilization, shed occupancy,
  available placement space, and links to each shed's flocks. Farm and shed
  capacity limits are checked before batch creation or placement changes;
  planned flocks reserve space without being counted as live occupancy.
- Added batch 360 views with lifecycle and flock metrics, daily performance,
  alerts, and related health, medication, feed, sales, expense, document, and
  audit records where available. Farm and batch names in their directories
  and dashboard farm rows navigate to their drill-downs.
- Added bird-movement records for mortality, culling, sale/lifting, transfer
  out, and adjustment out. Movements validate whole-number counts against live
  birds, append to a local transaction ledger, and update batch, farm, and shed
  occupancy. Daily operations now records mortality and culling through the
  same movement flow and keeps its opening count aligned with the current
  batch count. Batch closeout requires zero live birds; partial-sale status
  requires a recorded sale/lifting movement.
- Prevented deleting occupied batches/farms/sheds or removing master records
  that are still referenced by dependent records; farm/shed identity changes
  are blocked while batches reference them.
- Daily operations entries now persist locally and show recent saved records;
  the screen also prevents duplicate batch/date entries and calculates FCR from
  daily feed consumed and recorded weight gain.
- Added loading, error, and empty-result states to data-driven views. The daily
  entry shows a demo-only save confirmation rather than claiming persistence.
- Added lazy-loaded Angular routes for the dashboard and feature views.
- Organized feature code by business area: farm operation screens live under
  `src/app/features/farm-operations/`, while reusable UI components, services,
  adapters, and models are grouped under `src/app/common/`. Production screens
  use a Broiler feature parent with a shared production page child; that page
  composes reusable records and performance child components.
- Added typed dashboard/directory models and service boundaries:
  `DashboardService` and `DirectoryService` → `BusinessDataService` →
  `DataAdapter`.
- Added `JsonFileAdapter` and realistic sample JSON fixtures under
  `src/assets/mock-data/`.
- Added `ApiDataAdapter` for versioned `/api/v1/{resource}` GET requests and
  registered Angular's HTTP provider. The app currently selects the JSON
  adapter; the REST adapter is scaffolding and has not been connected to a live
  backend.
- Updated the application title, metadata, visual tokens, and starter
  navigation test. Increased the Angular component-style budget to accommodate
  the feature-specific responsive styles.

## Screens and local data

| Route | Screen | Fixture |
| --- | --- | --- |
| `/workspace/overview` | Executive dashboard | `dashboard.json` |
| `/farm-operations/daily-operations` | Daily flock entry | `farms.json`, `sheds.json`, `batches.json`; saved entries in browser storage |
| `/farm-operations/farms` | Farms and sheds | `farms.json` |
| `/farm-operations/farms/:farmCode` | Farm and shed capacity drill-down | `farms.json`, `sheds.json`, `batches.json` |
| `/farm-operations/sheds` | Shed capacity directory | `sheds.json` |
| `/farm-operations/batches` | Flocks and batches | `batches.json` |
| `/farm-operations/batches/:batchId` | Batch 360 and bird-movement ledger | `batches.json`, `business-modules.json` |
| `/farm-operations/feed-health` | Feed and health supplies | `feed-health.json` |
| `/farm-operations/broiler`, `/farm-operations/layer`, `/farm-operations/breeder`, `/farm-operations/hatchery` | Production records and dedicated performance tabs | `business-modules.json` |
| `/farm-operations/health`, `/farm-operations/medication`, `/farm-operations/feed` | Health and feed demo directories | `business-modules.json` |
| `/inventory/products`, `/inventory/warehouses`, `/inventory/stock`, `/inventory/transfers`, `/inventory/stock-ledger` | Inventory demo directories | `inventory.json`, `business-modules.json` |
| `/trading/customers`, `/trading/suppliers`, `/trading/sales`, `/trading/quotations`, `/trading/orders`, `/trading/procurement`, `/trading/dispatch` | Trading demo directories | `customers.json`, `sales.json`, `procurement.json`, `business-modules.json` |
| `/customer-relations/leads`, `/customer-relations/opportunities`, `/customer-relations/follow-ups`, `/customer-relations/complaints` | CRM demo directories | `business-modules.json` |
| `/people-logistics/employees`, `/people-logistics/fleet` | People and logistics demo directories | `business-modules.json` |
| `/finance/overview`, `/finance/receivables`, `/finance/payables`, `/finance/payments`, `/finance/expenses`, `/finance/profitability` | Finance demo directories | `finance.json`, `business-modules.json` |
| `/insights-admin/reports`, `/insights-admin/analytics`, `/insights-admin/notifications`, `/insights-admin/organization`, `/insights-admin/users-roles`, `/insights-admin/documents`, `/insights-admin/audit`, `/insights-admin/administration` | Insights and administration demo directories | `reports.json`, `business-modules.json` |

Routes follow the sidebar hierarchy; for example, products are at
`/inventory/products` and broiler performance is at
`/farm-operations/broiler`. Previous flat URLs redirect to their nested
counterparts.

These module routes reuse the directory screen and load their records from
the `business-modules.json` fixture. The production pages include specific
performance metrics and trends for each area. The sidebar contains the corresponding
navigation links, including on mobile where the navigation can scroll
horizontally. Editable records and daily entries are persisted in browser
`localStorage`, seeded from fixtures the first time each resource is opened.
This is per-browser demo persistence, not backend or shared business storage.
Legacy empty browser caches are restored from non-empty fixtures once; newly
saved empty directories remain empty.
Financial sample data and organization currency settings use Indian rupees
(INR/₹). Existing localStorage strings containing dollar symbols and USD
currency codes are migrated to ₹/INR when the resource is next loaded; numeric
amounts are left unchanged because these are demo values, not converted
exchange rates.
When adding a record, text and numeric fields suggest distinct values already
present for the same field in that directory; status remains a dropdown.
Stock ledger and payment entries are append-only in the UI; inventory and
financial balance snapshots, reports, analytics, and audit history are
read-only.

The batch 360 `:batchId` route accepts a batch code (for example,
`/farm-operations/batches/FW-2412`). Farm drill-downs accept the farm code or
farm name. New bird movements are stored under the `batch-transactions`
resource in `business-modules.json` and browser `localStorage`.

## Data adapter boundary

Components call feature services rather than importing fixture data. The
current provider is configured in `src/app/app.config.ts`:

```ts
{ provide: DATA_ADAPTER, useClass: JsonFileAdapter }
```

When the backend endpoints are ready, switch the provider to `ApiDataAdapter`
and configure the API base URL/authentication/interceptors as required by the
backend contract. The API adapter has generic GET, POST, PUT, and DELETE
methods, but API-backed module workflows, pagination/filter query mapping,
response normalization, authentication, and API error translation still need
implementation against the agreed API specification.

## Run and verify

From the project directory:

```powershell
npm start
npm run build
npm test -- --watch=false
```

An earlier build completed successfully before the most recent module,
workflow, and persistence changes. The attempted unit-test command did not
produce a completed result, so test status remains **not verified**. Latest
changes have not been built or tested. Per the project owner's instruction, do
not run a build, test, or start the app without their approval.

## Not implemented yet

The module screens and CRUD are still demo workflows, not complete
implementations of their business domains. Pending work includes backend
integration; authentication/authorization; organization setup; server-side
search and pagination; posting inventory movements into calculated balances;
purchase/sales order line items and backend-transactional workflows; payment
settlement against outstanding balances; inventory stock reservations; offline
synchronization; notification delivery and server-side
acknowledgement; report generation/exports; and authoritative business rules,
auditability, and comprehensive integration/E2E tests. The new status
transitions and form checks are frontend demo behavior backed by browser
storage, not substitutes for server-side validation or transactions. A browser
localStorage workflow cannot provide atomic multi-record commits; if a local
write fails mid-operation, the UI reports that occupancy or movement records
may need reconciliation. Existing sample farm-level bird totals can include
birds not represented by the sample shed records. Displayed business figures
and dates are sample data; they must not be used for operational decisions.

## Suggested next frontend increments

1. Confirm the design and navigation with manual desktop/mobile review.
2. Review farm/shed capacity handling, batch placement and closeout, and bird
   movements against the business owner's operational rules.
3. Agree the API request/response and error contracts with the backend team;
   then add API configuration, pagination/filter support, and authentication.
4. Add focused component/service tests and verify operation entry and
   transaction workflows after approval to run the test/build commands.
5. Replace browser demo persistence with API-backed workflows and enforce
   transactional business rules on the server.
