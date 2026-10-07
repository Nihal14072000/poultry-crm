# MASTER DEVELOPMENT PROMPT
## Poultry Business ERP, Farm Management, Trading & CRM Platform

You are a senior product architect, UX designer, database architect, Java/Spring Boot engineer, Angular engineer, QA engineer and DevOps engineer.

Build a complete, production-ready **Poultry Business ERP + Farm Management + Trading + CRM platform**.

The application must be an ORIGINAL PRODUCT. It may provide business capabilities comparable to established poultry ERP products, but it must NOT copy any third-party source code, HTML/CSS/JS, database schema, UI layouts, images, icons, logos, trademarks, marketing text, documentation, screenshots or other protected creative material.

Create an independent architecture, implementation, visual design system, terminology and user experience.

---

# 1. PRODUCT OBJECTIVE

Build a centralized platform for poultry businesses to manage:

- Farms
- Poultry sheds
- Broiler operations
- Layer operations
- Breeder operations
- Hatchery
- Flock/batch management
- Bird placement
- Mortality
- Feed
- Medication
- Vaccination
- Daily production
- Egg production
- Chick management
- Poultry trading
- Chicken trading
- Egg trading
- Feed trading
- Purchase
- Sales
- Inventory
- Warehouses
- Distribution
- Transportation
- Customers
- Suppliers
- CRM
- Payments
- Expenses
- Finance
- Profitability
- Employees
- Documents
- Notifications
- Reports
- Business intelligence
- AI-assisted insights

The platform must work for a small poultry farm as well as a multi-farm poultry enterprise.

---

# 2. TECHNOLOGY STACK

## Frontend

Use:

- Angular
- TypeScript
- Angular Router
- Reactive Forms
- Angular Material/CDK or another mature component framework
- RxJS
- Responsive CSS
- PWA capabilities
- Lazy-loaded feature modules/routes
- Strong form validation
- Accessible components

The UI must work on:

- Desktop
- Laptop
- Tablet
- Mobile

## Backend

Use:

- Java
- Spring Boot
- Spring Security
- Spring Data JPA
- Hibernate
- REST APIs
- Bean Validation
- JWT/OAuth2-ready authentication architecture
- OpenAPI/Swagger
- Proper exception handling
- Structured logging

## Database

Use:

- PostgreSQL

Use:

- UUID primary keys where appropriate
- Foreign keys
- Proper indexes
- Constraints
- Audit fields
- Created/updated timestamps
- Soft-delete where appropriate
- Database migrations using Flyway or Liquibase

## Architecture

Start with a:

**Modular Monolith**

Do NOT introduce unnecessary microservices.

Design the modules so that they can be separated into services later if required.

---

# 3. APPLICATION ARCHITECTURE

Create these major backend domains:

```text
identity
organization
farm
shed
flock
breeder
broiler
layer
hatchery
feed
health
medication
vaccination
inventory
warehouse
procurement
sales
trading
distribution
transport
crm
finance
expense
hr
document
notification
reporting
analytics
audit
ai
```

Each module should have clear:

- Entity
- Repository
- Service
- DTO
- Mapper
- Controller
- Validation
- Exception handling
- Tests

Do not expose JPA entities directly from REST APIs.

Use DTOs.

---

# 4. MULTI-TENANT ORGANIZATION MODEL

Design the system so it can support multiple organizations.

Hierarchy:

```text
Organization
   ├── Business Units
   ├── Farms
   │     └── Sheds
   ├── Warehouses
   ├── Offices
   └── Users
```

Every business transaction must belong to the correct organization.

Support:

- Organization setup
- Company profile
- Multiple branches
- Multiple farms
- Multiple warehouses
- Fiscal year
- Currency
- Tax configuration
- Numbering configuration
- Time zone
- Regional settings

---

# 5. AUTHENTICATION & AUTHORIZATION

Implement:

- Login
- Logout
- Forgot password
- Reset password
- Password policy
- Session management
- JWT authentication
- Refresh tokens
- Role-based access control
- Permission-based access control
- User activation/deactivation

