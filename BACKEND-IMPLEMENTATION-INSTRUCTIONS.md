# One-Pass Backend Implementation Brief

> **Purpose:** Give a coding agent one complete, unambiguous instruction set to
> generate the production backend for the existing Flockwise Angular demo.
> This is a generation brief, not a claim that the backend already exists.

## Copy-and-run prompt

You are a senior Java/Spring Boot architect and implementation agent. In this
repository, implement the complete production backend described below in one
execution. Do not stop after producing an architecture, plan, scaffolding, or
representative module. Read the referenced project documents and frontend
contracts first, then create all required backend source, migrations,
configuration, tests, seed data, and run documentation; build and test the
result; fix failures caused by your changes; and finish with a concise
implementation and verification report.

“In one execution” means deliver the complete backend in this task, not put
business logic into one class or generate an unbuildable code dump. Work
incrementally internally, keep module boundaries, and validate the completed
result. Do not modify the Angular app unless a minimal, necessary API-contract
compatibility change is approved by the user. If the current frontend cannot
use a secure backend without changes, implement the backend correctly and
document the exact frontend integration changes still needed rather than
weakening security.

### 1. Read these sources before implementation

- `functional-requirement.md` — authoritative product, domain, workflows,
  security, integrity, reporting, deployment, and definition-of-done
  requirements.
- `USER-ROLES-PERMISSIONS.md` — role templates, permission vocabulary,
  resource scopes, and separation-of-duties rules.
- `FRONTEND-IMPLEMENTATION.md` — what the current Angular demo really does,
  its local-only limitations, resource routes, and known pending work.
- `src/app/common/services/api-data.adapter.ts` — existing frontend REST
  adapter methods and URL convention.
- `src/app/common/models/directory.model.ts` and
  `src/app/common/models/auth.model.ts` — frontend response and identity
  expectations.
- `src/app/app.routes.ts` — actual frontend resource slugs and screen fields.
- `src/assets/mock-data/business-modules.json` and the other files in
  `src/assets/mock-data/` — fixture resource names and sample field shapes.
- `src/app/common/services/trading-desk.service.ts` — concrete sales, order,
  dispatch, invoice, stock reservation, and receipt workflow expectations.
- `BACKEND-API-AND-DATABASE-CATALOG.md` — required endpoint names and purposes,
  canonical relational table/column inventory, and SQL migration file layout.

Treat the functional requirements as the product specification and the
frontend as a compatibility contract where feasible. Resolve conflicts by
preserving security and data integrity first; explain any frontend integration
gap in the final report.

### 2. Repository and implementation target

- Keep the existing Angular application intact.
- Add the backend as a separate Maven project under `backend/` at the repository
  root. Do not put Java code into the Angular `src/` tree.
- Use Java 21, Spring Boot 3.x, Maven, Spring Web, Spring Security, Spring Data
  JPA, Jakarta Bean Validation, PostgreSQL, Flyway, springdoc-openapi, and
  JUnit 5. Use compatible released versions managed through the Spring Boot
  dependency BOM; do not pin conflicting transitive versions.
- Use a clearly named base package such as `com.flockwise.backend`.
- Build a **modular monolith**, not microservices. Organize by domain modules
  with explicit module boundaries. Within modules use suitable controller,
  request/response DTO, service, repository, mapper, validation, and test
  boundaries. Do not expose JPA entities in API responses.
- Produce working code, not pseudocode, TODO-only methods, empty controllers,
  fake-success responses, or commented-out feature stubs.
- Do not add AI features that invent operational metrics. If AI integration
  cannot be implemented responsibly without an agreed provider, credentials,
  and business-data policy, expose no fake AI endpoint and document it as a
  follow-on integration.

### 3. Required backend modules

Implement a coherent minimum production backend for all required business
domains, including:

1. Identity and access: organizations/tenants, branches/business units, users,
   roles, permissions, role assignments, scopes, password reset, sessions and
   refresh-token rotation.
2. Master data: products/categories/types, breeds, bird types, units, farms,
   sheds, warehouses, customers, suppliers, employees, vehicles/drivers, feed
   types, medicines, vaccines, expense categories, payment methods, tax,
   currency, and locations.
