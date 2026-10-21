# Projects Feature — Implementation Plan
> WealthMap · Production-Ready · Full Specification

---

## 1. What This Feature Is

**Projects** is a named container for tracking all expenses related to a specific life endeavour — building a house, a wedding, a farm, a renovation, a vacation, a startup setup — anything that has a defined purpose and a beginning.

The user should never feel like they are in a separate app. Projects are a **lens on top of the existing transactions system**, not a silo. All spending is visible in one feed, tagged and organised.

---

## 2. Core Design Decisions

### 2.1 Two Project Types

| Type | Name shown to user | Example | Net Worth impact |
|---|---|---|---|
| capital | "Building / Investment" | House, Farm, Renovation | Zero — cash converts to asset |
| general | "Project / Event" | Wedding, Trip, Vacation | Reduces — real spending |

### 2.2 Transactions Stay the Single Source of Truth

A project expense IS a transaction. Same table, same data. A `project_id` column links it to a project.
- Transactions page: shows ALL transactions, project ones have a coloured badge.
- Projects page: shows summary analytics only.
- Filter in transactions: "All / Regular / [Project Name]"

### 2.3 Capital Projects and Net Worth

When a user spends Rs40L building a house:
- The transaction records as an expense (cash went out).
- BUT the project shows as "Asset in Progress" in the Assets screen.
- Net worth = (liquid + investments + assets + capital_projects_in_progress) - liabilities
- Net worth does NOT collapse. Cash goes down, asset goes up.
- On project completion the user converts it to a permanent Asset entry.

### 2.4 Dashboard Behaviour

- Capital project expenses: excluded from main expense charts and monthly budget.
- General project expenses: shown in main charts as a "Projects" category (not mixed with Food etc.).
- Both types: always visible in the Transactions feed with a badge.

---

## 3. Database Schema

### 3.1 New Table: projects

```sql
create table projects (
  id                  uuid        default gen_random_uuid() primary key,
  created_by          uuid        references auth.users(id) on delete cascade not null,
  name                text        not null,
  description         text,
  emoji               text        default '📁',
  color               text        default 'indigo',
  project_type        text        check (project_type in ('capital', 'general')) not null default 'general',
  budget              numeric(15,2),
  status              text        check (status in ('active', 'completed', 'paused')) default 'active',
  start_date          date        default current_date,
  end_date            date,
  linked_asset_id     uuid        references investments(id) on delete set null,
  exclude_from_charts boolean     default true,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  is_deleted          boolean     default false
);

alter table projects enable row level security;
create policy "Users manage own projects" on projects
  using (created_by = auth.uid())
  with check (created_by = auth.uid());
```

### 3.2 Modify Existing Table: transactions

```sql
alter table transactions
  add column project_id uuid references projects(id) on delete set null;

create index idx_transactions_project_id on transactions(project_id);
```

### 3.3 Mock DB Changes (supabaseMock.ts)

Add to SEED object and seedTable calls:
```typescript
// In SEED object:
projects: {
  house: 'proj0000-0000-0000-0000-000000000001',
},

// In initializeMockDatabase():
seedTable('projects', [
  {
    id: SEED.projects.house,
    name: 'Home Renovation',
    emoji: '🏠',
    color: 'amber',
    project_type: 'capital',
    budget: 500000,
    status: 'active',
    start_date: '2026-01-01',
    description: 'Full interior renovation of new flat',
    exclude_from_charts: true,
  }
]);
```

---

## 4. Route and Navigation

### 4.1 New Routes in router.ts

```typescript
export const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects',
  component: Projects,
});

export const projectDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$projectId',
  component: ProjectDetail,
});
```

### 4.2 Navigation

Desktop sidebar: add Projects with FolderKanban icon after Assets.
Mobile: add Projects to the bottom nav, move Settings into a "More" sheet.

```typescript
{ label: 'Projects', path: '/projects', icon: FolderKanban, keywords: 'house wedding trip farm event build renovation' }
```