Roles should include examples such as:

- Super Admin
- Organization Admin
- Owner
- Farm Manager
- Farm Supervisor
- Veterinarian
- Warehouse Manager
- Procurement Manager
- Sales Manager
- Sales Executive
- Accountant
- HR Manager
- Transport Manager
- Read Only

Do not hard-code permissions into Angular components.

Permissions must come from backend authorization.

---

# 6. MASTER DATA

Create master-data management for:

- Product
- Product Category
- Product Type
- Breed
- Bird Type
- Unit of Measure
- Farm
- Shed
- Warehouse
- Supplier
- Customer
- Employee
- Vehicle
- Driver
- Feed Type
- Medicine
- Vaccine
- Expense Category
- Payment Method
- Tax
- Currency
- Location
- State
- District
- User
- Role
- Permission

Provide CRUD screens with:

- Search
- Filter
- Sort
- Pagination
- Import
- Export
- Bulk actions
- Validation
- Audit history

---

# 7. FARM MANAGEMENT

Create:

## Farm

Fields:

- Farm code
- Farm name
- Owner
- Contact
- Address
- Location
- Capacity
- Farm type
- Number of sheds
- Status
- Documents
- Notes

## Shed

Fields:

- Shed code
- Shed name
- Farm
- Shed type
- Capacity
- Current occupancy
- Available capacity
- Construction date
- Equipment
- Status

Dashboard for every farm:

- Total birds
- Active batches
- Mortality
- Feed consumption
- Average weight
- FCR
- Livability
- Production
- Revenue
- Expenses
- Profit
- Alerts

---

# 8. FLOCK / BATCH MANAGEMENT

Every flock must have a unique batch number.

Fields:

- Batch number
- Farm
- Shed
- Bird type
- Breed
- Supplier
- Placement date
- Initial quantity
- Current quantity
- Mortality
- Culling
- Age
- Average weight
- Feed consumed
- FCR
- Livability
- Status

Statuses:

- Planned
- Placed
- Active
- Ready for sale
- Partially sold
- Completed
- Closed
- Cancelled

Provide:

## Batch 360 View

Tabs:

- Overview
- Daily Records
- Birds
- Feed
- Weight
- Mortality
- Health
- Medication
- Vaccination
- Expenses
- Sales
- Revenue
- P&L
- Documents
- Audit

---

# 9. DAILY FARM OPERATIONS

Create a fast daily-entry screen.

The user should be able to record:

- Opening birds
- Mortality
- Culling
- Closing birds
- Feed consumed
- Average weight
- Water consumption
- Temperature
- Humidity
- Medication
- Vaccination
- Notes

Automatically calculate:

```text
Closing Birds =
Opening Birds - Mortality - Culling + Adjustments

Mortality % =
Mortality / Opening Birds × 100

Livability % =
Closing Birds / Initial Birds × 100

FCR =
Feed Consumed / Weight Gain
```

Prevent inconsistent data.

Example:

Closing birds cannot be greater than opening birds unless a documented transfer/addition exists.

---

# 10. BROILER MANAGEMENT

Track:

- Placement
- Growth
- Daily weight
- Feed
- Mortality
- FCR
- Livability
- Medication
- Vaccination
- Ready-for-sale quantity
- Bird lifting
- Sales
- Cost
- Revenue
- Profit

Create growth charts.

Compare:

- Actual weight
- Expected weight
- FCR target
- Actual FCR
- Mortality target
- Actual mortality

Generate alerts when performance deviates significantly.

---

# 11. LAYER MANAGEMENT

Track:

- Flock
- Age
- Birds
- Mortality
- Feed
- Egg production
- Broken eggs
- Damaged eggs
- Saleable eggs
- Egg size/grade
- Production percentage
- Feed per dozen eggs
- Revenue
- Cost
- Profit

Dashboard:

```text
Birds
Egg Production
Production %
Mortality
Feed Consumption
Egg Stock
Revenue
Profit
```