3. Farm operations: farms, sheds, flock/batches, placements, daily flock
   records, mortality/culling/other bird movements, capacity, and batch
   lifecycle/360 data.
4. Production: broiler weight/performance, layer egg production, breeder
   production/fertility/hatchability, and hatchery setting-through-hatch/chick
   results.
5. Feed and health: feed plans/transactions/consumption/wastage, health
   incidents, veterinary visits, medication, dosage/treatment, and vaccination.
6. Inventory and procurement: immutable stock ledger, lots/expiry, receipts,
   issues, transfers, adjustments, returns, reservations, purchase requisition,
   quotation, order, goods receipt, quality check, supplier invoice, and
   payment linkage.
7. Sales/trading and logistics: customer CRM, leads/opportunities/follow-ups/
   complaints, quotations, order line items, pricing bases, credit checks,
   poultry/live-bird sales, dispatch, vehicles/drivers/routes, delivery
   outcomes/proof, invoice, partial payment/receipt, returns, and credit notes.
8. Finance: accounts-ready transaction model, receivables, payables, receipts,
   payments, expenses, tax, journals, cash/bank references, outstanding
   balances, profitability, and reports. Do not represent a balance snapshot
   as a ledger transaction.
9. HR: employee records, departments/designations, attendance, leave,
   assignments, and protected sensitive data. Do not silently expand this into
   payroll.
10. Shared capabilities: notifications/acknowledgement, documents and
    metadata, audit history, dashboard, reporting/analytics, health checks,
    structured errors, and API documentation.

Do not implement every domain as a generic JSON record or a single
unconstrained key/value table. Model transactional concepts and relationships
with typed entities/DTOs, validation, constraints, and services. Read-only
projections can use tailored query DTOs.

### 4. Multi-tenancy, identity, and authorization (mandatory)

- Every tenant-owned entity and business transaction must have an organization
  association, direct or through a strictly owned parent. Resolve the tenant
  from the authenticated principal; never trust an organization ID supplied
  by the client to authorize access.
- Enforce tenant constraints in service/query boundaries for every read,
  mutation, export, report, and related-record lookup. Add tests proving a user
  from one tenant cannot enumerate, read, edit, delete, or link records from
  another tenant, including through guessed UUIDs and nested IDs.
- Implement secure password hashing (Argon2id or BCrypt), login, logout,
  forgot/reset password, password policy, access-token authentication, refresh
  token rotation/revocation, account activation/deactivation, and session
  invalidation. Store only hashed refresh/reset tokens. Never log passwords or
  tokens. No shared `demo1234` password in production seed data.
- Implement server-side RBAC and resource scopes for platform, organization,
  business unit, farm/shed/batch, warehouse, territory/customer, and self as
  appropriate. Use Spring Security method/service authorization and perform
  scope checks on each resource operation. A route/button hidden in Angular is
  never an authorization boundary.
- Seed the roles in `USER-ROLES-PERMISSIONS.md`, including recommended
  operational roles. Use atomic stable permission identifiers (for example,
  `batch.place`, `payment.post`, `report.export`). Include `read`, `create`,
  `update`, `delete`, `submit`, `approve`, `reject`, `post`, `transition`,
  `export`, `import`, and `manage` only where applicable.
- Keep `Super Admin` platform-scoped, with no default access to tenant business
  records. Require exceptional support access to be explicitly permissioned,
  reason-coded, time-bounded where feasible, and audited.
- Enforce separation of duties and approval thresholds where configured.
  Prevent self-approval/posting when policy requires it. Read-only access must
  not imply export, update, or workflow transitions.
- Return 401 for unauthenticated access and 403 for authenticated but
  unauthorized access. Avoid user/tenant existence leaks in authentication and
  cross-tenant errors.
- Configure CORS for explicit environment-supplied frontend origins only.
  Document the chosen CSRF strategy. If refresh tokens use cookies, apply
  `HttpOnly`, `Secure`, and appropriate `SameSite` settings and CSRF defenses.

### 5. Data model, integrity, and transactions

