## Agency & Freelance CRM

A professional, full-featured CRM for agencies and freelancers — leads, clients, deals, invoices, and tasks in one cohesive workspace. Built on Lovable Cloud (real database + auth) with seeded demo data, a corporate navy/gold design, and PDF invoice export.

### Design system

- **Theme**: Corporate & professional, light mode
- **Colors**: Deep navy `#0F172A` (primary), white surfaces, gold/amber `#F59E0B` accent, semantic status colors (green/red/yellow/blue)
- **Typography**: Inter (sans-serif), strong hierarchy
- **Layout**: Collapsible left sidebar + sticky top header with search & quick-add menu
- **Components**: Card-based, subtle shadows, smooth transitions, professional data tables with sorting

### Authentication

- Email + password sign-up / sign-in (Lovable Cloud)
- Each user gets their own private workspace (RLS-scoped data)
- On first sign-in, the account is automatically seeded with realistic demo data

### Pages

**1. Dashboard `/`**
- 5 KPI cards: Total Leads, Active Clients, Open Deals, Pending Invoices, Tasks Due Today
- Monthly revenue bar chart (last 6 months, from paid invoices)
- Recent activity feed (last actions across modules)
- Quick-action buttons: + Add Lead, + New Invoice, + Add Task

**2. Contacts `/contacts`**
- Sortable/searchable table: Name, Company, Email, Phone, Status badge, Date Added
- Filter by status (Lead / Client / Inactive)
- Click row → side panel with details + edit/delete
- Add contact dialog

**3. Leads `/leads`**
- List view with source (Referral, Website, Social Media, Cold Outreach)
- Status pipeline badges: New → Contacted → Qualified → Proposal Sent → Converted
- Assign to team member dropdown
- Notes thread per lead
- "Convert to Client" action (flips contact status, creates a deal)

**4. Deals `/deals`** — Kanban board
- Columns: Discovery → Proposal → Negotiation → Won → Lost
- Drag-and-drop between columns (dnd-kit)
- Card shows: client name, $ value, due date, assignee avatar
- Column header shows total $ value of deals in that stage
- Click card → deal details modal (edit fields)

**5. Invoices `/invoices`**
- Table: Invoice #, Client, Amount, Issue Date, Due Date, Status badge
- Status colors: green (Paid), yellow (Sent), red (Overdue), gray (Draft)
- New invoice form: pick client, add line items (service / qty / unit price), auto-calculated subtotal, tax %, total
- Mark as Paid action
- Preview modal with clean printable layout
- **Download PDF** button (jsPDF)

**6. Tasks `/tasks`**
- Task list: Title, linked client/lead, priority (High/Med/Low), due date, status (Pending/In Progress/Done)
- Filter by priority and status
- Overdue rows highlighted in red
- Quick "Mark Done" checkbox toggle
- Add/edit/delete

**7. Settings `/settings`**
- Agency name, logo upload placeholder, timezone
- Team members list (Name, Role, Email) — editable, used in assignee dropdowns

### Seed data (per new account)

10+ entries each: contacts, leads, deals across all pipeline stages, invoices across all statuses (some overdue), tasks across priorities, 5 team members. Names mix Bangladeshi (e.g., Tahmid Rahman, Nusrat Jahan) and international. Currency: USD ($).

### Technical notes

- **Stack**: TanStack Start + React + Tailwind v4 + shadcn/ui + Lovable Cloud (Supabase)
- **Routing**: Separate route files under `src/routes/` (no hash anchors). Auth-guarded via `_authenticated` layout route; `/login` and `/signup` are public.
- **Data layer**: TanStack Query + server functions for all CRUD; RLS policies scope every table by `user_id`
- **Tables**: `profiles`, `team_members`, `contacts`, `leads`, `lead_notes`, `deals`, `invoices`, `invoice_items`, `tasks`, `activity_log`, `settings`
- **Roles**: separate `user_roles` table with `app_role` enum and `has_role()` security-definer function (per security best practices)
- **Drag-and-drop**: `@dnd-kit/core` + `@dnd-kit/sortable`
- **PDF export**: `jspdf` + `jspdf-autotable` for invoice download
- **Charts**: existing `recharts` (already in shadcn chart component)
- **Responsive**: sidebar collapses to icon strip on tablet, off-canvas on mobile; tables become stacked cards on small screens