---

# 12. BREEDER MANAGEMENT

Track:

- Male birds
- Female birds
- Flock
- Fertility
- Hatchability
- Egg production
- Fertile eggs
- Infertile eggs
- Mortality
- Feed
- Health
- Production

Calculate:

- Fertility %
- Hatchability %
- Production %
- Mortality %

---

# 13. HATCHERY MANAGEMENT

Support:

- Egg collection
- Egg grading
- Setting
- Candling
- Transfer
- Hatching
- Chick grading
- Chick mortality
- Chick inventory
- Hatch reports

Track:

```text
Eggs Set
→ Fertile Eggs
→ Transfer
→ Hatched
→ Saleable Chicks
→ Rejected/Dead
```

Calculate hatchability automatically.

---

# 14. FEED MANAGEMENT

Create:

- Feed types
- Feed formulas
- Feed inventory
- Feed purchase
- Feed issue
- Feed consumption
- Feed transfer
- Feed wastage
- Feed planning

Track feed by:

- Farm
- Shed
- Batch
- Warehouse

Generate:

- Feed consumption report
- Feed cost report
- Feed variance
- Feed requirement forecast

---

# 15. HEALTH MANAGEMENT

Track:

- Disease
- Symptoms
- Diagnosis
- Treatment
- Medication
- Veterinary visits
- Vaccination
- Health incidents
- Mortality cause

Medication fields:

- Medicine
- Dosage
- Start date
- End date
- Batch
- Vet
- Cost
- Notes

---

# 16. INVENTORY MANAGEMENT

Inventory must support:

- Quantity
- Unit
- Batch
- Expiry
- Warehouse
- Farm
- Shed
- Product

Transactions:

- Opening stock
- Purchase
- Receipt
- Issue
- Transfer
- Adjustment
- Consumption
- Sales
- Return
- Damage
- Expiry

Use an immutable inventory ledger.

Do not directly overwrite stock quantities.

Stock should be calculated from transactions or controlled ledger entries.

Support:

- FIFO where appropriate
- Batch tracking
- Expiry tracking
- Low-stock alerts

---

# 17. PROCUREMENT

Workflow:

```text
Purchase Requisition
        ↓
Purchase Order
        ↓
Goods Receipt
        ↓
Quality Check
        ↓
Supplier Invoice
        ↓
Payment
```

Support:

- Supplier quotations
- Purchase orders
- Partial receipt
- Rejected quantity
- Returns
- Purchase invoice
- Supplier payment
- Outstanding amount

---

# 18. SALES

Workflow:

```text
Lead / Customer
       ↓
Quotation
       ↓
Sales Order
       ↓
Stock Reservation
       ↓
Dispatch
       ↓
Invoice
       ↓
Payment
```

Support:

- Cash sales
- Credit sales
- Partial payment
- Discounts
- Taxes
- Returns
- Credit notes
- Price lists
- Customer-specific pricing

---

# 19. POULTRY TRADING

Support trading of:

- Chicks
- Live chicken
- Dressed chicken
- Eggs
- Feed
- Poultry products

For live birds support:

- Number of birds
- Average weight
- Total weight
- Rate/kg
- Rate/bird
- Mortality during transport
- Final delivered quantity

Calculate:

```text
Total Weight = Bird Count × Average Weight

Sales Value =
Total Weight × Rate/Kg
```

Allow either:

- Per bird pricing
- Per kilogram pricing
- Per tray/carton pricing
- Custom units

---

# 20. CUSTOMER CRM

Create a complete CRM.

Customer profile:

- Customer code
- Name
- Type
- Phone
- Email
- Address
- GST/tax information
- Credit limit
- Payment terms
- Salesperson
- Status

Customer 360:

- Orders
- Purchases
- Payments
- Outstanding
- Products
- Complaints
- Follow-ups
- Notes
- Documents
- Communication history

CRM pipeline:

```text
Lead
 ↓
Qualified
 ↓
Quotation
 ↓
Negotiation
 ↓
Won
 ↓
Customer
```