- Use PostgreSQL, UUID primary keys, `Instant`/`OffsetDateTime` timestamps in
  UTC, `BigDecimal` for currency/weights/rates where decimal precision matters,
  explicit units, optimistic locking for mutable aggregate roots, foreign
  keys, unique constraints, and query indexes. Include tenant ID in appropriate
  uniqueness constraints, e.g. batch number unique per organization.
- Use Flyway migrations from an empty database. Do not rely on Hibernate
  schema creation/update in production. Include `createdAt`, `updatedAt`,
  `createdBy`, `updatedBy` and soft-delete fields where appropriate. Protect
  posted/immutable records from deletion or mutation.
- Treat `BACKEND-API-AND-DATABASE-CATALOG.md` as the canonical minimum
  API/database naming contract. Create actual executable PostgreSQL DDL as
  separate Flyway SQL files under
  `backend/src/main/resources/db/migration/`; do not embed schema creation in
  Java, README prose, or a single generated `schema.sql`. Split migrations by
  dependency/domain, use ordered versioned names such as
  `V001__identity_and_organization.sql`, and put seed data in separate
  repeatable/versioned seed scripts suitable for development only. Each table,
  column, type, nullability, default, constraint, foreign key, and index must
  be explicit in SQL. Match the catalog's required columns or document a
  justified normalization/renaming mapping in the backend README.
- Make the SQL scripts independently reviewable and runnable from an empty
  PostgreSQL database through Flyway. Add a schema verification test (or
  equivalent automated check) that confirms required tables and columns exist
  after migration; do not claim a DB column exists merely because a Java field
  was generated.
- Place multi-record business changes inside service-level database
  transactions. Validate all preconditions before writing. Fail the complete
  operation on error; do not leave partial inventory, occupancy, invoice, or
  payment state.
- Enforce at minimum:
  - farm/shed capacity and batch placement, lifecycle, and closeout;
  - non-negative bird counts and valid mortality/culling/sale/transfer
    movements, preventing closed/cancelled flocks from normal daily entries;
  - consistent daily opening/closing values, dates, and duplicate rules;
  - non-negative inventory unless an explicit tenant policy allows it,
    immutable inventory movements, lot/expiry tracking, and concurrency-safe
    stock reservation/release;
  - valid purchase/sales/dispatch state transitions and partial receipt/
    delivery;
  - customer credit limits and payment amounts against outstanding invoices,
    with an explicit overpayment policy;
  - expired medicine/stock restrictions, valid references, and duplicate
    identifiers;
  - referential safety when deleting or deactivating referenced master data.
- Store status history and maintain audit events for business-critical
  mutations. Posted financial and inventory records are corrected using
  reversal/adjustment transactions, not destructive edits.
- Calculate flock metrics using documented formulas and edge-case handling:
  closing birds = opening - mortality - culling + authorized documented
  additions/transfers; mortality% = mortality/opening; livability =
  closing/initial; FCR = feed consumed/weight gain. Do not divide by zero or
  silently produce fabricated values.

### 6. API contract and frontend compatibility

#### Base conventions

- Use `/api/v1` for versioned JSON APIs. Use plural, kebab-case resource paths.
- Follow the existing adapter contract:
  - `GET /api/v1/{resource}` returns JSON with a `records` array.
  - `POST /api/v1/{resource}` creates and returns the created record.
  - `PUT /api/v1/{resource}/{id}` updates and returns the updated record.
  - `DELETE /api/v1/{resource}/{id}` returns 204 when successful.
- Keep domain-specific command endpoints for consequential workflows (place
  flock, record movement, confirm order, reserve stock, receive goods, dispatch,
  confirm delivery, issue invoice, post payment, approve/reject) instead of
  treating a status field update as sufficient authorization or validation.
- Preserve the frontend's typed response exceptions: `/api/v1/dashboard`
  returns the dashboard data object expected by `DashboardService`, and
  broiler/layer/breeder/hatchery responses include both `records` and the
  `performance` object expected by `ProductionResponse`. Other directory
  resources return `{ "records": [...] }` (plus pagination metadata when
  requested). Document every response shape in OpenAPI.