---

## 5. UI and UX — Screen by Screen

### 5.1 Projects List Page (/projects)

Layout:
- Header: "Projects" title + "+ New Project" button
- Filter tabs: Active / Completed / All
- Project cards list

Project card shows:
- Emoji + Name + Type badge (subtle)
- Budget / Spent / Progress bar
- Start date and Status

Empty state:
- "Start your first Project"
- "Track a house build, wedding, renovation, trip — anything with many expenses."
- [Create your first Project] button

---

### 5.2 Create Project Modal

Fields:
1. Emoji picker (grid of ~20 emojis: house, farm, ring, plane, etc.)
2. Project Name (required)
3. Type toggle — two large tiles:
   - "Building / Investment" — house, farm, renovation (creates an asset)
   - "Project / Event" — wedding, trip, vacation, anything
4. Budget (optional, number field)
5. Description (optional)
6. Start Date (defaults to today)
7. End Date (optional)

---

### 5.3 Individual Project Page (/projects/:id)

Top section:
- Back arrow + Project name + emoji + Edit button
- Type badge + status badge + start date

Stat cards row:
- Spent (total)
- Budget (if set)
- Remaining (if budget set)
- Days Active

Progress bar (only if budget set)

[+ Add Expense to this Project] button — opens Add Transaction modal with project pre-filled

Recent Expenses (last 5):
- Each row: merchant/description + date + amount
- "View all X expenses →" link to /money?project=id

Charts section:
- Spending by Category donut (Recharts, same pattern as insights.tsx)
- Cumulative spend timeline area chart

Capital Projects only (bottom section):
- "This project is building an asset. Total invested: Rs X"
- [Mark Complete → Convert to Asset] button
  - Opens form: asset name, final value, asset type
  - Creates investments entry
  - Sets project status = completed and linked_asset_id

---

### 5.4 Transactions Page — Changes

Badge on each transaction row that has a project_id:
- Small coloured pill: [emoji] Project Name
- Below the merchant/description line
- Clicking the badge navigates to the project page

Filter addition above transaction list:
- Project selector: "All Projects" (default) or specific project name
- Filter state syncs with URL param: /money?project=id

Add Transaction modal — new optional field at the bottom:
- "Assign to Project" dropdown
- Shows active projects only
- Defaults to "None (regular expense)"

---

### 5.5 Assets Screen — Capital Projects Section

New section in investments.tsx, above existing tabs:
```
In Progress (Capital Projects)
  🏠 Home Renovation       Rs2,34,500 invested
  [View Project]
```
Value included in net worth computation.

---

### 5.6 Home Dashboard — Projects Strip

Between stat cards and chart row:
- Horizontal scrollable row of project cards
- Each card: emoji, name, spent, budget % bar
- Hidden entirely if user has no active projects

---

## 6. Component Breakdown

### New Files

| File | Purpose |
|---|---|
| src/routes/projects.tsx | Projects list page |
| src/routes/project-detail.tsx | Individual project dashboard |
| src/components/ui/ProjectBadge.tsx | Coloured badge on transaction rows |
| src/components/ui/ProjectSelector.tsx | Dropdown in Add Transaction form and filter |
| src/components/ui/EmojiPicker.tsx | Grid of emoji choices for project creation |

### Modified Files

| File | Change |
|---|---|
| src/routes/__root.tsx | Add Projects to navigationItems |
| src/routes/router.ts | Register /projects and /projects/$projectId |
| src/routes/transactions.tsx | Badge on rows, project filter, project field in form |
| src/routes/index.tsx | Add Projects strip section |
| src/routes/investments.tsx | Add "In Progress" section for capital projects |
| src/lib/supabaseMock.ts | Add projects seed + project_id on transactions |
| src/lib/netWorth.ts | Include capital project totals in net worth |

---

## 7. Net Worth Computation Change

In src/lib/netWorth.ts:

