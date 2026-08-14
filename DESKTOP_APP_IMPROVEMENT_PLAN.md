# WealthMap — Desktop App Improvement Plan

> **Scope:** Desktop-only improvements (md: breakpoint and above). Mobile experience must remain unchanged.
> **Philosophy:** The app already has a solid foundation — claymorphism, good colour tokens, working sidebar, clean page structure. This plan focuses on elevating it from "functional" to "polished, premium, and delightful" on desktop.
> **Constraint:** No new dependencies unless absolutely necessary. No rewrites of business logic.

---

## 1. Desktop State Analysis

### Current Layout (Desktop)

```
Sidebar (228px or 70px collapsed) | Header (64px)
 Logo + WealthMap                  | Main Content (overflow-y-auto)
 Nav links x5                      |
 Theme switcher                    |
 Log Out                           |
```

### What Works Well on Desktop

- Collapsible sidebar with smooth transition (228px to 70px)
- Header with greeting + date + NotificationsBell
- Claymorphism card styling consistent across all pages
- Page transitions via Framer Motion AnimatePresence
- Persistent theme switcher (Light / Dark / System) in sidebar footer
- All 7 routes functional and reachable
- Cards use hover:-translate-y-[2px] micro-lift effect
- Dialog modal centres on sm:items-center (desktop: centred overlay)
- Insights route exists at /insights (accessible even though not in sidebar nav)

### Desktop Problems Found

#### Navigation and Layout
1. **Sidebar active state** — text colour only, no left border accent or strong visual cue
2. **Sidebar collapse toggle** — a tiny 24x24 circle at right-[-12px] floating outside the sidebar, easy to miss
3. **Insights page is orphaned** — valid route at /insights but not in navigationItems. Users cannot discover it
4. **Bills not in sidebar** — only reachable from Dashboard activity feed. No sidebar link
5. **Header is mostly empty** — only greeting + NotificationsBell. 64px of underutilised real estate
6. **No keyboard navigation** — no Cmd+1 through Cmd+5 shortcuts, no focus management
7. **Content area not constrained on ultra-wide screens** — on 1440px+ monitors, content stretches uncomfortably

#### Dashboard (index.tsx)
8. **3 stat cards** show just icon + label + number. No trend vs last period shown on desktop
9. **Goals/Loans horizontal scroll strip** — feels like a placeholder on desktop where there is room for a proper grid
10. **Activity feed row hover** uses hover:bg-white/5 which is invisible in light mode
11. **Chart tooltips** use hardcoded backgroundColor: #1A1A1A — dark tooltip visible even in light mode

#### Transactions (transactions.tsx)
12. **AI Quick-Add box is at the bottom** of the page, buried under the full transaction list
13. **Transaction row delete button** is always visible — creates visual noise on long lists on desktop
14. **Filter bar is stacked vertically** — desktop has room for a single horizontal row
15. **Download CSV button** has no text label on desktop, just a bare icon

#### Goals and Loans (goals.tsx)
16. **Loan cards visual inconsistency** — Goals cards are dark premium-styled; Loan cards use the standard clay Card style
17. **Goal hover action buttons** have no transition — they snap in/out without animation
18. **New user onboarding** — no split CTA when both lists are empty

#### Assets (investments.tsx)
19. **Tab bar is full width** — looks stretched on desktop, should be compact left-aligned
20. **Account card balance** lacks visual hierarchy — balance is not the dominant visual element

#### Bills (bills.tsx)
21. **Edit/Delete buttons always visible** on desktop — should be hover-only
22. **No urgency visual treatment** — bill due in 2 days looks the same as bill due in 30 days
23. **No summary stats row** — no "Total upcoming" or "Next due" context above the list

#### Settings (settings.tsx)
24. **Page header** uses plain text, not the page-title CSS class used by other pages
25. **Profile card chevron** has no click handler — looks like a button but does nothing

#### Insights (insights.tsx)
26. **Not reachable from sidebar** — must navigate to /insights directly
27. **Chart heights are fixed** at h-56 — could be taller on large desktop screens

---

## 2. Screen-by-Screen Desktop Plan

### 2.1 Root Shell and Sidebar (__root.tsx)

**Active State:**
- Add border-l-[3px] border-primary and pl-[calc(1rem-3px)] to active nav item
- Add font-semibold to active link label

**Add Bills and Insights to Sidebar:**
- Add to navigationItems array: Bills (with Receipt icon) and Insights (with BarChart3 icon)
- Both are already registered routes in router.ts

**Header:**
- Right side: add quick "Add Transaction" shortcut button visible from all pages on desktop
- Or: Show current page name as breadcrumb in header centre

**Content Width Cap:**
- Wrap Outlet in max-w-[1280px] mx-auto w-full inside main content area
- Prevents content stretching on 4K and ultra-wide monitors

### 2.2 Dashboard (index.tsx)

**Stat Cards — Trend Indicators:**
- Add a second line under each stat card value showing % vs last period
- Data computation is already done for Net Worth — apply same pattern to Income and Expenses

**Goals/Loans — Desktop Grid:**
- On lg: and above, render goals/loans as grid-cols-2 gap-3 instead of horizontal overflow strip

**Activity Feed Hover:**
- Replace hover:bg-white/5 with hover:bg-accent/30 for light mode visibility