- Use typed request/response DTOs. Where the existing Angular directory
  component needs flat display records, provide stable projection DTOs with
  display fields and a `_demoId` string equal to the canonical UUID for
  backwards-compatible lookup/update calls. Never accept `_demoId`,
  `createdBy`, `tenantId`, calculated balance, permission, or audit fields as
  trusted client input.
- Support optional `page`, `size`, `sort`, `direction`, `q`, `status`, and
  domain filters on list endpoints. Enforce maximum page size and allowlisted
  sortable fields. Return pagination metadata while retaining the
  `records` property expected by the current frontend. Document that the
  current Angular adapter does not yet pass query parameters.
- Validate JSON input with Bean Validation and return consistent HTTP status
  codes. Use 201 + `Location` on create, 200 on reads/updates, 204 on delete,
  400 for invalid input, 401/403 for auth, 404 for inaccessible/not-found
  resources, and 409 for state, uniqueness, concurrency, or integrity conflicts.

#### Resource slugs used by the current Angular frontend

Implement and map these exact slugs to typed domain services/projections so
the existing adapter can be wired to the backend:

```text
dashboard
farms, sheds, batches, daily-operations, batch-transactions
broiler, layer, breeder, hatchery, health, medication, feed, feed-health
products, warehouses, inventory, transfers, stock-ledger
customers, suppliers, quotations, quotation-lines, orders, order-lines
sales, dispatch, dispatch-lines, invoices, receipts, inventory-reservations
leads, opportunities, follow-ups, complaints
employees, fleet, vehicles, vehicle-assignments
finance, receivables, payables, payments, expenses, profitability
reports, analytics, notifications, organization, users-roles, documents, audit,
administration
```

The slugs are UI-facing compatibility names; they do not require one database
table per slug. Map aliases to the correct domain module. Do not return
successful empty arrays for unsupported or unimplemented resources—return a
clear documented error until implemented.

#### Required API names and purposes

Implement the endpoint catalog in
`BACKEND-API-AND-DATABASE-CATALOG.md`, including purpose-specific read,
create, update, delete, and workflow-command operations. The following
business commands are mandatory; generic CRUD must not be used to bypass them:

```text
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
GET  /api/v1/auth/me
GET  /api/v1/dashboard
GET  /api/v1/batches/{id}/360
POST /api/v1/batches/{id}/place
POST /api/v1/batches/{id}/close
POST /api/v1/batches/{id}/movements
POST /api/v1/batches/{id}/daily-records
POST /api/v1/inventory/receipts
POST /api/v1/inventory/issues
POST /api/v1/inventory/transfers
POST /api/v1/inventory/adjustments
POST /api/v1/inventory/reservations
POST /api/v1/orders/{id}/confirm
POST /api/v1/orders/{id}/dispatches
POST /api/v1/dispatches/{id}/status
POST /api/v1/dispatches/{id}/complete
POST /api/v1/purchase-orders/{id}/approve
POST /api/v1/invoices/{id}/receipts
POST /api/v1/purchase-orders/{id}/receipts
POST /api/v1/payments/{id}/post
POST /api/v1/expenses/{id}/approve
POST /api/v1/expenses/{id}/reject
GET  /api/v1/search?q={query}
GET  /api/v1/reports/{reportKey}
GET  /api/v1/reports/{reportKey}/export?format=csv
GET  /api/v1/notifications
POST /api/v1/notifications/{id}/acknowledge
POST /api/v1/documents
GET  /api/v1/documents/{id}/download
GET  /actuator/health
```

Each endpoint must be documented with its HTTP method, exact path, purpose,
request DTO, response DTO, validation, required permission/scope, possible
status/error codes, tenant behavior, and an example in OpenAPI. Adapt/extend
paths when domain semantics require it, but document the final contract in
OpenAPI and backend README, and include the mapping if a path changes.

#### Consistent errors

Return a structured error body such as:

```json
{
  "timestamp": "2026-01-01T00:00:00Z",
  "status": 409,
  "code": "BATCH_CAPACITY_EXCEEDED",
  "message": "The selected shed does not have enough available capacity.",
  "correlationId": "..."
}
```