```typescript
// Add capital project totals as an asset class
const capitalProjectsTotal = projects
  .filter(p => p.project_type === 'capital' && p.status !== 'completed')
  .reduce((sum, p) => sum + (p.total_spent ?? 0), 0);

const netWorth = liquidTotal + investmentsTotal + physicalAssetsTotal
               + capitalProjectsTotal   // new
               - liabilitiesTotal;
```

total_spent per project = sum of all transactions with that project_id.

---

## 8. Dashboard Expense Chart Exclusion

In src/routes/index.tsx where expenses are summed:

```typescript
// Before:
const expenses = transactions.filter(t =>
  t.transaction_type_id === SEED.transaction_types.expense
);

// After:
const capitalProjectIds = new Set(
  projects
    .filter(p => p.project_type === 'capital')
    .map(p => p.id)
);

const expenses = transactions.filter(t =>
  t.transaction_type_id === SEED.transaction_types.expense
  && !capitalProjectIds.has(t.project_id)  // exclude capital project expenses
);
```

For general project expenses that ARE included: group them as a "Projects" category in the spending donut instead of mixing with Food/Shopping.

---

## 9. Implementation Tasks (Ordered)

### Phase 1 — Foundation

- [ ] P1: Supabase migration — create projects table with RLS
- [ ] P2: Supabase migration — add project_id column to transactions
- [ ] P3: Update supabaseMock.ts — add projects seed data and project_id support
- [ ] P4: Update router.ts — register /projects and /projects/$projectId routes
- [ ] P5: Add Projects to navigationItems in __root.tsx with FolderKanban icon

### Phase 2 — Projects List and Create

- [ ] P6: Create EmojiPicker.tsx — grid of ~20 emojis, selectable with highlight
- [ ] P7: Create projects.tsx — project list page with Active/Completed/All tabs
- [ ] P8: Create/Edit modal in projects.tsx — name, emoji, type toggle, budget, dates
- [ ] P9: Implement full CRUD: create, edit, delete, pause/resume project
- [ ] P10: Empty state for projects list

### Phase 3 — Project Detail Page

- [ ] P11: Create project-detail.tsx route
- [ ] P12: Fetch project + all its transactions
- [ ] P13: Stat cards: Spent, Budget, Remaining, Days Active
- [ ] P14: Progress bar (spent vs budget, hidden if no budget)
- [ ] P15: Recent expenses list (last 5 + View All link)
- [ ] P16: Spending by category donut chart
- [ ] P17: Cumulative spend timeline area chart
- [ ] P18: "Add Expense to this Project" button with pre-filled project in modal
- [ ] P19: "Mark Complete → Convert to Asset" button for capital projects

### Phase 4 — Transactions Page Integration

- [ ] P20: Create ProjectBadge.tsx component
- [ ] P21: Render ProjectBadge on each transaction row in transactions.tsx
- [ ] P22: Add project selector filter above transaction list
- [ ] P23: Filter transactions by selected project (state + URL param)
- [ ] P24: Add "Assign to Project" optional field to Add Transaction modal
- [ ] P25: Create ProjectSelector.tsx dropdown component
- [ ] P26: Wire /money?project=id URL param (for "View All" from project detail)

### Phase 5 — Net Worth and Dashboard

- [ ] P27: Update netWorth.ts — include capital project totals
- [ ] P28: Update dashboard expense chart — exclude capital project transactions
- [ ] P29: Group general project expenses as "Projects" in spending donut
- [ ] P30: Add Projects strip to home dashboard — hidden if no active projects

### Phase 6 — Assets Integration

- [ ] P31: Add "In Progress" section to investments.tsx
- [ ] P32: Show each active capital project as asset card with total invested
- [ ] P33: Include capital project total in net worth display on Assets page

### Phase 7 — Polish and Edge Cases