Support:

- Tasks
- Follow-ups
- Reminders
- Call notes
- Customer complaints
- Opportunities

---

# 21. DISTRIBUTION & LOGISTICS

Manage:

- Delivery orders
- Dispatch
- Vehicles
- Drivers
- Routes
- Delivery schedules
- Delivery status
- Proof of delivery
- Transport cost

Statuses:

```text
Created
Confirmed
Packed
Dispatched
In Transit
Delivered
Partially Delivered
Failed
Cancelled
```

---

# 22. FINANCE

Create a basic integrated finance module.

Support:

- Accounts
- Receivables
- Payables
- Payments
- Receipts
- Expenses
- Journal entries
- Cash
- Bank
- Tax
- Profit & Loss
- Balance Sheet-ready architecture

Every financial transaction should reference its originating business transaction.

Examples:

Sales → Receivable

Purchase → Payable

Expense → Expense entry

Payment → Settlement

---

# 23. EXPENSE MANAGEMENT

Track:

- Farm expenses
- Feed expenses
- Medicine expenses
- Labour
- Electricity
- Transport
- Maintenance
- Administrative expenses
- Other expenses

Allow allocation by:

- Organization
- Farm
- Shed
- Batch
- Department

---

# 24. PROFITABILITY

Create profitability at multiple levels:

- Company
- Business unit
- Farm
- Shed
- Batch
- Product
- Customer
- Sales order

Batch P&L:

```text
Revenue
-
Chick/Bird Cost
-
Feed Cost
-
Medicine Cost
-
Labour
-
Transport
-
Electricity
-
Other Expenses
=
Gross/Net Profit
```

Allow configurable costing rules.

---

# 25. HR MANAGEMENT

Support:

- Employee
- Department
- Designation
- Attendance
- Leave
- Salary information
- Farm assignment
- Documents

Do not attempt to become a full payroll product in MVP unless required.

---

# 26. REPORTING

Create exportable reports.

Required reports:

### Farm

- Farm performance
- Shed utilization
- Batch performance
- Mortality
- FCR
- Feed consumption
- Weight gain

### Trading

- Sales
- Purchase
- Customer sales
- Supplier purchases
- Product sales
- Product margin
- Dispatch
- Returns

### Inventory

- Current stock
- Stock ledger
- Stock valuation
- Expiring stock
- Low stock
- Warehouse stock

### Finance

- Receivables
- Payables
- Expenses
- P&L
- Cash flow
- Customer outstanding
- Supplier outstanding

### Production

- Egg production
- Hatchery
- Chick production
- Broiler performance
- Layer performance

Reports must support:

- Date range
- Farm
- Shed
- Batch
- Product
- Customer
- Supplier
- Export Excel
- Export CSV
- PDF-ready print layouts

---

# 27. MAIN DASHBOARD

Create an executive dashboard.

Show:

- Total birds
- Active batches
- Today's sales
- Today's purchases
- Outstanding receivables
- Outstanding payables
- Current inventory value
- Feed stock
- Egg stock
- Chick stock
- Mortality
- FCR
- Revenue
- Expenses
- Profit

Include:

- Sales trend
- Revenue trend
- Mortality trend
- FCR trend
- Farm performance
- Batch performance
- Top customers
- Top products
- Low-stock alerts
- Payment alerts
- Operational alerts

---

# 28. ALERT ENGINE

Create configurable alerts.

Examples:

```text
High Mortality
Low Feed Stock
Low Egg Production
Poor FCR
Weight Below Target
Overdue Customer
Overdue Supplier
Medicine Expiring
Stock Expiring
Batch Ready for Sale
Payment Due
Delivery Delayed
```

Alerts should support:

- Severity
- Recipient role
- Recipient user
- Notification channel
- Read/unread
- Acknowledgement
- Escalation

---

# 29. AI FEATURES

Design an AI-ready architecture.

Examples:

### Business questions

User asks:

"Which farm is performing poorly?"

System responds using actual business data.