**Chart Tooltips — Theme Fix:**
- Replace contentStyle: { backgroundColor: "#1A1A1A" } with hsl(var(--card)) in all Recharts Tooltip calls
- Also fix text colour and border colour to use CSS variables

**Time Filter — Desktop Pill Row:**
- Replace the hidden-select hack with a visible pill button row on desktop (md:flex hidden)
- 5 pills: This Month, Last Month, Last 3M, Last Year, All Time

### 2.3 Transactions (transactions.tsx)

**Promote Quick-Add to Top:**
- Move the AI Quick Entry box from line 1183 (bottom) to the top of the page on desktop
- On desktop only (hidden md:flex) — mobile keeps it at bottom or removes it

**Horizontal Filter Bar:**
- On desktop: flex all 3 filters (type tabs, date select, search) in one row
- hidden md:flex items-center gap-3

**Transaction Row Hover Actions:**
- Add group class to row wrapper
- Set md:opacity-0 md:group-hover:opacity-100 transition-opacity on delete button
- Add an Edit (pencil) icon button beside delete — also hover-only

**Download CSV Button:**
- Add hidden sm:inline text label "Export" beside the download icon

### 2.4 Goals and Loans (goals.tsx)

**Loan Cards Visual Consistency:**
- Apply same dark card treatment as Goals cards, OR apply a red/liability tint
- Loan cards use standard Card component. Goals use custom dark bg-[#111111] cards

**Goal Hover Actions — Add Transition:**
- Add transition-opacity duration-150 to the opacity-0 group-hover:opacity-100 action buttons

**New User Onboarding:**
- When both goals and loans are empty, show a 2-column CTA layout
- Left: Create your first savings goal + Add Goal button
- Right: Track an existing loan + Add Loan button

### 2.5 Assets (investments.tsx)

**Tab Bar Compact:**
- Add md:w-auto md:self-start to the tab bar wrapper
- Makes it left-aligned and compact instead of full-width stretched

**Account Cards Balance Hierarchy:**
- Make balance text text-2xl font-bold
- Stack account name and type above the balance in a flex-col layout

### 2.6 Bills (bills.tsx)

**Edit/Delete Hover-Only on Desktop:**
- Use md:opacity-0 md:group-hover:opacity-100 transition-opacity
- Add group class to bill card wrapper

**Urgency Visual Treatment:**
- Bills due <= 3 days: red left border accent border-l-4 border-red-500 + "Due Soon" badge
- Bills due <= 7 days: amber border-l-4 border-amber-500
- Bills due later: normal style

**Summary Stats Row:**
- Above filter tabs: "Total upcoming: X • Next due: [Name] in Y days"

### 2.7 Settings (settings.tsx)

**Page Header:**
- Change h1 to use page-title CSS class and add secondary-text subtitle below

**Remove Non-Functional Chevron:**
- Remove the ChevronDown icon on the profile header card that has no click handler

### 2.8 Insights (insights.tsx)

**Add to Sidebar:**
- Add { label: Insights, path: /insights, icon: BarChart3 } to navigationItems

**Chart Heights:**
- Change h-56 to h-56 lg:h-72 on chart containers for better readability on large screens

---

## 3. Global Desktop Improvements

### 3.1 Input Claymorphism Style

Add to index.css:

```css
.desktop-input {
  background: var(--color-background);
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 0.75rem);
  box-shadow: inset 1px 1px 3px rgba(0,0,0,0.04), inset -1px -1px 3px rgba(255,255,255,0.8);
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}
.desktop-input:focus {
  box-shadow: inset 2px 2px 4px rgba(0,0,0,0.06), 0 0 0 3px hsl(var(--ring) / 0.3);
  border-color: hsl(var(--primary) / 0.5);
  outline: none;
}
.dark .desktop-input {
  box-shadow: inset 1px 1px 3px rgba(0,0,0,0.3), inset -1px -1px 3px rgba(255,255,255,0.03);
}
```

### 3.2 Chart Tooltip Theme Fix (Applied Across All Charts)

Replace all Recharts contentStyle objects. Before:
  contentStyle={{ backgroundColor: "#1A1A1A", border: "1px solid rgba(255,255,255,0.1)" }}

After:
  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px", color: "hsl(var(--foreground))" }}

Affects index.tsx (2 charts) and insights.tsx (3 charts).

### 3.3 Content Width Cap

In __root.tsx, wrap Outlet in:
  <div class="max-w-[1280px] mx-auto w-full">

### 3.4 Hover States Light Mode Fix

Replace hover:bg-white/5 everywhere with hover:bg-accent/30

### 3.5 EmptyState Component

Create src/components/ui/EmptyState.tsx:
  Props: icon, title, description (optional), action (optional: label + onClick)
  Replace manual empty state JSX in goals.tsx, transactions.tsx, bills.tsx

### 3.6 Keyboard Navigation

In __root.tsx, add useEffect with keydown listener:
  Cmd/Ctrl+1 -> /
  Cmd/Ctrl+2 -> /money
  Cmd/Ctrl+3 -> /goals
  Cmd/Ctrl+4 -> /investments
  Cmd/Ctrl+5 -> /bills
  Cmd/Ctrl+6 -> /insights
  Cmd/Ctrl+7 -> /settings

Skip shortcut if a form input is currently focused (check document.activeElement).