- [ ] P34: Handle project deletion — ask what to do with linked transactions
- [ ] P35: Handle general project completion — freeze, mark done
- [ ] P36: Validate: no budget = no progress bar
- [ ] P37: Empty state inside project detail (no expenses yet)
- [ ] P38: Mobile: MobilePageHeader on project-detail.tsx
- [ ] P39: Integrate with useAppRefresh if applicable
- [ ] P40: npm run build — zero TypeScript errors

---

## 10. Edge Cases and Rules

| Scenario | Behaviour |
|---|---|
| User deletes a project | Ask: "Keep transactions as regular expenses?" Yes = set project_id = null. No = delete transactions. |
| Capital project completed | Link to new asset. Transactions stay. Project freezes. |
| User adds expense to a paused project | Allowed. Pausing is visual only. |
| Budget not set | No progress bar, no Remaining stat. Show total spent only. |
| Transaction moved between projects | Allowed via edit transaction, change Project field. |
| Capital project with no budget | No progress bar. Still shows as "In Progress" asset. |
| Project linked to asset then deleted | Warn: unlinking the asset. Allow proceed. |

---

## 11. Supabase Migrations (Run In Order)

```sql
-- 001: Create projects table
create table if not exists public.projects (
  id                  uuid        default gen_random_uuid() primary key,
  created_by          uuid        references auth.users(id) on delete cascade not null,
  name                text        not null,
  description         text,
  emoji               text        default '📁',
  color               text        default 'indigo',
  project_type        text        check (project_type in ('capital', 'general')) not null default 'general',
  budget              numeric(15,2),
  status              text        check (status in ('active', 'completed', 'paused')) default 'active',
  start_date          date        default current_date,
  end_date            date,
  linked_asset_id     uuid,
  exclude_from_charts boolean     default true,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  is_deleted          boolean     default false
);

alter table public.projects enable row level security;
drop policy if exists "projects_own" on public.projects;
create policy "projects_own" on public.projects
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- 002: Add project_id to transactions
alter table public.transactions
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists idx_transactions_project_id
  on public.transactions(project_id)
  where project_id is not null;
```

---

## 12. User-Facing Copy

| Internal term | User sees |
|---|---|
| capital | "Building / Investment" |
| general | "Project / Event" |
| active | "Active" |
| paused | "Paused" |
| completed | "Completed" |
| Page title | Projects |
| Empty state headline | "Start your first Project" |
| Empty state subline | "Track a house build, wedding, renovation, trip — anything with many expenses." |
| Create button | "+ New Project" |
| Type: capital | "Building / Investment — creates an asset when done" |
| Type: general | "Project / Event — tracks spending on an event or goal" |

---

## 13. What NOT to Build (Keep it Minimal)

| Temptation | Decision |
|---|---|
| Project members / collaboration | Not needed. Single-user app. |
| Sub-projects or folders | Overcomplication. One level only. |
| Vendor/contractor management | Out of scope. Notes field on transactions is enough. |
| Invoice/receipt per project | Receipts already on transactions. Covered. |
| Per-category budgets inside a project | Too complex. One top-level budget per project. |
| Project templates | Nice to have later. Not now. |
| Gantt chart or timeline planning | This is finance tracking, not project management. |

---

## 14. Testing Checklist

- [ ] Create capital project, add 5 expenses — net worth did NOT go down
- [ ] Create general project, add 3 expenses — net worth DID go down
- [ ] Transactions feed — project badge visible on tagged transactions
- [ ] Filter by project — only that project's transactions show
- [ ] Add expense from project detail — appears in main feed with badge
- [ ] Complete capital project — creates asset in Investments screen
- [ ] Delete project — transactions handled correctly per user choice
- [ ] Pause project — can still add expenses
- [ ] Home dashboard — projects strip appears, hidden when no projects
- [ ] Assets screen — capital project "In Progress" value shown
- [ ] npm run build — zero errors

---

*Plan: 2026-08-18 · WealthMap Projects Feature · Production Specification*