Implement global exception handling, human-readable safe messages, field-level
validation details, and correlation IDs. Never expose stack traces, SQL,
internal class names, credentials, or secrets to clients. Log exceptions
server-side with correlation ID and appropriate severity.

### 7. Domain workflows required end-to-end

Implement service logic and tests for the following core flows:

1. Create organization/branch, farm, shed, and batch; place flock only when
   permissions and farm/shed capacity allow.
2. Enter daily records and bird movements with reliable counts, calculations,
   date/duplicate checks, and transaction-safe occupancy updates.
3. Record feed, health, medication, vaccination, layer/breeder production,
   hatchery lifecycle, and relevant inventory consumption/ledger effects.
4. Purchase requisition → approval → purchase order → partial/full goods
   receipt and quality result → supplier invoice/payable → payment.
5. Customer/lead → quotation with line items → accepted quotation/order →
   credit and inventory reservation → partial/full dispatch and delivery →
   invoice → partial/full receipt/settlement.
6. Live bird sales: count, average weight, pricing basis, transport mortality,
   delivered quantity, and correct batch movement/stock and financial records.
7. Returns/credit notes, reversal/adjustment entries, expense approval/payment,
   and profitability projections.
8. Role/scope changes, user deactivation/session revocation, notification
   acknowledgement, and audit history.

Use explicit status enums and allowed transition maps; reject illegal or
terminal-state transitions with stable error codes. Never trust a requested
status from a generic update to bypass a workflow command.

### 8. Reports, dashboard, documents, and notifications

- Implement dashboard and report calculations from persisted tenant records,
  not fixture constants. Add the required farm, flock, production, trading,
  inventory, and finance report families, scoped filters, date ranges, and
  pagination/aggregation. Return accurately labeled empty states when there
  is no data.
- Implement CSV export for authorized users with permission checks, tenant
  scoping, safe CSV escaping/formula-injection protection, and bounded result
  sizes. Provide print/PDF-ready report data or a maintainable PDF export if
  feasible; do not falsely claim an export format that is not implemented.
- Create notification persistence, severity, recipient, read/acknowledged
  states, and configurable rules for required alerts. Do not claim email/SMS/
  push delivery unless a provider is configured and tested.
- Implement document metadata with secure storage abstraction and validated
  upload/download authorization linked to tenant and parent record. Enforce
  file size/type allowlists, safe filenames, and no public bucket access.
  A local filesystem provider may be used for development; keep credentials
  and storage configuration externalized.

### 9. Audit, security, and observability

- Write append-only audit records with tenant, actor, action, entity/resource,
  entity ID, timestamp, outcome, correlation ID, and relevant redacted
  before/after values. Audit authentication/security changes, user/role/scope
  changes, approvals, posting, stock movements, and important lifecycle
  events. No normal API can alter/delete audit records.
- Validate all external input; use parameterized JPA queries; prevent
  mass-assignment by mapping explicit DTO fields; secure file uploads; set
  security headers; rate-limit sensitive authentication endpoints where
  practical. Never store secrets in source, migration files, fixtures, logs,
  or committed environment files.
- Add structured JSON-capable logs, request correlation ID propagation, health
  and readiness checks, and useful operational metrics where straightforward.
  Do not report a healthy database when it is unavailable.
- Externalize DB credentials, signing keys, allowed origins, upload limits,
  and token lifetimes through environment-backed configuration. Include a safe
  `.env.example` with placeholders only; ensure `.env` and secrets are ignored.

### 10. Database migrations, demo seed, deployment

- Create a complete normalized PostgreSQL schema using ordered Flyway
  migrations. Include constraints and indexes for tenant-scoped lookup,
  foreign-key joins, batch/date operations, ledger history, order status,
  invoice due dates, and report filters.
- Implement the table and column inventory in
  `BACKEND-API-AND-DATABASE-CATALOG.md` as actual migration SQL; the catalog is
  not a substitute for DDL. Keep each migration in its own `.sql` file and
  separate schema migrations from optional development seed scripts. Include
  all PK/FK/unique/check constraints and useful indexes explicitly. Record any
  added, renamed, or deliberately omitted column in a mapping/decision section
  of `backend/README.md`.
