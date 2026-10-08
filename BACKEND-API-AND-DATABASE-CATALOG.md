# Backend API and Database Catalog

This catalog supplements [BACKEND-IMPLEMENTATION-INSTRUCTIONS.md](./BACKEND-IMPLEMENTATION-INSTRUCTIONS.md).
It specifies the API names/purposes and the minimum relational tables/columns
the backend generator must implement. It is a contract, not executable DDL:
the generated backend must create and verify separate Flyway SQL migration
scripts under `backend/src/main/resources/db/migration/`.

## 1. API conventions

- API base path: `/api/v1`.
- Resource names are plural kebab-case. IDs are UUIDs.
- All tenant-owned queries and mutations derive organization scope from the
  authenticated principal.
- CRUD resources support list/detail/create/update/delete only when the domain
  permits those operations. Posted financial and inventory transactions are
  immutable; correct them with reversal/adjustment commands.
- List responses use:

  ```json
  {
    "records": [],
    "page": 0,
    "size": 25,
    "totalElements": 0,
    "totalPages": 0
  }
  ```

- Create returns `201 Created` and the created projection; update returns
  `200 OK`; successful delete returns `204 No Content`.
- Command endpoints return the resulting resource or a typed command result.
  They must perform domain validation, permission/scope checks, concurrency
  protection, and audit logging.
- Every endpoint must appear in generated OpenAPI with its purpose, DTO
  schema, permission/scope, validation, status codes, and an example.
- Never accept tenant ownership, computed balances, security roles, audit
  fields, or `_demoId` as trusted writable input.

## 2. Authentication and user administration API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/auth/login` | Authenticate active user and issue access/refresh credentials. |
| `POST` | `/auth/refresh` | Rotate a valid refresh token and issue a new access token. |
| `POST` | `/auth/logout` | Revoke the current refresh session. |
| `POST` | `/auth/logout-all` | Revoke all sessions for the authenticated user; requires explicit permission or self-service policy. |
| `POST` | `/auth/forgot-password` | Start a generic-response password reset without disclosing account existence. |
| `POST` | `/auth/reset-password` | Validate one-time reset token and update password. |
| `GET` | `/auth/me` | Return the authenticated profile, tenant, effective permissions, and scopes. |
| `GET/POST` | `/users` | List users in the current organization / invite or create a user. |
| `GET/PUT` | `/users/{id}` | Read or update an in-tenant user's permitted profile fields. |
| `POST` | `/users/{id}/deactivate` | Deactivate the user and revoke active sessions. |
| `POST` | `/users/{id}/activate` | Reactivate an eligible user. |
| `PUT` | `/users/{id}/roles` | Assign roles and scopes with audit and separation-of-duties checks. |
| `GET` | `/roles` | List roles visible to the current organization. |
| `POST` | `/roles` | Create a tenant custom role. |
| `PUT` | `/roles/{id}/permissions` | Replace a custom role's permission set after validation. |
| `GET` | `/permissions` | Return the supported atomic permission catalog. |

## 3. API resource names and purposes

For each resource below, implement `GET /{resource}` and
`GET /{resource}/{id}`. Implement `POST /{resource}`, `PUT /{resource}/{id}`,
and `DELETE /{resource}/{id}` only where safe and allowed by the domain. The
backend must give every resource a typed DTO and purpose-specific
authorization; the list is not permission to create generic untyped CRUD.