### Forecasting

Predict:

- Feed requirement
- Bird weight
- Mortality risk
- Egg production
- Sales demand
- Inventory requirement
- Cash requirement

### AI insights

Example:

```text
Farm C requires attention.

Mortality increased 18% over the previous 7 days.
FCR is 9% above target.
Feed consumption is above the expected curve.

Recommended action:
Review feed quality and flock health records.
```

AI must never fabricate business numbers.

---

# 30. UI/UX REQUIREMENTS

Create a modern SaaS interface.

Do NOT copy any existing poultry ERP's visual design.

Design principles:

- Clean
- Minimal
- Professional
- Fast
- Mobile friendly
- Data dense where required
- Spacious where appropriate
- Strong visual hierarchy
- Consistent components

Navigation:

```text
Dashboard

Operations
  Farms
  Sheds
  Batches
  Daily Operations
  Broiler
  Layer
  Breeder
  Hatchery
  Health
  Feed

Inventory
  Products
  Warehouses
  Stock
  Transfers
  Stock Ledger

Trading
  Customers
  Suppliers
  Sales
  Purchase
  Quotations
  Orders
  Dispatch

CRM
  Leads
  Opportunities
  Follow-ups
  Complaints

Finance
  Receivables
  Payables
  Payments
  Expenses
  P&L

Reports
Analytics
Notifications
Administration
```

Use:

- Cards
- Tables
- Charts
- Timeline
- Kanban
- Drawers
- Modals
- Wizards
- Step forms
- Bulk actions
- Inline editing where appropriate

Avoid unnecessarily long forms.

---

# 31. MOBILE FARM EXPERIENCE

The farm user may be standing inside a shed with poor connectivity.

Create a simplified mobile workflow:

```text
Select Farm
 ↓
Select Shed
 ↓
Select Batch
 ↓
Today's Entry
 ↓
Birds
Feed
Mortality
Weight
Health
 ↓
Save
```

Use large controls and minimum typing.

Support offline data capture and synchronization where technically feasible.

---

# 32. SEARCH

Implement global search.

Search:

- Customers
- Suppliers
- Farms
- Sheds
- Batches
- Products
- Sales orders
- Purchase orders
- Invoices
- Payments

Example:

```text
Search "B-1024"

Batch B-1024
Farm: Green Farm
Shed: 04
Age: 28 days
Birds: 4,920
```

---

# 33. AUDIT

Every important transaction must maintain:

- Created by
- Created timestamp
- Updated by
- Updated timestamp
- Deleted by
- Deleted timestamp
- Status history
- Previous value
- New value

Create an audit viewer for administrators.

---

# 34. DOCUMENT MANAGEMENT

Allow documents to be attached to:

- Farms
- Sheds
- Batches
- Customers
- Suppliers
- Purchase orders
- Sales orders
- Employees
- Invoices

Store metadata separately from file storage.

Use object-storage-compatible architecture.

---

# 35. API DESIGN

REST API conventions:

```text
GET
POST
PUT/PATCH
DELETE
```

Use:

```text
/api/v1/farms
/api/v1/sheds
/api/v1/batches
/api/v1/customers
/api/v1/sales-orders
/api/v1/purchase-orders
/api/v1/inventory
/api/v1/payments
```

Use:

- Pagination
- Filtering
- Sorting
- Search
- Validation
- Standard error responses
- HTTP status codes
- Correlation IDs

Generate OpenAPI documentation.

---

# 36. DATABASE DESIGN

Create a normalized PostgreSQL schema.

Major tables should include concepts such as:

```text
organizations
users
roles
permissions
farms
sheds
batches
birds
daily_flock_records
feed_items
feed_transactions
medications
vaccinations
health_incidents
products
warehouses
inventory_transactions
customers
suppliers
leads
opportunities
sales_orders
sales_order_items
purchase_orders
purchase_order_items
goods_receipts
dispatches
invoices
payments
expenses
vehicles
drivers
deliveries
employees
documents
notifications
audit_logs
```