- Seed realistic, clearly fictional development data for at least two
  organizations, with farms/sheds/flocks and representative inventory,
  customers, suppliers, orders, finance, users, roles, and permissions.
  Ensure tenant separation in the seed set. Seed no shared production
  credentials; bootstrap the first administrator only from required
  environment variables or a documented one-time secure bootstrap command.
- Add backend `Dockerfile` and root/backend Docker Compose setup for the Java
  API and PostgreSQL with health checks, persistent DB volume, migrations, and
  environment-based secrets. Do not publish default production passwords.
- Add a backend README covering prerequisites, local startup, migrations,
  secure admin bootstrap, API docs, test commands, configuration, and Angular
  adapter integration. Document that the Angular app currently uses
  `JsonFileAdapter`, and identify the provider switch and authentication/
  interceptor/query-param work needed to connect it safely.
- Add a CI workflow only if consistent with the existing repository setup;
  pipeline must run Maven verification and must not depend on real secrets.

### 11. Testing and completion gate

Write meaningful tests, not only context-start tests:

- Unit tests for domain calculations, validation, and lifecycle transition
  rules.
- Repository/integration tests against PostgreSQL (Testcontainers preferred)
  for tenant-scoped queries, uniqueness, constraints, and transaction rollback.
- Spring Security/API tests for login, token refresh/revocation, 401/403, role
  permissions, scope boundaries, and deactivated users.
- Workflow integration tests for capacity, daily movements, immutable stock
  ledger/reservation, procurement receipt, order-to-payment path, partial
  delivery/receipt, credit limits, and separation of duties.
- Audit/error tests proving sensitive fields and stack traces are not leaked.
- Keep tests deterministic, isolated, and runnable without production
  credentials or external services.

Before reporting completion:

1. Run `mvn -f backend/pom.xml verify` (or document the exact equivalent if
   project layout differs).
2. Start the app and PostgreSQL through documented local configuration when
   environment supports it; verify migrations and `/actuator/health`.
3. Verify OpenAPI is generated and that every UI-facing slug is mapped.
4. Fix all failures introduced by the implementation. Do not state a check
   passed unless it actually ran and passed.
5. List implemented modules, migrations, security boundaries, test/build
   results, and any explicitly blocked third-party integrations. Be candid
   about remaining gaps; never claim “production-ready” based only on a
   successful compile.

### 12. Implementation quality constraints

- Prefer clear, maintainable Java and explicit types. Avoid raw maps for
  domain writes, reflection-driven generic CRUD, giant services/controllers,
  broad exception catches, silent defaults, and unchecked casts.
- Do not skip authorization because a UI hides a control. Do not use local
  arrays or in-memory maps as production persistence. Do not hard-code
  business data, passwords, tenant IDs, signing secrets, approval limits, or
  storage credentials.
- Do not delete or overwrite existing user changes. Keep frontend code and
  unrelated project files unchanged.
- Update documentation when API or domain behavior requires it. If the
  repository's present constraints prevent a required production capability,
  implement the safest complete boundary possible and state the exact
  limitation rather than faking it.

## Acceptance checklist

- [ ] `backend/` is a standalone, buildable Java 21/Spring Boot Maven project.
- [ ] PostgreSQL persistence and Flyway migrations work from a clean database.
- [ ] API catalog entries have documented name, purpose, DTOs, authorization,
      validation, and response/error behavior.
- [ ] Database tables and columns are represented in separate ordered,
      executable Flyway SQL migration files and verified after migration.
- [ ] All required domains have typed models/services/APIs, validations, and
      tests; no required screen resource silently returns fake success.
- [ ] Tenant isolation and server-side role, permission, and scope checks are
      tested on reads and writes.
- [ ] Core operational, procurement, sales, inventory, and finance workflows
      are transactional and tested.
- [ ] The existing frontend's resource slugs and `{ records: [...] }` response
      contract are supported or documented with precise integration deltas.
- [ ] OpenAPI, structured errors, audit history, health checks, secure
      configuration, seed data, Docker setup, and run documentation are
      present.
- [ ] Build and tests have been run; results are reported accurately.