| Resource path | Purpose |
|---|---|
| `/organizations` | Tenant legal/business profile, regional settings, numbering, currency, and configuration. |
| `/business-units` | Organization branches, offices, and units used for ownership and reporting scope. |
| `/farms` | Farm identity, location, capacity, contacts, status, and operational summary. |
| `/sheds` | Farm-associated housing, capacity, occupancy projection, and equipment. |
| `/batches` | Flock identity, placement, current birds, lifecycle, performance summary, and farm/shed association. |
| `/daily-operations` | Dated flock observations: birds, mortality, culling, feed, weight, environment, and notes. |
| `/batch-transactions` | Append-only bird movement ledger with before/after counts and reason. |
| `/broiler` | Broiler records and actual/target growth, FCR, mortality, and performance series. |
| `/layer` | Layer records, egg grades/production, feed, and production-rate metrics. |
| `/breeder` | Breeder records, male/female counts, fertility, hatchability, and production. |
| `/hatchery` | Egg set lifecycle, candling, transfer, hatch, chick grading, and outcomes. |
| `/health` | Flock health incidents, diagnosis, cause, veterinary review, and outcome. |
| `/medication` | Treatment and vaccination plans, doses, administration, costs, and linked flock/medicine. |
| `/feed` | Feed plans, issue/consumption, variance, feed type, batch, and cost. |
| `/feed-health` | Dashboard projection of feed, medication, and health supplies needing attention. |
| `/products` | Product catalog, classification, SKU, units, and prices. |
| `/warehouses` | Warehouse identity, location, manager, and status. |
| `/inventory` | Calculated stock position by product, lot, and warehouse; never a directly writable balance. |
| `/transfers` | Stock transfer lifecycle between warehouses/farms and its lines. |
| `/stock-ledger` | Append-only stock movement history and derived running balance. |
| `/inventory/receipts` | Post received stock to inventory with source, quantity, lot, and expiry. |
| `/inventory/issues` | Issue stock to an authorized farm, shed, batch, or business transaction. |
| `/inventory/adjustments` | Record reason-coded stock variance using an auditable adjustment transaction. |
| `/inventory/reservations` | Reserve/release sellable stock against a confirmed order without double allocation. |
| `/customers` | Customer profile, contacts, terms, tax details, credit limits, and derived outstanding. |
| `/suppliers` | Supplier profile, contacts, terms, tax details, and procurement relationships. |
| `/quotations` | Sales quotations, validity, customer, amount, and lifecycle. |
| `/quotation-lines` | Typed product/bird/egg/feed quote line items and pricing basis. |
| `/orders` | Customer sales orders, approval/status, credit and fulfillment summary. |
| `/order-lines` | Order quantities, prices, allocations, and delivered/reserved totals. |
| `/sales` | Sales/trading projections from authoritative orders, deliveries, and invoices. |
| `/dispatch` | Delivery order, vehicle/driver, route, schedule, status, and proof of delivery. |
| `/dispatch-lines` | Per-order line shipped/delivered quantity, mortality, and outcome. |
| `/invoices` | Issued customer or supplier invoice, totals, due date, and computed balance. |
| `/receipts` | Customer receipts and invoice allocations. |
| `/leads` | CRM prospects, qualification, owner, and conversion history. |
| `/opportunities` | Sales opportunity, stage, amount, close date, and customer linkage. |
| `/follow-ups` | CRM tasks, reminders, call notes, owner, and completion status. |
| `/complaints` | Customer service cases, severity, ownership, and resolution history. |
| `/employees` | Employee profile, department, designation, farm/unit assignment, and protected personal fields. |
| `/vehicles` | Fleet asset, registration, capacity, certificates, purchase/sale, and status. |
| `/vehicle-assignments` | Vehicle/driver/trip assignment and trip status history. |
| `/finance` | Finance overview projection based on posted ledgers and transactions. |
| `/receivables` | Outstanding customer invoices and aging projection. |
| `/payables` | Outstanding supplier invoices and aging projection. |
| `/payments` | Payment/receipt lifecycle, posting, allocations, and audit trail. |
| `/expenses` | Categorized, scoped, submitted/approved/paid business expenses. |
| `/profitability` | Computed P&L projections by company, unit, farm, batch, product, and customer. |
| `/reports` | Available report definitions and scoped report data. |
| `/analytics` | Derived business metrics and trend series. |
| `/notifications` | Recipient-scoped persisted alerts and acknowledgement state. |
| `/documents` | Secure document metadata and authorized file upload/download. |
| `/audit` | Append-only, permission-protected audit history. |
| `/administration` | Organization-level administrative projections; never expose credentials or secrets. |

Compatibility aliases such as `/fleet` may map to the appropriate typed
resource internally. Document aliases and ensure they do not bypass access
checks.

## 4. Required domain command APIs