Do not blindly use this list as the final schema.

Analyze relationships and normalize appropriately.

Create indexes based on expected queries.

---

# 37. DATA INTEGRITY

Implement database and application-level validation.

Examples:

- Shed cannot exceed capacity.
- Batch cannot be placed beyond available shed capacity.
- Mortality cannot exceed available birds.
- Inventory cannot become negative unless explicitly configured.
- Payment cannot exceed outstanding balance unless overpayment is supported.
- Closed batches cannot receive normal daily records.
- Cancelled orders cannot be dispatched.
- Expired medicines cannot be issued.
- Duplicate batch numbers must be prevented within the organization.
- Stock transactions must remain auditable.

Use transactions for multi-step business operations.

---

# 38. SECURITY

Implement:

- Password hashing
- JWT
- Refresh token rotation
- RBAC
- Permission checks
- Input validation
- SQL injection protection
- XSS protection
- CSRF considerations
- Secure headers
- Rate limiting architecture
- Audit logging
- File upload validation
- Maximum upload size
- Secure secrets configuration

Never place secrets in source code.

---

# 39. TESTING

Create:

### Backend

- Unit tests
- Repository tests
- Service tests
- Controller tests
- Integration tests

### Frontend

- Component tests
- Service tests
- Form validation tests

### E2E

Test major workflows:

```text
Create Farm
→ Create Shed
→ Create Batch
→ Daily Entry
→ Feed Consumption
→ Mortality
→ Sales
→ Dispatch
→ Invoice
→ Payment
→ P&L
```

Also test:

```text
Customer
→ Order
→ Inventory Reservation
→ Dispatch
→ Invoice
→ Payment
```

---

# 40. SEED DATA

Provide demo data for:

- 2 organizations
- Multiple farms
- Multiple sheds
- Multiple batches
- Customers
- Suppliers
- Products
- Inventory
- Sales
- Purchase
- Payments
- Expenses

Create realistic poultry data.

Do not use any third-party company's real branding or proprietary data.

---

# 41. DASHBOARD UX RULE

Every dashboard metric must be clickable.

Example:

```text
45,280 Birds
     ↓
Click
     ↓
Farm-wise bird distribution
     ↓
Farm A
Farm B
Farm C
     ↓
Click Farm A
     ↓
Sheds
     ↓
Batch
```

Everything should support drill-down.

---

# 42. PERFORMANCE

Design for:

- Thousands of batches
- Millions of inventory transactions
- Large customer datasets
- Large daily flock records

Use:

- Pagination
- Server-side filtering
- Database indexes
- Efficient queries
- Lazy loading
- Caching where useful
- Background jobs for heavy reports

Do not load entire tables into Angular.

---

# 43. OBSERVABILITY

Implement:

- Structured application logs
- Error logging
- Request correlation IDs
- Health endpoints
- Database health
- API metrics
- Performance logging

Prepare architecture for:

- Prometheus
- Grafana
- Centralized logging

---

# 44. DEPLOYMENT

Provide:

- Dockerfile
- Docker Compose
- PostgreSQL container configuration
- Environment configuration
- Production configuration
- Database migration configuration
- Health checks

Architecture should support deployment to:

- AWS
- Azure
- GCP
- On-premise server

---

# 45. CI/CD

Prepare:

```text
Git Repository
     ↓
Build
     ↓
Unit Tests
     ↓
Integration Tests
     ↓
Angular Build
     ↓
Docker Build
     ↓
Security Scan
     ↓
Deployment
```

Use GitHub Actions or an equivalent CI/CD system.

---

# 46. ERROR HANDLING

Never show raw stack traces to users.

Create standardized errors:

```json
{
  "timestamp": "...",
  "status": 400,
  "code": "BATCH_CAPACITY_EXCEEDED",
  "message": "The selected shed does not have enough available capacity.",
  "correlationId": "..."
}
```

---

# 47. UX ERROR MESSAGES

Use human-readable messages.

Bad:

"ConstraintViolationException"

Good:

"Mortality cannot be greater than the available bird count."

---

# 48. PRODUCT BRANDING

Create a completely original brand identity.

Do NOT use:

- PoultryCare name
- PoultryCare logo
- PoultryCare colors as a deliberate imitation
- PoultryCare screenshots
- PoultryCare marketing text
- PoultryCare proprietary terminology where it is not necessary

Create:

- Original application name
- Original logo concept
- Original color system
- Typography
- Icon strategy
- Design tokens

---

# 49. DEVELOPMENT APPROACH

Do not generate the entire application as one uncontrolled code dump.

Work incrementally.

## Phase 1

Build:

- Project setup
- Authentication
- Organization
- Users
- Roles
- Permissions
- Master data
- Farm
- Shed
- Batch

## Phase 2

Build:

- Daily operations
- Mortality
- Feed
- Weight
- Health
- Medication
- Vaccination
- Broiler
- Layer

## Phase 3

Build:

- Inventory
- Warehouse
- Purchase
- Suppliers
- Sales
- Customers
- Trading
- Dispatch

## Phase 4

Build:

- CRM
- Payments
- Expenses
- Finance
- P&L

## Phase 5

Build:

- Hatchery
- Breeder
- Distribution
- Transport
- HR

## Phase 6

Build:

- Analytics
- Advanced reporting
- Alerts
- AI assistant
- Forecasting

---

# 50. DEFINITION OF DONE

A feature is not complete merely because the screen exists.

For every feature provide:

1. Database migration
2. Entity/model
3. Repository
4. Service
5. DTO
6. Validation
7. REST API
8. API documentation
9. Angular service
10. Angular component
11. UI validation
12. Loading state
13. Empty state
14. Error state
15. Success notification
16. Authorization
17. Audit logging
18. Unit tests
19. Integration tests where applicable
20. Responsive design

---

# 51. CRITICAL DEVELOPMENT RULES

Do NOT:

- Fake API responses in production screens.
- Hard-code business data.
- Use local arrays instead of the database for real functionality.
- Put business logic in Angular.
- Expose database entities directly.
- Ignore authorization.
- Create duplicate business logic.
- Create unnecessary microservices.
- Skip migrations.
- Skip validation.
- Skip auditability.
- Copy third-party UI or code.

Do:

- Build reusable components.
- Build reusable services.
- Keep business rules in backend services.
- Keep database transactions atomic.
- Use meaningful names.
- Write maintainable code.
- Document complex business rules.
- Keep APIs versioned.
- Use proper error handling.
- Keep UI consistent.
- Optimize database queries.

---

# 52. FIRST DELIVERABLE

Before implementing the full application, generate:

## A. Product Requirements Document

Include:

- Product vision
- Personas
- Roles
- Modules
- Functional requirements
- Non-functional requirements
- Business rules
- Workflows

## B. Architecture Document

Include:

- System architecture
- Component architecture
- Module boundaries
- Security architecture
- Data architecture
- API architecture

## C. Database Design

Provide:

- ERD
- Tables
- Columns
- Data types
- Primary keys
- Foreign keys
- Indexes
- Constraints
- Relationships

## D. UI/UX Specification

Provide:

- Sitemap
- Navigation
- Screen inventory
- Wireframes
- Design system
- Responsive behavior
- Mobile workflows

## E. API Specification

Provide:

- Endpoint
- HTTP method
- Request
- Response
- Validation
- Authorization
- Error codes

## F. Implementation Plan

Break development into small, independently testable milestones.

After producing these documents, begin implementation phase-by-phase.

---

# 53. FINAL PRODUCT STANDARD

The final application must feel like a modern commercial SaaS product.

It should be:

- Fast
- Clean
- Reliable
- Secure
- Responsive
- Scalable
- Easy for farm workers
- Powerful for managers
- Useful for owners
- Data-driven
- Mobile-friendly

The most important principle is:

**Do not merely reproduce an existing poultry ERP. Build a better, original poultry business operating platform based on the real workflows of poultry businesses.**