These commands are separate from CRUD and describe their intended effect:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/dashboard` | Return tenant-scoped KPIs and trends derived from persisted data. |
| `GET` | `/batches/{id}/360` | Return batch overview, permitted related records, performance, alerts, and history. |
| `POST` | `/batches/{id}/place` | Place a planned flock after capacity, permission, and lifecycle checks. |
| `POST` | `/batches/{id}/close` | Close a completed batch only after zero-bird and closeout validations. |
| `POST` | `/batches/{id}/movements` | Record mortality, culling, sale/lifting, transfer, or authorized adjustment and update counts atomically. |
| `POST` | `/batches/{id}/daily-records` | Create a validated dated flock record and update derived operational state atomically. |
| `POST` | `/purchase-orders/{id}/approve` | Approve/reject a submitted PO under scope, amount limit, and separation-of-duties policy. |
| `POST` | `/purchase-orders/{id}/receipts` | Record partial/full goods receipt and quality outcomes; post accepted quantities to stock. |
| `POST` | `/orders/{id}/confirm` | Confirm a draft order after customer/credit/stock checks and reserve stock atomically. |
| `POST` | `/orders/{id}/dispatches` | Create dispatch for remaining order quantities with reservation and scope checks. |
| `POST` | `/dispatches/{id}/status` | Apply only an allowed dispatch state transition and append status history. |
| `POST` | `/dispatches/{id}/complete` | Record delivered/failed/partial quantities, transport mortality, and proof; update linked batch/stock/order atomically. |
| `POST` | `/invoices/{id}/receipts` | Record and allocate a customer receipt within outstanding/overpayment policy. |
| `POST` | `/payments/{id}/post` | Post a validated payment/receipt to the appropriate financial ledger. |
| `POST` | `/expenses/{id}/approve` | Approve an eligible expense within scope and configured approval limits. |
| `POST` | `/expenses/{id}/reject` | Reject a submitted expense with a required reason and audit event. |
| `GET` | `/search?q={query}` | Search only authorized tenant records across supported types. |
| `GET` | `/reports/{reportKey}` | Return a named report with supported date and business-scope filters. |
| `GET` | `/reports/{reportKey}/export?format=csv` | Export authorized, bounded report data as safely escaped CSV. |
| `POST` | `/notifications/{id}/acknowledge` | Acknowledge an alert for the authorized recipient. |
| `POST` | `/documents` | Upload a validated file and create linked, tenant-scoped metadata. |
| `GET` | `/documents/{id}/download` | Authorize and stream a linked document from private storage. |

Prefix these paths with `/api/v1`. Authentication paths are listed in
section 2. Add commands for other status changes only when they enforce an
explicit lifecycle transition and authorization rule.

## 5. Canonical relational table and column inventory

Use PostgreSQL `snake_case`. The lists below name required business columns;
add columns when domain behavior requires them. Use UUID PKs named `id` unless
the table is a pure join table. UUID foreign keys are named `<entity>_id`.
Avoid duplicating a derivable value as authoritative state.

### Common conventions

- Every tenant-owned table has `organization_id UUID NOT NULL` directly or is
  owned through an FK path that is checked in every query and mutation.
- Every mutable business table has `id UUID PRIMARY KEY`, `created_at
  TIMESTAMPTZ NOT NULL`, `created_by UUID`, `updated_at TIMESTAMPTZ NOT NULL`,
  `updated_by UUID`, and where appropriate `deleted_at TIMESTAMPTZ` and
  `version BIGINT NOT NULL DEFAULT 0`.
- Append-only ledger/audit tables have `created_at`, `created_by`, and no
  update/delete API. Do not add misleading `updated_at` to immutable events.
- Use `NUMERIC(19,4)` or more suitable documented precision for money,
  quantities, rates, and weights; `CHAR(3)` for ISO currency; `DATE` for
  business dates; `TIMESTAMPTZ` for event timestamps; `BOOLEAN` for flags;
  constrained `VARCHAR` for codes/statuses; `JSONB` only for genuinely
  flexible, non-relational metadata.
- Apply organization-scoped unique constraints to codes and business
  identifiers. All FK pairs that cross tenant-owned tables must be validated
  to belong to the same organization (composite FK or service constraint plus
  tests).

### Identity and organization

| Table | Required business columns (in addition to common columns) |
|---|---|
| `organizations` | `legal_name VARCHAR(200) NOT NULL`, `display_name VARCHAR(200) NOT NULL`, `code VARCHAR(50) NOT NULL`, `status VARCHAR(24) NOT NULL`, `default_currency CHAR(3) NOT NULL`, `timezone VARCHAR(80) NOT NULL`, `tax_number VARCHAR(80)`, `fiscal_year_start DATE`, `settings JSONB NOT NULL DEFAULT '{}'`. This is the tenant root; `organization_id` is not self-referential. |
| `business_units` | `organization_id UUID NOT NULL`, `code VARCHAR(50) NOT NULL`, `name VARCHAR(200) NOT NULL`, `unit_type VARCHAR(40) NOT NULL`, `address TEXT`, `timezone VARCHAR(80)`, `status VARCHAR(24) NOT NULL`. |
| `users` | `organization_id UUID NOT NULL`, `email VARCHAR(320) NOT NULL`, `normalized_email VARCHAR(320) NOT NULL`, `password_hash VARCHAR(255) NOT NULL`, `full_name VARCHAR(200) NOT NULL`, `status VARCHAR(24) NOT NULL`, `last_login_at TIMESTAMPTZ`, `password_changed_at TIMESTAMPTZ`. |
| `roles` | `organization_id UUID` (null only for immutable platform defaults), `code VARCHAR(80) NOT NULL`, `name VARCHAR(120) NOT NULL`, `description TEXT`, `platform_role BOOLEAN NOT NULL DEFAULT FALSE`, `system_role BOOLEAN NOT NULL DEFAULT FALSE`. |
| `permissions` | `code VARCHAR(160) PRIMARY KEY`, `resource VARCHAR(80) NOT NULL`, `action VARCHAR(40) NOT NULL`, `description TEXT NOT NULL`. |
| `role_permissions` | `role_id UUID NOT NULL`, `permission_code VARCHAR(160) NOT NULL`, composite PK `(role_id, permission_code)`. |
| `user_role_assignments` | `organization_id UUID NOT NULL`, `user_id UUID NOT NULL`, `role_id UUID NOT NULL`, `assigned_by UUID NOT NULL`, `assigned_at TIMESTAMPTZ NOT NULL`, `expires_at TIMESTAMPTZ`. |
| `user_scopes` | `organization_id UUID NOT NULL`, `user_id UUID NOT NULL`, `scope_type VARCHAR(32) NOT NULL`, `scope_id UUID`, `scope_code VARCHAR(100)`, `granted_by UUID NOT NULL`, `granted_at TIMESTAMPTZ NOT NULL`. |
| `refresh_tokens` | `organization_id UUID NOT NULL`, `user_id UUID NOT NULL`, `token_hash VARCHAR(255) NOT NULL`, `family_id UUID NOT NULL`, `issued_at TIMESTAMPTZ NOT NULL`, `expires_at TIMESTAMPTZ NOT NULL`, `revoked_at TIMESTAMPTZ`, `replaced_by_token_id UUID`, `created_ip INET`. |
| `password_reset_tokens` | `user_id UUID NOT NULL`, `token_hash VARCHAR(255) NOT NULL`, `created_at TIMESTAMPTZ NOT NULL`, `expires_at TIMESTAMPTZ NOT NULL`, `used_at TIMESTAMPTZ`. |

### Master data and farm operations

| Table | Required business columns |
|---|---|
| `farms` | `organization_id UUID NOT NULL`, `business_unit_id UUID`, `code VARCHAR(50) NOT NULL`, `name VARCHAR(200) NOT NULL`, `owner_name VARCHAR(200)`, `contact_phone VARCHAR(40)`, `address TEXT`, `location_id UUID`, `capacity INTEGER NOT NULL CHECK (capacity >= 0)`, `farm_type VARCHAR(40)`, `status VARCHAR(24) NOT NULL`, `notes TEXT`. |
| `sheds` | `organization_id UUID NOT NULL`, `farm_id UUID NOT NULL`, `code VARCHAR(50) NOT NULL`, `name VARCHAR(200) NOT NULL`, `shed_type VARCHAR(40)`, `capacity INTEGER NOT NULL CHECK (capacity >= 0)`, `construction_date DATE`, `equipment JSONB NOT NULL DEFAULT '[]'`, `status VARCHAR(24) NOT NULL`. Occupancy is derived from flock/movement records, not a freely writable authoritative column. |
| `breeds` | `organization_id UUID NOT NULL`, `code VARCHAR(50) NOT NULL`, `name VARCHAR(120) NOT NULL`, `bird_type VARCHAR(40) NOT NULL`, `description TEXT`, `status VARCHAR(24) NOT NULL`. |
| `product_categories` | `organization_id UUID NOT NULL`, `code VARCHAR(50) NOT NULL`, `name VARCHAR(120) NOT NULL`, `parent_id UUID`, `status VARCHAR(24) NOT NULL`. |
| `products` | `organization_id UUID NOT NULL`, `category_id UUID`, `sku VARCHAR(80) NOT NULL`, `name VARCHAR(200) NOT NULL`, `product_type VARCHAR(40) NOT NULL`, `unit_code VARCHAR(30) NOT NULL`, `tax_code VARCHAR(50)`, `sale_price NUMERIC(19,4)`, `purchase_price NUMERIC(19,4)`, `track_lot BOOLEAN NOT NULL DEFAULT FALSE`, `track_expiry BOOLEAN NOT NULL DEFAULT FALSE`, `status VARCHAR(24) NOT NULL`. |
| `warehouses` | `organization_id UUID NOT NULL`, `business_unit_id UUID`, `code VARCHAR(50) NOT NULL`, `name VARCHAR(200) NOT NULL`, `address TEXT`, `manager_user_id UUID`, `status VARCHAR(24) NOT NULL`. |
| `customers` | `organization_id UUID NOT NULL`, `code VARCHAR(50) NOT NULL`, `name VARCHAR(200) NOT NULL`, `customer_type VARCHAR(40)`, `phone VARCHAR(40)`, `email VARCHAR(320)`, `address TEXT`, `tax_number VARCHAR(80)`, `credit_limit NUMERIC(19,4) NOT NULL DEFAULT 0`, `payment_terms_days INTEGER NOT NULL DEFAULT 0`, `salesperson_user_id UUID`, `status VARCHAR(24) NOT NULL`. Outstanding balance is derived from posted invoices and allocations. |
| `suppliers` | `organization_id UUID NOT NULL`, `code VARCHAR(50) NOT NULL`, `name VARCHAR(200) NOT NULL`, `phone VARCHAR(40)`, `email VARCHAR(320)`, `address TEXT`, `tax_number VARCHAR(80)`, `payment_terms_days INTEGER NOT NULL DEFAULT 0`, `status VARCHAR(24) NOT NULL`. |
| `employees` | `organization_id UUID NOT NULL`, `employee_code VARCHAR(50) NOT NULL`, `user_id UUID`, `full_name VARCHAR(200) NOT NULL`, `department VARCHAR(120)`, `designation VARCHAR(120)`, `phone VARCHAR(40)`, `email VARCHAR(320)`, `business_unit_id UUID`, `farm_id UUID`, `hire_date DATE`, `employment_status VARCHAR(24) NOT NULL`, `sensitive_profile JSONB`. Protect sensitive data with explicit field-level authorization; do not put payroll secrets in generic JSON. |
| `vehicles` | `organization_id UUID NOT NULL`, `registration_number VARCHAR(40) NOT NULL`, `vehicle_type VARCHAR(60) NOT NULL`, `capacity_kg NUMERIC(12,3)`, `purchase_date DATE`, `purchase_price NUMERIC(19,4)`, `insurance_due_date DATE`, `permit_due_date DATE`, `status VARCHAR(24) NOT NULL`. |
| `batches` | `organization_id UUID NOT NULL`, `batch_number VARCHAR(80) NOT NULL`, `farm_id UUID NOT NULL`, `shed_id UUID NOT NULL`, `bird_type VARCHAR(40) NOT NULL`, `breed_id UUID`, `supplier_id UUID`, `placement_date DATE`, `initial_quantity INTEGER NOT NULL CHECK (initial_quantity >= 0)`, `status VARCHAR(32) NOT NULL`, `target_weight_kg NUMERIC(10,4)`, `closed_at TIMESTAMPTZ`, `version BIGINT NOT NULL DEFAULT 0`. Current bird quantity is derived from authorized opening/placement and movement ledger entries. |
| `batch_movements` | `organization_id UUID NOT NULL`, `batch_id UUID NOT NULL`, `movement_type VARCHAR(32) NOT NULL`, `quantity INTEGER NOT NULL CHECK (quantity > 0)`, `occurred_on DATE NOT NULL`, `birds_before INTEGER NOT NULL`, `birds_after INTEGER NOT NULL`, `reason TEXT NOT NULL`, `source_type VARCHAR(40)`, `source_id UUID`, `created_at TIMESTAMPTZ NOT NULL`, `created_by UUID NOT NULL`. Append-only. |
| `daily_flock_records` | `organization_id UUID NOT NULL`, `batch_id UUID NOT NULL`, `recorded_on DATE NOT NULL`, `opening_birds INTEGER NOT NULL`, `mortality INTEGER NOT NULL DEFAULT 0`, `culling INTEGER NOT NULL DEFAULT 0`, `closing_birds INTEGER NOT NULL`, `feed_quantity NUMERIC(14,4)`, `feed_unit VARCHAR(30)`, `average_weight_kg NUMERIC(10,4)`, `water_quantity NUMERIC(14,4)`, `temperature_c NUMERIC(6,2)`, `humidity_percent NUMERIC(6,2)`, `notes TEXT`, `created_at TIMESTAMPTZ NOT NULL`, `created_by UUID NOT NULL`. |
| `weight_records` | `organization_id UUID NOT NULL`, `batch_id UUID NOT NULL`, `measured_on DATE NOT NULL`, `sample_size INTEGER NOT NULL`, `average_weight_kg NUMERIC(10,4) NOT NULL`, `target_weight_kg NUMERIC(10,4)`, `created_at TIMESTAMPTZ NOT NULL`, `created_by UUID NOT NULL`. |
| `layer_production_records` | `organization_id UUID NOT NULL`, `batch_id UUID NOT NULL`, `recorded_on DATE NOT NULL`, `eggs_total INTEGER NOT NULL`, `eggs_broken INTEGER NOT NULL DEFAULT 0`, `eggs_damaged INTEGER NOT NULL DEFAULT 0`, `eggs_saleable INTEGER NOT NULL`, `grade_counts JSONB NOT NULL DEFAULT '{}'`, `feed_quantity NUMERIC(14,4)`, `created_at TIMESTAMPTZ NOT NULL`, `created_by UUID NOT NULL`. |
| `breeder_production_records` | `organization_id UUID NOT NULL`, `batch_id UUID NOT NULL`, `recorded_on DATE NOT NULL`, `male_birds INTEGER NOT NULL`, `female_birds INTEGER NOT NULL`, `eggs_total INTEGER NOT NULL`, `fertile_eggs INTEGER`, `incubated_eggs INTEGER`, `created_at TIMESTAMPTZ NOT NULL`, `created_by UUID NOT NULL`. |
| `hatchery_batches` | `organization_id UUID NOT NULL`, `hatchery_code VARCHAR(50) NOT NULL`, `source_batch_id UUID`, `set_on DATE NOT NULL`, `eggs_set INTEGER NOT NULL`, `fertile_eggs INTEGER`, `transferred_eggs INTEGER`, `hatched_chicks INTEGER`, `saleable_chicks INTEGER`, `rejected_chicks INTEGER`, `status VARCHAR(32) NOT NULL`, `completed_at TIMESTAMPTZ`. |
| `feed_types` | `organization_id UUID NOT NULL`, `code VARCHAR(50) NOT NULL`, `name VARCHAR(120) NOT NULL`, `unit_code VARCHAR(30) NOT NULL`, `status VARCHAR(24) NOT NULL`. |
| `feed_transactions` | `organization_id UUID NOT NULL`, `feed_type_id UUID NOT NULL`, `batch_id UUID`, `warehouse_id UUID`, `transaction_type VARCHAR(32) NOT NULL`, `quantity NUMERIC(14,4) NOT NULL`, `unit_code VARCHAR(30) NOT NULL`, `unit_cost NUMERIC(19,4)`, `occurred_at TIMESTAMPTZ NOT NULL`, `reference_type VARCHAR(40)`, `reference_id UUID`, `created_by UUID NOT NULL`, `created_at TIMESTAMPTZ NOT NULL`. |
| `health_incidents` | `organization_id UUID NOT NULL`, `batch_id UUID NOT NULL`, `reported_at TIMESTAMPTZ NOT NULL`, `disease_name VARCHAR(160)`, `symptoms TEXT`, `diagnosis TEXT`, `birds_affected INTEGER NOT NULL DEFAULT 0`, `mortality_cause VARCHAR(160)`, `veterinarian_user_id UUID`, `status VARCHAR(32) NOT NULL`, `resolved_at TIMESTAMPTZ`. |
| `treatments` | `organization_id UUID NOT NULL`, `batch_id UUID NOT NULL`, `medicine_product_id UUID NOT NULL`, `health_incident_id UUID`, `dosage VARCHAR(120) NOT NULL`, `start_date DATE NOT NULL`, `end_date DATE`, `vet_user_id UUID`, `cost NUMERIC(19,4)`, `status VARCHAR(32) NOT NULL`, `notes TEXT`. |
| `vaccinations` | `organization_id UUID NOT NULL`, `batch_id UUID NOT NULL`, `vaccine_product_id UUID NOT NULL`, `scheduled_on DATE NOT NULL`, `administered_at TIMESTAMPTZ`, `dose VARCHAR(120) NOT NULL`, `administered_by UUID`, `status VARCHAR(32) NOT NULL`, `notes TEXT`. |

### Inventory and procurement

| Table | Required business columns |
|---|---|
| `inventory_lots` | `organization_id UUID NOT NULL`, `product_id UUID NOT NULL`, `lot_number VARCHAR(100) NOT NULL`, `expiry_date DATE`, `received_on DATE NOT NULL`, `supplier_id UUID`, `status VARCHAR(24) NOT NULL`. |
| `inventory_transactions` | `organization_id UUID NOT NULL`, `product_id UUID NOT NULL`, `warehouse_id UUID NOT NULL`, `lot_id UUID`, `transaction_type VARCHAR(32) NOT NULL`, `quantity_delta NUMERIC(14,4) NOT NULL CHECK (quantity_delta <> 0)`, `unit_cost NUMERIC(19,4)`, `occurred_at TIMESTAMPTZ NOT NULL`, `reference_type VARCHAR(40)`, `reference_id UUID`, `reversal_of_id UUID`, `reason TEXT`, `created_at TIMESTAMPTZ NOT NULL`, `created_by UUID NOT NULL`. Append-only. |
| `inventory_reservations` | `organization_id UUID NOT NULL`, `product_id UUID NOT NULL`, `warehouse_id UUID NOT NULL`, `lot_id UUID`, `order_line_id UUID NOT NULL`, `quantity NUMERIC(14,4) NOT NULL CHECK (quantity > 0)`, `status VARCHAR(24) NOT NULL`, `reserved_at TIMESTAMPTZ NOT NULL`, `released_at TIMESTAMPTZ`. |
| `purchase_requisitions` | `organization_id UUID NOT NULL`, `requisition_number VARCHAR(80) NOT NULL`, `requested_by UUID NOT NULL`, `business_unit_id UUID`, `requested_on DATE NOT NULL`, `status VARCHAR(32) NOT NULL`, `reason TEXT`. |
| `purchase_orders` | `organization_id UUID NOT NULL`, `order_number VARCHAR(80) NOT NULL`, `supplier_id UUID NOT NULL`, `business_unit_id UUID`, `ordered_on DATE NOT NULL`, `expected_on DATE`, `currency CHAR(3) NOT NULL`, `subtotal NUMERIC(19,4) NOT NULL`, `tax_total NUMERIC(19,4) NOT NULL`, `total NUMERIC(19,4) NOT NULL`, `status VARCHAR(32) NOT NULL`, `created_by UUID NOT NULL`. |
| `purchase_order_lines` | `organization_id UUID NOT NULL`, `purchase_order_id UUID NOT NULL`, `product_id UUID NOT NULL`, `ordered_quantity NUMERIC(14,4) NOT NULL`, `received_quantity NUMERIC(14,4) NOT NULL DEFAULT 0`, `unit_code VARCHAR(30) NOT NULL`, `unit_price NUMERIC(19,4) NOT NULL`, `tax_rate NUMERIC(7,4) NOT NULL DEFAULT 0`. |
| `goods_receipts` | `organization_id UUID NOT NULL`, `receipt_number VARCHAR(80) NOT NULL`, `purchase_order_id UUID NOT NULL`, `warehouse_id UUID NOT NULL`, `received_at TIMESTAMPTZ NOT NULL`, `received_by UUID NOT NULL`, `status VARCHAR(32) NOT NULL`, `quality_notes TEXT`. |
| `goods_receipt_lines` | `organization_id UUID NOT NULL`, `goods_receipt_id UUID NOT NULL`, `purchase_order_line_id UUID NOT NULL`, `accepted_quantity NUMERIC(14,4) NOT NULL`, `rejected_quantity NUMERIC(14,4) NOT NULL DEFAULT 0`, `lot_id UUID`, `rejection_reason TEXT`. |

### Sales, delivery, finance, and shared records

| Table | Required business columns |
|---|---|
| `quotations` | `organization_id UUID NOT NULL`, `quotation_number VARCHAR(80) NOT NULL`, `customer_id UUID NOT NULL`, `created_on DATE NOT NULL`, `valid_until DATE`, `currency CHAR(3) NOT NULL`, `subtotal NUMERIC(19,4) NOT NULL`, `tax_total NUMERIC(19,4) NOT NULL`, `total NUMERIC(19,4) NOT NULL`, `status VARCHAR(32) NOT NULL`, `notes TEXT`, `created_by UUID NOT NULL`. |
| `quotation_lines` | `organization_id UUID NOT NULL`, `quotation_id UUID NOT NULL`, `product_id UUID`, `batch_id UUID`, `description VARCHAR(240) NOT NULL`, `pricing_basis VARCHAR(24) NOT NULL`, `quantity NUMERIC(14,4) NOT NULL`, `unit_code VARCHAR(30) NOT NULL`, `average_weight_kg NUMERIC(10,4)`, `unit_price NUMERIC(19,4) NOT NULL`, `line_total NUMERIC(19,4) NOT NULL`. |
| `sales_orders` | `organization_id UUID NOT NULL`, `order_number VARCHAR(80) NOT NULL`, `customer_id UUID NOT NULL`, `quotation_id UUID`, `ordered_on DATE NOT NULL`, `currency CHAR(3) NOT NULL`, `subtotal NUMERIC(19,4) NOT NULL`, `tax_total NUMERIC(19,4) NOT NULL`, `total NUMERIC(19,4) NOT NULL`, `payment_terms_days INTEGER NOT NULL DEFAULT 0`, `status VARCHAR(32) NOT NULL`, `created_by UUID NOT NULL`. |
| `sales_order_lines` | `organization_id UUID NOT NULL`, `sales_order_id UUID NOT NULL`, `product_id UUID`, `batch_id UUID`, `description VARCHAR(240) NOT NULL`, `pricing_basis VARCHAR(24) NOT NULL`, `ordered_quantity NUMERIC(14,4) NOT NULL`, `delivered_quantity NUMERIC(14,4) NOT NULL DEFAULT 0`, `unit_code VARCHAR(30) NOT NULL`, `unit_price NUMERIC(19,4) NOT NULL`, `line_total NUMERIC(19,4) NOT NULL`. |
| `dispatches` | `organization_id UUID NOT NULL`, `dispatch_number VARCHAR(80) NOT NULL`, `sales_order_id UUID NOT NULL`, `vehicle_id UUID`, `driver_employee_id UUID`, `scheduled_at TIMESTAMPTZ`, `dispatched_at TIMESTAMPTZ`, `delivered_at TIMESTAMPTZ`, `status VARCHAR(32) NOT NULL`, `route TEXT`, `proof_document_id UUID`, `failure_reason TEXT`. |
| `dispatch_lines` | `organization_id UUID NOT NULL`, `dispatch_id UUID NOT NULL`, `sales_order_line_id UUID NOT NULL`, `shipped_quantity NUMERIC(14,4) NOT NULL`, `delivered_quantity NUMERIC(14,4) NOT NULL DEFAULT 0`, `transport_mortality INTEGER NOT NULL DEFAULT 0`, `outcome VARCHAR(32) NOT NULL`, `notes TEXT`. |
| `invoices` | `organization_id UUID NOT NULL`, `invoice_number VARCHAR(80) NOT NULL`, `invoice_type VARCHAR(24) NOT NULL`, `customer_id UUID`, `supplier_id UUID`, `sales_order_id UUID`, `purchase_order_id UUID`, `issued_on DATE NOT NULL`, `due_on DATE`, `currency CHAR(3) NOT NULL`, `subtotal NUMERIC(19,4) NOT NULL`, `tax_total NUMERIC(19,4) NOT NULL`, `total NUMERIC(19,4) NOT NULL`, `status VARCHAR(32) NOT NULL`, `posted_at TIMESTAMPTZ`, `posted_by UUID`. Balance must be derived from allocations. |
| `invoice_lines` | `organization_id UUID NOT NULL`, `invoice_id UUID NOT NULL`, `product_id UUID`, `description VARCHAR(240) NOT NULL`, `quantity NUMERIC(14,4) NOT NULL`, `unit_code VARCHAR(30) NOT NULL`, `unit_price NUMERIC(19,4) NOT NULL`, `tax_rate NUMERIC(7,4) NOT NULL DEFAULT 0`, `line_total NUMERIC(19,4) NOT NULL`. |
| `payments` | `organization_id UUID NOT NULL`, `payment_number VARCHAR(80) NOT NULL`, `payment_type VARCHAR(24) NOT NULL`, `counterparty_customer_id UUID`, `counterparty_supplier_id UUID`, `payment_method VARCHAR(40) NOT NULL`, `amount NUMERIC(19,4) NOT NULL CHECK (amount > 0)`, `currency CHAR(3) NOT NULL`, `paid_on DATE NOT NULL`, `reference VARCHAR(120)`, `status VARCHAR(24) NOT NULL`, `posted_at TIMESTAMPTZ`, `posted_by UUID`. |
| `payment_allocations` | `organization_id UUID NOT NULL`, `payment_id UUID NOT NULL`, `invoice_id UUID NOT NULL`, `amount NUMERIC(19,4) NOT NULL CHECK (amount > 0)`, `created_at TIMESTAMPTZ NOT NULL`, `created_by UUID NOT NULL`. |
| `expenses` | `organization_id UUID NOT NULL`, `reference_number VARCHAR(80) NOT NULL`, `category_code VARCHAR(80) NOT NULL`, `business_unit_id UUID`, `farm_id UUID`, `shed_id UUID`, `batch_id UUID`, `department VARCHAR(120)`, `incurred_on DATE NOT NULL`, `amount NUMERIC(19,4) NOT NULL`, `currency CHAR(3) NOT NULL`, `description TEXT NOT NULL`, `status VARCHAR(24) NOT NULL`, `submitted_by UUID NOT NULL`, `approved_by UUID`, `paid_at TIMESTAMPTZ`. |
| `journal_entries` | `organization_id UUID NOT NULL`, `entry_number VARCHAR(80) NOT NULL`, `entry_date DATE NOT NULL`, `description TEXT NOT NULL`, `source_type VARCHAR(40)`, `source_id UUID`, `status VARCHAR(24) NOT NULL`, `posted_at TIMESTAMPTZ`, `posted_by UUID`. |
| `journal_entry_lines` | `organization_id UUID NOT NULL`, `journal_entry_id UUID NOT NULL`, `account_code VARCHAR(80) NOT NULL`, `debit NUMERIC(19,4) NOT NULL DEFAULT 0`, `credit NUMERIC(19,4) NOT NULL DEFAULT 0`, `currency CHAR(3) NOT NULL`, `business_unit_id UUID`, `farm_id UUID`, `batch_id UUID`. Enforce balanced posted entries. |
| `leads` | `organization_id UUID NOT NULL`, `lead_number VARCHAR(80) NOT NULL`, `company_name VARCHAR(200) NOT NULL`, `contact_name VARCHAR(200)`, `phone VARCHAR(40)`, `email VARCHAR(320)`, `source VARCHAR(80)`, `owner_user_id UUID`, `status VARCHAR(32) NOT NULL`, `next_follow_up_at TIMESTAMPTZ`. |
| `opportunities` | `organization_id UUID NOT NULL`, `opportunity_number VARCHAR(80) NOT NULL`, `lead_id UUID`, `customer_id UUID`, `name VARCHAR(200) NOT NULL`, `stage VARCHAR(32) NOT NULL`, `value NUMERIC(19,4)`, `currency CHAR(3)`, `expected_close DATE`, `owner_user_id UUID`. |
| `follow_ups` | `organization_id UUID NOT NULL`, `customer_id UUID`, `lead_id UUID`, `opportunity_id UUID`, `task VARCHAR(200) NOT NULL`, `due_at TIMESTAMPTZ NOT NULL`, `owner_user_id UUID NOT NULL`, `notes TEXT`, `status VARCHAR(24) NOT NULL`, `completed_at TIMESTAMPTZ`. |
| `complaints` | `organization_id UUID NOT NULL`, `case_number VARCHAR(80) NOT NULL`, `customer_id UUID NOT NULL`, `subject VARCHAR(200) NOT NULL`, `description TEXT NOT NULL`, `priority VARCHAR(24) NOT NULL`, `owner_user_id UUID`, `status VARCHAR(32) NOT NULL`, `resolution TEXT`, `resolved_at TIMESTAMPTZ`. |
| `notifications` | `organization_id UUID NOT NULL`, `recipient_user_id UUID NOT NULL`, `severity VARCHAR(16) NOT NULL`, `category VARCHAR(60) NOT NULL`, `title VARCHAR(200) NOT NULL`, `message TEXT NOT NULL`, `related_type VARCHAR(40)`, `related_id UUID`, `created_at TIMESTAMPTZ NOT NULL`, `read_at TIMESTAMPTZ`, `acknowledged_at TIMESTAMPTZ`. |
| `documents` | `organization_id UUID NOT NULL`, `linked_type VARCHAR(40) NOT NULL`, `linked_id UUID NOT NULL`, `original_filename VARCHAR(255) NOT NULL`, `storage_key VARCHAR(500) NOT NULL`, `content_type VARCHAR(120) NOT NULL`, `size_bytes BIGINT NOT NULL`, `checksum VARCHAR(128)`, `uploaded_by UUID NOT NULL`, `uploaded_at TIMESTAMPTZ NOT NULL`, `deleted_at TIMESTAMPTZ`. |
| `audit_logs` | `organization_id UUID`, `actor_user_id UUID`, `action VARCHAR(100) NOT NULL`, `resource_type VARCHAR(80) NOT NULL`, `resource_id UUID`, `occurred_at TIMESTAMPTZ NOT NULL`, `outcome VARCHAR(24) NOT NULL`, `correlation_id VARCHAR(100)`, `before_values JSONB`, `after_values JSONB`, `source_ip INET`. Append-only; redact credentials and sensitive personal fields. |
| `status_history` | `organization_id UUID NOT NULL`, `resource_type VARCHAR(80) NOT NULL`, `resource_id UUID NOT NULL`, `previous_status VARCHAR(32)`, `new_status VARCHAR(32) NOT NULL`, `reason TEXT`, `changed_at TIMESTAMPTZ NOT NULL`, `changed_by UUID NOT NULL`. Append-only. |

The generator must add normalized lookup tables where needed (for example
taxes, currencies, units, locations, medicine/vaccine catalog, expense
categories, routes, and accounts), join tables for many-to-many relations, and
line tables for all transaction aggregates. Do not store these relations as
comma-separated strings.

## 6. Required Flyway script output

Create SQL scripts as separate, ordered files (one logical schema step per
file), for example:

```text
backend/src/main/resources/db/migration/
  V001__create_identity_and_organization.sql
  V002__create_permission_and_scope_tables.sql
  V003__create_master_data_tables.sql
  V004__create_farms_sheds_and_batches.sql
  V005__create_daily_and_production_tables.sql
  V006__create_feed_and_health_tables.sql
  V007__create_inventory_ledger_and_reservations.sql
  V008__create_procurement_tables.sql
  V009__create_sales_crm_and_dispatch_tables.sql
  V010__create_finance_and_journal_tables.sql
  V011__create_documents_notifications_and_audit.sql
  V012__add_indexes_and_constraints.sql

backend/src/main/resources/db/dev-migration/
  V001__dev_reference_and_demo_data.sql
```

This is a suggested split; use more files if needed, preserve dependency order,
and never edit an already-applied migration to change an existing database.
Configure the development seed location only in the development profile; do
not run demo-user/business-data seeds in production.
The SQL files must:

1. Create every required table and column from section 5 (or documented,
   justified equivalent), using explicit PostgreSQL data types and nullability.
2. Create primary keys, foreign keys, tenant-safe uniqueness, `CHECK`
   constraints, indexes, and delete/update rules explicitly.
3. Create append-only ledger/audit tables and protect them from normal update
   or delete paths.
4. Keep production schema DDL separate from optional development/demo seeds.
5. Be exercised by Flyway from a brand-new PostgreSQL database in automated
   tests. Verify table and column names with `information_schema` or equivalent.
6. Never include passwords, tokens, signing keys, or real personal/business
   data in seed SQL.

The backend README must include a migration-to-table map and document every
intentional difference between the catalog and the resulting schema.
