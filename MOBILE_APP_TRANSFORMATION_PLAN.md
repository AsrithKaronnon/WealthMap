# WealthMap Mobile App Transformation Plan

**Status:** mobile UX plan (Phases A–F) + **§9 functional/data-integrity**. Section 9 implemented 2026-08-15 (Option B: single DB trigger + app flow fixes).  
**Constraint:** desktop (`md:` / `≥768px`) must stay unchanged for UI work. Functional fixes in §9 apply to shared logic (desktop and mobile).  
**Theme:** claymorphism (`.clay`, `.clay-btn`, `.clay-input-wrapper`, `.clay-badge` in `src/index.css`) is the established look. Do not replace it with glass/flat chrome.

This plan is written against the **current codebase**, including mobile work already in the tree. It does not assume a greenfield app.

---

## 1. Current app analysis

### 1.1 What WealthMap is

WealthMap is a personal-finance PWA: login, PIN lock, then a logged-in shell with dashboard, ledger, goals/loans, bills, assets, settings, and an insights page. Data lives in **Supabase** (`src/lib/supabaseClient.ts` via `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`). Edge functions exist under `supabase/functions/` (`finance`, `process-sips`, `process-recurring-transactions`, `networth-cron`). `src/lib/supabaseMock.ts` is seed/schema IDs (`SEED`), not the live data layer.

Deploy target is **GitHub Pages** (`vite.config.ts` `base: '/WealthMap/'`, `gh-pages` script). Routing is **hash history** so reloads do not 404.

### 1.2 Stack (do not rewrite)

| Layer | Choice | Where |
|--------|--------|--------|
| UI | React 19 + TypeScript | `src/` |
| Build | Vite 8 | `vite.config.ts` |
| Routing | TanStack Router + `createHashHistory()` | `src/routes/router.ts` |
| Data fetch | Mostly `useEffect` + `supabase.from(...)` | route files |
| React Query | Client created, **almost unused** | `src/main.tsx` |
| Styling | Tailwind v4 + large global CSS | `src/index.css` |
| Motion | Framer Motion | Dialog, Tabs, page `AnimatePresence`, Button `whileTap` |
| Charts | Recharts | Dashboard, Insights, Assets |
| Toasts / confirms | Zustand | `src/lib/useToastStore.ts`, `useConfirmStore.ts` |
| PWA | `vite-plugin-pwa` `registerType: 'autoUpdate'` | `vite.config.ts` |
| Icons | Lucide | throughout |

**Do not** extract a second data layer or duplicate business logic. Mobile should be layout/chrome around the same handlers already in each route file.

### 1.3 Route map

Defined in `src/routes/router.ts`:

| Path | Component | File | In sidebar / bottom nav? |
|------|-----------|------|---------------------------|
| `/` | `Dashboard` | `src/routes/index.tsx` | Yes — “Home” |
| `/money` | `Transactions` | `src/routes/transactions.tsx` | Yes — “My Money” / “Money” |
| `/goals` | `Goals` | `src/routes/goals.tsx` | Yes — “Goals & Loans” / “Goals” |
| `/investments` | `Investments` | `src/routes/investments.tsx` | Yes — “Assets” |
| `/settings` | `Settings` | `src/routes/settings.tsx` | Yes — “Settings” / **“More”** |
| `/bills` | `Bills` | `src/routes/bills.tsx` | **No** |
| `/insights` | `Insights` | `src/routes/insights.tsx` | **No** — no in-app link at all |

`/money` search: `{ add?: '1' }` (`validateSearch`). Home’s + button does `navigate({ to: '/money', search: { add: '1' } })`. Hash URL: `/WealthMap/#/money?add=1`.

### 1.4 App bootstrap and gates

1. **`src/main.tsx` `AppWrapper`** — if `localStorage.app_pin` and no `sessionStorage.app_unlocked`, render `LockScreen` **before** the router. Auto-lock after 5 minutes of `document.visibilityState === 'hidden'`.
2. **`RootLayout` (`src/routes/__root.tsx`)** — spinner until `supabase.auth.getSession()`, then login/signup clay card, then logged-in shell.
3. **`ErrorBoundary`** wraps only the `<Outlet />` (not auth, not lock screen).
4. **`PinSetupPrompt`** mounts on the Dashboard after ~1.5s if PIN was never prompted.

PIN / WebAuthn (`src/lib/webauthn.ts`) is **device lock**, not server auth. RP name is `"Finapp Security"`. Credentials live in `localStorage`.

### 1.5 Shell: desktop vs mobile (already split)

**Desktop (`hidden md:flex`):** clay sidebar (`w-[228px]` / collapsed `70px`) with the five `navigationItems`, theme segmented control, Log Out, collapse chevron. Top header (`h-[64px]`): greeting, date, `NotificationsBell`. Main padding `md:px-6 md:py-6`.

**Mobile (`md:hidden`):** fixed clay bottom nav (`.mobile-bottom-nav`) with the **same five items**, short labels `Money` / `Goals` / `More`. Active tab uses `clay-btn active`. Main has `pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]` and `pt-[env(safe-area-inset-top)]` on the outer shell. Desktop header is hidden; each page supplies its own sticky header.

`navigationItems` in `__root.tsx`:

```
Home → /
My Money → /money
Goals & Loans → /goals
Assets → /investments
Settings → /settings
```

Bills and Insights are **not** in this list.

### 1.6 Shared UI (current mobile behavior)

| Component | File | Current mobile behavior |
|-----------|------|-------------------------|
| `Dialog` | `src/components/ui/Dialog.tsx` | Bottom sheet (`items-end`, slide from `y: 100%`) below `sm`; centered modal from `sm:`. Clay, `max-h-[92vh]`, `overscroll-contain`, `pb-[env(safe-area-inset-bottom)]`. Close is `h-10 w-10` (40px). **No `visualViewport` / keyboard inset.** |
| `Card` | `src/components/ui/Card.tsx` | Always `.clay` + `overflow-hidden` (can clip outer clay shadows). Padding `p-3 sm:p-6`. |
| `Button` | `src/components/ui/Button.tsx` | Fixed `h-[40px]` — under 44px Apple HIG unless a page overrides `min-h-[44px]`. Clay on primary/secondary/outline/danger. |
| `Tabs` | `src/components/ui/Tabs.tsx` | Horizontal scroll, clay well, `layoutId="activeTabBg"` **shared globally** (can fight across pages). `py-1.5 text-xs` — short tap height. |
| `Toast` | `src/components/ui/Toast.tsx` | Top, respects `safe-area-inset-top`. |
| `MobilePageHeader` | `src/components/ui/MobilePageHeader.tsx` | `md:hidden sticky top-0`, blur bar, title is a `<span>` (avoids global `h1` rules). Used by Goals, Bills, Assets, Settings. Home and Money roll their own sticky bars. |
| `NotificationsBell` | `src/components/NotificationsBell.tsx` | Desktop header + **Home mobile only**. Dropdown `max-w-[calc(100vw-32px)]`, not a sheet. |
| `LockScreen` | `src/components/LockScreen.tsx` | Full-screen clay keypad (`h-16` keys). |
| `PinSetupPrompt` | `src/components/PinSetupPrompt.tsx` | Centered modal, not a bottom sheet. |
| `ConfirmDialog` | `src/components/ui/ConfirmDialog.tsx` | Thin Dialog + zustand wrapper. |

### 1.7 PWA setup (current)

`vite.config.ts`:

- `start_url: '/WealthMap/'`
- `display: 'standalone'`, `display_override: ['standalone', 'minimal-ui']`
- `orientation: 'portrait'`
- `theme_color` / `background_color`: `#0d1117`
- Icons: `logo.png` (`any` 192/512), `logo-maskable.png` (`maskable` 512)

`index.html`:

- `viewport-fit=cover`
- `apple-mobile-web-app-capable=yes`
- `apple-mobile-web-app-status-bar-style=black-translucent`
- Dual `theme-color` for light/dark preference

Offline: `RootLayout` listens to `offline`/`online` and shows a fixed top banner. There is **no custom Workbox runtime cache** — plugin defaults only. The app is not a true offline-capable data app; it only warns that data may be stale.

### 1.8 CSS realities (`src/index.css`)

- Clay utilities with `!important` box-shadows (so Tailwind `shadow-lg` cannot kill them).
- Global `input, select { height: 48px !important }` — **duplicated** later in the file.
- `.compact-input` forced to `2.5rem !important` at the **end** of the file (must stay last or it loses to the 48px rule).
- `@media (max-width: 767px)`: unset global `h1` inflation; stop uppercase `label`; clay docked `.mobile-bottom-nav`.
- `body { overscroll-behavior: none; overflow-x: hidden }`, tap-highlight transparent, `-webkit-overflow-scrolling: touch`.
- Large **duplicated blocks** of typography / input / clay-input rules (~lines 252–330 mirrored later). Local Tailwind often loses to `!important`.

### 1.9 What already feels like a mobile app

Do **not** redo these unless fixing a bug:

- Bottom nav + content padding for the tab bar and home-indicator
- Sticky in-page headers on Home, Money, Goals, Bills, Assets, Settings
- Dialog as bottom sheet on phones
- Home time filter as a button + sheet (desktop keeps the hidden `<select>`)
- Money quick-add in the sticky chrome (desktop still has the bottom AI card `hidden md:block`)
- Many 44px action targets (bills Pay, budget ±50, account edit/hide)
- Chart tooltips on Dashboard: `trigger={isMobile ? 'click' : 'hover'}`
- Auth password show/hide 44px hit target, `autocomplete` attributes
- Clay theme on cards, buttons, nav, login card
- PWA metas, maskable icon, portrait standalone

### 1.10 What still feels like a squeezed desktop site

These are the transformation gaps:

1. **Orphan screens:** `/bills` only from Dashboard “Pay”; `/insights` has **zero** nav entry. Bottom nav’s “More” is just Settings, not a hub.
2. **Mobile Settings has no Log Out or theme** — both live only in the desktop sidebar.
3. **Goals deposit/delete** are `opacity-0 group-hover:opacity-100` — **invisible on touch**.
4. **Receipt remove overlay** in the transaction form is the same hover pattern (`transactions.tsx` ~1107).
5. **Native `<select>`** for Money date filter (and Insights month is a simple toggle, but other forms still use native selects).
6. **`grid-cols-3` metric pills** on Dashboard (Cash / Income / Spent) and Insights (Income / Spent / Saved) — cramped type.
7. **Tiny tap targets:** Dashboard activity “Pay” is `h-6 text-[10px]`; transaction delete is `p-1.5`; default `Button` is 40px; `Tabs` are `py-1.5`.
8. **Notifications** only on Home (mobile). Other tabs have none.
9. **Currency** is loaded in Settings (`currencies`, `base_currency_id`) but **there is no picker UI**.
10. **Dead budgets branch** on Money (`activeTab === 'budgets'` exists; tabs never include `'budgets'`). Budgets already live in Settings — do not hide the Settings version; just don’t resurrect a duplicate Money tab unless product wants it.
11. **Keyboard vs sheets:** long forms (add transaction, add asset search) in `max-h-[92vh]` sheets with no `visualViewport` handling — iOS keyboard covers fields.
12. **Insights** has no `MobilePageHeader`, no click tooltips, no entry point.
13. **PinSetupPrompt** is a centered overlay, not a sheet.
14. **README is stale** (glassmorphism, dashboard widget reorder, currency picker, Insights as a first-class module). Do not treat README as source of truth.

---

## 2. Screen-by-screen mobile plan

Breakpoint: **mobile = `<768px` (`md`)**. `sm` (640px) is used inside some cards (bills 2-row layout, form grids). Prefer extending that pattern over new breakpoints.

### 2.1 Auth (`RootLayout` unauthenticated branch)

**Keep:** clay card, signup 1-col then `sm:grid-cols-2`, password toggle, forgot-password, safe-area bottom padding.

**Change:**

- Ensure the card can scroll when the keyboard is open (`visualViewport` or extra `pb` while focused). Signup fields already overflow a short phone.
- `h1` “WealthMap” is fine (global mobile `h1` reset exists); do not restyle desktop.
- Do not add a second auth route — stay in `__root.tsx`.

### 2.2 Lock screen (`LockScreen`)

**Keep:** full-screen keypad, biometric button, large keys.

**Change:**

- Respect `safe-area-inset-top` / bottom so keys are not under the home indicator.
- Confirm PIN dots + error shake still work in standalone (status bar translucent).

### 2.3 Home / Dashboard (`src/routes/index.tsx`)

**Keep:** compact sticky greeting row (`h-12`) with auto-shrink font; filter sheet; bell; + → `/money?add=1`; net-worth card + sparkline; 3 metric tiles; donut + income/expense charts stacked; horizontal goals/loans chips with fade; activity list; `PinSetupPrompt`.

**Change:**

- Metric row: keep 3 columns but raise type hierarchy (amount first, label under) or allow wrap so “Income” does not truncate. Do not drop a metric.
- Activity “Pay” (`h-6 text-[10px]`) → `min-h-[44px]` **only under `md:` hidden desktop style kept**.
- Goals/loans chip row: keep horizontal snap; tapping a chip should go to `/goals` (if not already).
- Optional: small “Bills” / “Insights” chips in the activity or a “More” row so those routes are discoverable without stuffing the tab bar. Prefer linking from Settings hub (see §3) plus one Dashboard shortcut.
- Loading skeletons already exist — keep them. Empty `hasData` path must still show net worth / accounts.

**Do not** put the desktop greeting header on mobile. **Do not** replace the desktop `<select>` filter.

### 2.4 Money / Transactions (`src/routes/transactions.tsx`)

**Keep:** custom sticky header (title + export + add); sticky quick-add + camera; All / Expenses / Income clay segment; search well; date-grouped **cards** (already not a table); tap row to edit; Manual | Scan Bill dialog; CSV export; transfer + recurring fields; `/money?add=1` deep link.

**Change:**

- Replace the **mobile** date `<select>` with a filter button + bottom sheet (same pattern as Dashboard). Desktop can keep the select or the current compact select — if the select is shared, wrap: sheet `md:hidden`, select `hidden md:block`.
- Custom range date inputs: full width stacked (already `flex-col sm:flex-row`).
- Delete on a row: enlarge to 44px on mobile; keep `confirm()` via `ConfirmDialog`.
- Receipt remove: replace hover overlay with a persistent “Remove photo” control `md:hidden` (desktop may keep hover).
- Form: keep 2-col mobile grids and `inputMode="numeric"` where present; audit remaining fields (notes, category, account) for 16px-equivalent type to avoid iOS zoom (global 48px inputs already help).
- Keyboard: when the add/edit `Dialog` is open, pad the sheet by `window.visualViewport` or scroll the focused field into view.
- Do **not** hide CSV, transfers, receipts, or recurring. Export stays in the header icon.
- Leave the unreachable `'budgets'` branch alone or delete it as dead code in a later cleanup — budgets remain in Settings.

### 2.5 Goals & Loans (`src/routes/goals.tsx`)

**Keep:** `MobilePageHeader` + loan icon + add goal; clay total-goals banner; list of goal cards; loan `Card` grid; dialogs for create/deposit/EMI.

**Must fix:**

- Deposit and delete on goal cards: `opacity-0 group-hover:opacity-100` → always visible on mobile (`opacity-100 md:opacity-0 md:group-hover:opacity-100`), 44px targets, same handlers (`setDepositGoal`, `handleGoalDelete`). **Do not remove the feature.**

**Change:**

- Loan edit/delete already exist; verify 44px on mobile.
- Empty “Create New Goal” clay row is tappable — keep.
- Progress bars: already clay-friendly (`bg-muted`).

### 2.6 Bills (`src/routes/bills.tsx`)

**Keep:** `MobilePageHeader`, Upcoming/Paid `Tabs`, 2-row card layout (`flex-col sm:flex-row`), Pay `min-h-[44px]`, Active/Paused chip, loan rows mixed in, pay → transaction + rollover.

**Change:**

- **Discoverability:** add a Settings (More) row and/or Dashboard shortcut. Do not drop Bills from the product.
- Pause/Active chip on mobile is `min-h-[28px]` — bump to 44px height or a full-width toggle under the name.
- Edit/delete already `opacity-100 sm:opacity-0` — good; keep.
- After paying from Dashboard, landing on `/bills` with no back affordance: sticky title is enough if More → Bills exists; optional `history.back` is **not** required if tab hub works.

### 2.7 Assets (`src/routes/investments.tsx`)

**Keep:** `MobilePageHeader` + contextual + (liquid / investments / physical); net-worth primary banner; `Tabs` for Liquid / Investments / Physical; card grids `grid-cols-1 md:grid-cols-2`; live prices; SIP fields; hide account; payoff; add-choice dialog (stocks vs FD).

**Change:**

- Asset tabs: ensure the `Tabs` row is full-width and 44px-tall on mobile; horizontal scroll is OK.
- Search results popover in the add-asset dialog (`absolute` list) can be trapped under the keyboard — make it a scroll region inside the sheet.
- Edit/delete already visible on mobile (`opacity-100 sm:opacity-0`) — keep.
- 2×2 physical/FD tiles if still cramped: stack to 1 col under `md` only if they currently overflow; **do not hide** FD / gold / property / vehicle.

### 2.8 Settings (`src/routes/settings.tsx`) — mobile “More”

**Keep:** accordion clay rows: Profile, Monthly Budget, Theme, App Lock; `MobilePageHeader`; budget ±50 on mobile.

**Change (this is the overflow hub):**

- Add **mobile-only** rows (not desktop sidebar duplicates that already exist, but Settings currently lacks these on phone):
  - **Bills** → `/bills`
  - **Insights** → `/insights`
  - **Log Out** (call the same `supabase.auth.signOut` as `__root.tsx`; lift a tiny helper or pass a callback — do not copy auth logic twice if avoidable)
- Theme already exists **in this page** (accordion). Confirm it works on mobile; desktop sidebar theme can stay as-is.
- Profile header chevron is decorative (`-rotate-90`) and does not open Profile — either wire it to `activeSection === 'profile'` or remove the chevron on mobile so it doesn’t look broken.
- **Currency picker:** state `currency` / `currencies` is loaded and used for budget symbols, but there is no `<select>`/sheet to change `user_settings.base_currency_id`. Add a Settings row that writes the existing column. This is preserving advertised functionality, not a new product.
- PIN / biometrics / password stay. Use `autocomplete` already present.

### 2.9 Insights (`src/routes/insights.tsx`)

**Keep:** all charts and budget bars; month toggle (`current` | `last`); same calculations.

**Change:**

- Add `MobilePageHeader title="Insights"`.
- Reachable from Settings hub (required) and optionally Dashboard.
- Summary pills: avoid crushing `grid-cols-3`; stacked amounts or 2+1 wrap.
- Recharts `Tooltip` `trigger="click"` on mobile (copy Dashboard’s `isMobile` pattern).
- Loading skeletons already exist.

### 2.10 Toasts, confirms, errors

- Toasts: already safe-area aware. Keep top placement (bottom would collide with tab bar).
- Confirms: inherit Dialog sheet — good. Destructive confirm buttons must be 44px on mobile.
- Error boundary: clay card + reload — add safe-area padding so the button is tappable on iPhone.

---

## 3. Recommended mobile navigation and UI approach

### 3.1 Do not add a sixth bottom-tab

Five tabs is already the limit. Labels are already shortened. Cramming Bills + Insights into the bar would shrink targets and fight the “desktop nav list stays 5 items” mapping.

**Recommended IA**

| Bottom tab | Route | Role |
|------------|--------|------|
| Home | `/` | Glance + add + filter + activity |
| Money | `/money` | Daily ledger + quick-add |
| Goals | `/goals` | Savings + debt |
| Assets | `/investments` | Net worth breakdown |
| More | `/settings` | **Hub:** profile, budgets, theme, lock, **Bills**, **Insights**, **currency**, **Log Out** |

Desktop sidebar **unchanged** (still 5 items, still no Bills/Insights). Desktop users keep using `/bills` from Dashboard Pay and `/insights` via hash unless we later add desktop links (out of scope unless desired).

### 3.2 Headers

- One sticky bar per page, `h-12`, blur, clay icon buttons, purple/clay + for primary create.
- Never use global `h1.page-title` on mobile (it was inflated by CSS). Keep using `MobilePageHeader` / `<span>`.
- Primary create always in the header (not a FAB). A FAB was tried and covered list content; do not bring it back.
- Notifications: either keep Home-only (acceptable) or add the bell to `MobilePageHeader` via a slot — if added, hide the duplicate on Home.

### 3.3 Sheets vs modals vs native controls

| Pattern | Use on mobile | Keep on desktop |
|---------|----------------|-----------------|
| `Dialog` bottom sheet | All create/edit/pay/filter pickers | Centered `sm:items-center` (already) |
| Native `<select>` | Avoid for primary filters | OK |
| Native date input | Custom range, due dates | OK |
| Hover-reveal actions | Never as the only affordance | OK behind `md:` |
| Horizontal chips / tabs | OK with scroll + 44px height | Grid |

### 3.4 Lists vs tables

There is **no HTML table ledger** today. Money, bills, goals, assets are already cards. Do not introduce tables on mobile. Do not shrink a “desktop table” that does not exist.

### 3.5 Touch

- Minimum 44×44px for destructive and primary actions on `max-width: 767px`.
- `active:scale-95` is already used; keep.
- `cursor-pointer` is irrelevant on device; leave it for desktop.
- Do not rely on `group-hover`.

### 3.6 Scrolling

- Single vertical scroller: `main.overflow-y-auto` in `__root.tsx`. Nested scroll only inside Dialog body and horizontal chip rows.
- Sticky headers use `sticky top-0` **inside** that main scroller (`-mx-3` to bleed to edges). Keep this; do not make each page `h-screen overflow-y-auto`.
- Bottom padding must continue to clear the tab bar.

### 3.7 Keyboard

- Shared fix in `Dialog`: on open, subscribe to `visualViewport` and set `paddingBottom` (or `height`) so the sheet sits above the keyboard.
- `inputMode="numeric"` / `decimal` on amounts; `search` + `autoCapitalize="characters"` on tickers (already on Assets).
- Avoid `focus:ring` layouts that jump the sticky header.

### 3.8 Loading / empty / error

- Keep existing `Skeleton` / pulse cards.
- Empty states already copy-driven (“All Caught Up”, “No Loans Active”) — keep CTAs.
- Offline banner stays global; do not add per-page offline screens.

### 3.9 Claymorphism

- Surfaces: `.clay`. Controls: `.clay-btn`. Fields: global inset inputs / `.clay-input-wrapper`.
- Do not flatten the tab bar to `backdrop-blur` + drop shadow (that regression already happened once).
- Do not use `shadow-lg` / `border-none` on `Card` (overrides clay edge).
- Sticky headers stay **flat/blur** (full-bleed clay bars look wrong). Interactive children stay `clay-btn`.

---

## 4. Components / layouts that need changes

### 4.1 Change (shared)

| File | Why | How without hurting desktop |
|------|-----|-----------------------------|
| `src/components/ui/Dialog.tsx` | Keyboard covers form fields | `visualViewport` padding; optional grabber; close `min-h-[44px] md:h-10` |
| `src/components/ui/Button.tsx` | 40px vs 44px | `min-h-[44px] md:h-[40px]` or `md:h-[40px] h-11` — test so desktop height does not grow |
| `src/components/ui/Tabs.tsx` | Short hit area; shared `layoutId` | `min-h-[44px] md:min-h-0`; unique `layoutId` per instance (prop) |
| `src/components/ui/MobilePageHeader.tsx` | Used everywhere | Optional right slot already exists; maybe `safe-area` if header ever goes `fixed` (today sticky in padded main — OK) |
| `src/components/PinSetupPrompt.tsx` | Centered modal | Reuse `Dialog` so it becomes a sheet on mobile |
| `src/components/LockScreen.tsx` | Home indicator | Safe-area padding |
| `src/routes/__root.tsx` | More hub is Settings; no extra tab | No nav item changes except labels if needed; Log Out stays desktop-sidebar-only **until** Settings gains it |
| `src/index.css` | Duplicate `!important` | Deduplicate **after** behavioral work; keep compact-input last |

### 4.2 Change (page-local, `md:hidden` / `max-md`)

| File | Changes |
|------|---------|
| `src/routes/goals.tsx` | Always-visible deposit/delete on mobile |
| `src/routes/transactions.tsx` | Date filter sheet; receipt remove; delete target; viewport scroll in form |
| `src/routes/index.tsx` | Larger Pay; metric density; optional Insights/Bills shortcut |
| `src/routes/settings.tsx` | Hub links, logout, currency write, profile chevron |
| `src/routes/insights.tsx` | Header, click tooltips, pill layout |
| `src/routes/bills.tsx` | Larger pause chip; ensure hub link |
| `src/routes/investments.tsx` | Taller tabs; search results inside sheet scroll |

### 4.3 Do not rewrite

- `src/lib/quickAddParser.ts`, `gemini.ts`, `accountUtils.ts`, `webauthn.ts`
- Supabase query shapes in each page
- Desktop sidebar / desktop page titles / desktop filter `<select>`s
- Hash router (required for GH Pages)
- Clay token values except bugfixes

### 4.4 Dead / confusing code (cleanup only after UX)

- Money `activeTab === 'budgets'` UI with no tab
- README claims (widget reorder, glassmorphism) that are not in the app
- Unused `public/icon-192x192.jpg` / `icon-512x512.jpg` if unused

---

## 5. PWA / installed-app improvements

Already present: standalone, portrait, maskable icon, `viewport-fit=cover`, translucent iOS status bar, autoUpdate SW, offline banner.

**Still do:**

1. **Launch URL vs hash** — `start_url: '/WealthMap/'` opens `/#/` (Home) after the app’s default hash. Verify installed iOS/Android always land on Home, not a stale `#/money`. If SW caches `index.html` without hash, this is OK.
2. **Password reset** — `resetPasswordForEmail({ redirectTo: origin + pathname })` has **no hash**. Confirm the recovery link still hits the SPA on GH Pages; if not, set `redirectTo` to `origin + '/WealthMap/'` (or `#/` ) explicitly.
3. **Theme-color vs app theme** — HTML `theme-color` follows `prefers-color-scheme`, not in-app light/dark/system. Optional: set `document.querySelector('meta[name=theme-color]')` when theme changes so the status bar matches clay chrome.
4. **Apple icons** — add `apple-touch-icon` pointing at `logo.png` or a 180×180 asset; `apple-mobile-web-app-title` already set.
5. **Splash** — iOS uses `apple-touch-icon` + `background_color`. `#0d1117` splash on a light-theme user is a flash; consider matching `--background` or document as known limitation.
6. **Offline** — do not promise offline ledger. Keep the banner. Optional later: cache app shell only (plugin already precaches build assets).
7. **Display** — keep `standalone`. Do not switch to `fullscreen` (hides iOS status bar badly with `black-translucent`).
8. **Safe areas** — shell top + nav bottom + dialog bottom exist. Audit LockScreen, ErrorBoundary, PinSetupPrompt, auth card.
9. **Standalone detect** — optional `display-mode: standalone` CSS to hide any leftover “browser” affordances (none today except the banner).

---

## 6. Detailed implementation tasks (correct order)

Work in thin vertical slices. Each task is mobile-gated. Stop if a change would alter desktop layout.

### Phase A — Shared chrome (unblocks every form)

| ID | Task | Files | Done when |
|----|------|--------|-----------|
| A1 | Dialog keyboard: `visualViewport` inset + focused field scroll-into-view | `Dialog.tsx` | Add-transaction sheet: last field visible above keyboard on iOS |
| A2 | Dialog close / confirm actions ≥44px on mobile only | `Dialog.tsx`, `ConfirmDialog.tsx` | |
| A3 | Tabs: `min-h-[44px]` below `md`; unique `layoutId` prop | `Tabs.tsx` | Assets + Bills tabs don’t steal each other’s pill |
| A4 | Button height 44px below `md` without changing `md` | `Button.tsx` | Desktop buttons still 40px |

### Phase B — Navigation completeness (nothing new, everything reachable)

| ID | Task | Files | Done when |
|----|------|--------|-----------|
| B1 | Settings hub rows: Bills, Insights (and keep existing accordions) | `settings.tsx` | Both routes open from More |
| B2 | Mobile Log Out in Settings | `settings.tsx` + small sign-out helper | Can sign out without desktop sidebar |
| B3 | Currency picker writing `user_settings.base_currency_id` | `settings.tsx` | Symbol updates on Dashboard after reload |
| B4 | Wire or remove Settings profile chevron | `settings.tsx` | Chevron not a fake control |
| B5 | Optional Home shortcuts to Bills / Insights | `index.tsx` | Nice-to-have after B1 |

### Phase C — Touch regressions (hover-only = missing features)

| ID | Task | Files | Done when |
|----|------|--------|-----------|
| C1 | Goal deposit + delete always visible on mobile | `goals.tsx` | Can deposit on a phone with no mouse |
| C2 | Receipt remove visible without hover | `transactions.tsx` | |
| C3 | Dashboard Pay + Money delete ≥44px on mobile | `index.tsx`, `transactions.tsx` | |
| C4 | Bills pause chip ≥44px on mobile | `bills.tsx` | |

### Phase D — Filters and dense layouts

| ID | Task | Files | Done when |
|----|------|--------|-----------|
| D1 | Money date filter as sheet on mobile; desktop select unchanged | `transactions.tsx` | Same options: all / week / month / year / custom |
| D2 | Dashboard 3-up metrics readable (no dropped stats) | `index.tsx` | |
| D3 | Insights: `MobilePageHeader`, click tooltips, readable pills | `insights.tsx` | |
| D4 | Assets tab bar height + search results scroll inside sheet | `investments.tsx` | |

### Phase E — Auth / lock / PWA polish

| ID | Task | Files | Done when |
|----|------|--------|-----------|
| E1 | LockScreen + ErrorBoundary + PinSetupPrompt safe areas; PinSetup uses Dialog | those components | |
| E2 | Auth card scrolls with keyboard | `__root.tsx` | |
| E3 | `apple-touch-icon`; theme-color sync optional | `index.html`, theme effect in `__root.tsx` | |
| E4 | Verify recovery `redirectTo` with hash + GH Pages base | `__root.tsx` | |

### Phase F — CSS hygiene (last, high regression risk)

| ID | Task | Files | Done when |
|----|------|--------|-----------|
| F1 | Deduplicate duplicated input/typography blocks; keep one 48px rule and one trailing compact-input override | `index.css` | Visual diff desktop + mobile |
| F2 | Kill dead Money budgets tab code **or** document why it stays | `transactions.tsx` | No behavior change |

**Explicitly out of order / out of scope unless requested:** new FAB, rewriting fetch to React Query, adding Bills/Insights to desktop sidebar, service-worker offline CRUD, changing hash → browser history, redesigning clay.

---

## 7. Testing plan

### 7.1 Devices and modes

- iPhone Safari (notch + home indicator), iPhone “Add to Home Screen” standalone
- Android Chrome + “Install app”
- Desktop Chrome **≥1280px** — visual regression: sidebar, header, filters, hover actions
- Narrow desktop resize across 768px — `md` must snap to desktop chrome, not a hybrid

### 7.2 Per-screen checks (mobile)

| Screen | Checks |
|--------|--------|
| Auth | Signup all fields, keyboard, login email/phone, forgot password |
| Lock | PIN, wrong PIN, biometric if enrolled, lock after 5 min background |
| Home | Greeting fits, filter sheet, bell, +, charts click tooltip, Pay, chips scroll |
| Money | Quick-add, camera (if Gemini), CSV, search, date sheet, custom range, add/edit transfer, receipt add/remove, `?add=1` |
| Goals | Add goal/loan, **deposit**, delete, Pay EMI |
| Bills | Upcoming/Paid, Pay rollover, pause, edit, add |
| Assets | All three tabs, add stock/MF/search, SIP fields, hide account, payoff, physical asset |
| Settings | Every accordion, budgets ±50, PIN, bio, password, **logout**, **currency**, Bills/Insights links |
| Insights | Month toggle, all charts, budgets |

### 7.3 Cross-cutting

- No feature present on desktop is missing on mobile (except sidebar-only chrome that has a mobile equivalent: theme, logout).
- Tab bar never covers list last row or sheet CTAs.
- Keyboard never covers the focused input or the sheet primary button.
- `overscroll` does not reveal white browser chrome in standalone.
- Offline banner shows; app still opens from cache; writes may fail — error toasts OK.
- Clay: cards look extruded, inputs inset, tab bar not a floating drop-shadow card.

### 7.4 Desktop guardrail

For every PR: screenshot or click-through Home, Money, Goals, Assets, Settings at `md`+. Confirm sidebar Log Out, header bell, Dashboard `<select>` filter, hover-to-reveal on goals if left as `md:group-hover`.

### 7.5 PWA

- Install from GH Pages `/WealthMap/`
- `start_url` lands on Home
- Maskable icon on Android
- Status bar readable in light and dark
- `orientation: portrait` on phone

---

## 8. Risks and open questions

### 8.1 Risks

| Risk | Why it matters | Mitigation |
|------|----------------|------------|
| Shared `Dialog` / `Button` / `Tabs` | Desktop uses the same components | Gate sizes with `md:`; visual-test desktop |
| `index.css` `!important` | Mobile overrides silently fail | Put mobile overrides at file end; prefer Phase F after UX |
| Hash router + PWA + password reset | Recovery and install URL ignore `#/path` | Test E4; keep `start_url` at app root |
| Five-tab limit | Bills/Insights easy to “forget” | Settings hub is mandatory (Phase B) |
| Hover-only actions | Looks like the feature was removed | Phase C before polish |
| Keyboard + 92vh sheet | Users cannot submit add-transaction | Phase A first |
| Clay `overflow-hidden` on `Card` | Soft shadows clip | Don’t add more `overflow-hidden` wrappers; optional later clip fix |
| PIN is local-only | Not a security boundary for the API | Don’t market as bank-grade; keep as privacy lock |
| React Query unused | Temptation to rewrite fetch | Don’t; stay with page `useEffect`s |
| README vs code | Widget layout, glass, currency UI | Trust the repo |
| Duplicate CSS | Compact-input vs 48px height | Never insert new global `input { height }` after the compact rules |

### 8.2 Open questions (product, not guessed)

1. **Should desktop also link Insights and Bills in the sidebar?** Mobile hub does not require that; adding sidebar items **would** change desktop. Default: **no**.
2. **Notifications on every tab vs Home only?** Extra chrome vs discoverability. Default: Home only unless users miss it.
3. **Currency picker:** data model exists; UI does not. Confirm changing `base_currency_id` is intended for all users (symbol-only vs conversion — code uses symbol, not FX).
4. **Dead Money budgets tab:** delete vs restore. Default: delete dead branch; Settings is source of truth.
5. **Insights vs Dashboard charts overlap.** Insights stays; don’t merge pages.
6. **iOS splash vs light theme** flash (`background_color: #0d1117`). Accept vs sync to theme.
7. **`PinSetupPrompt` timing** on every Dashboard visit until dismissed — already productized; don’t move unless annoying on mobile.
8. **Gemini / Scan Bill** depends on edge function / env; if disabled, camera control already gated by `isGeminiConfigured()` — keep that gate.

### 8.3 Unclear / verify during implementation

- Exact `logo.png` pixel size vs manifest `192`/`512` claims (same file listed twice).
- Whether `public/logo.png` vs `index.html` `/logo.png` resolves correctly under `base: '/WealthMap/'` in production.
- Whether Insights is intentionally hidden (alpha) — still must be reachable if the route ships.
- `Card` hover `-translate-y-[2px]` on a touch device (harmless; no hover).

---

## Implementation principles (repeat)

1. **Desktop unchanged** — `hidden md:*` / `md:hidden` / max-width 767 media.
2. **No hidden features** — hover menus get visible mobile controls; orphan routes get a More-hub link.
3. **Mobile-specific UI** — sheets, 44px targets, sticky headers, hub — not scaled-down sidebar.
4. **No logic forks** — same `handlePay`, `handleQuickAdd`, Supabase calls.
5. **Clay stays.**
6. **This file is the spec.** Implement in Phase A→F order; do not start a parallel redesign.

---

## 9. Functional / data-integrity audit (balances, transfers, crons)

**Status:** audit only — document issues and needed improvements. **Do not implement from this section until explicitly requested.**  
**Scope:** “update X when Y happens” wiring across client handlers and Supabase edge functions.  
**Date of audit:** 2026-08-15 (against current `src/` + `supabase/functions/`).

SQL trigger definitions are **not versioned in this repo** (only ad-hoc scripts under `scratch/` / `*.js`). They **do exist on the live Supabase DB** (queried 2026-08-15). UI copy that says balances are “live from transactions” is misleading: the app stub-reads `accounts.balance`, while **two overlapping AFTER INSERT/UPDATE/DELETE triggers** mutate that column.

**Live triggers on `public.transactions` (problem):**

| Trigger | Function | Handles |
|---------|----------|---------|
| `on_transaction_logged` | `handle_transaction_balance_sync()` | Income + expense only (no transfers) |
| `trigger_update_account_balance` | `update_account_balance_on_transaction()` | Income + expense + transfer/adjustment |

Both fire on every income/expense write → **balances can be applied twice**. Transfers are only handled by the second function (and only when `transfer_to_account_id` is set; null destination = “adjustment” = add amount to source). Also: `notify_on_goal_added` on `goals` INSERT (unrelated to cash).

**Standard method (recommended):** keep **one** balance sync path — prefer the fuller `update_account_balance_on_transaction` (Option B) **or** drop all balance triggers and finish Option A in `computeAccountBalances`. Never both. Version the chosen SQL in-repo.

---

### 9.1 Root cause: `computeAccountBalances` is a stub

**File:** `src/lib/accountUtils.ts`

| Documented (comments) | Actual code |
|------------------------|-------------|
| `computed_balance = opening_balance + income − expense − transfer_out + transfer_in` | Ignores `_transactions`; copies `accounts.balance` into both `opening_balance` and `computed_balance` |

**Consumers (all show stale `accounts.balance`):**

- Dashboard cash / credit usage — `src/routes/index.tsx`
- Assets → Bank & Cash tab — `src/routes/investments.tsx`
- Anywhere else that imports `computeAccountBalances` / `totalLiquidBalance`

**Why transfers “don’t deduct / don’t add”:** saving a transfer only inserts a `transactions` row (`account_id` + `transfer_to_account_id`). Neither account’s `balance` is updated, and live recompute is not implemented — so both sides look unchanged (or only change if something else wrote `accounts.balance` manually).

**Recommended fix direction (pick one, then apply everywhere):**

1. **Option A (preferred, matches comments):** Implement real ledger math in `computeAccountBalances`; treat `accounts.balance` as **opening** (or add a real `opening_balance` column and stop mutating `balance` for day-to-day activity). Display always uses `computed_balance`.
2. **Option B:** On every income/expense/transfer/payoff/SIP/bill/EMI/investment buy, **atomically** adjust `accounts.balance` (and reverse on edit/delete). Risk: double-counting if Option A is later half-enabled.

Until one model is chosen and finished, **do not** mix “patch balance in some flows” with “compute from txs in others.”

---

### 9.2 Critical issues (user-visible money wrong)

| ID | Area | Where | Expected | Actual | Improvement needed |
|----|------|--------|----------|--------|-------------------|
| F1 | **Transfers** | `transactions.tsx` `handleSave` | From account −amount; to account +amount (via ledger or balance deltas) | Single row insert/update only; no balance effect; stub compute ignores row | Implement Option A (transfer_out / transfer_in) **or** Option B dual balance update; validate from ≠ to; block empty `transfer_to_account_id` |
| F2 | **CC Pay Off** | `investments.tsx` `handlePayoffSubmit` | Debit funding bank; reduce CC usage; ledger entry linking both | Only `accounts.balance` on the **CC** row; **no** funding account picker; **no** transaction | Add “pay from” account; insert transfer (or expense+adjustment) + update both sides consistently with F1 model; never leave orphan balance patches |
| F3 | **Displayed balances lie** | `accountUtils.ts` + UI copy on Assets Bank tab | Live from transactions | Stub + copy claims live history | Finish Option A; update/remove misleading empty-state copy |
| F4 | **Buy investment / asset** | `investments.tsx` `handleSave` (investments + physical assets) | Holding ↑ and cash ↓ (or explicit “already owned / no cash move”) | Quantity/value only; **no** cash debit transaction | On create (and qty increase), optional funding account + expense/transfer; avoid double-counting NW (cash still in bank + new holding) |
| F5 | **Net worth history cron cash** | `supabase/functions/networth-cron/index.ts` | Cash = same definition as dashboard | Sums raw `accounts.balance`, excludes CC only by type; **no loans**; investments use `user_id` while accounts/assets/txs use `created_by` | Align NW formula with app (cash computed, − loans, − CC debt); unify user key; include liabilities |

---

### 9.3 High issues (partial / wrong side effects)

| ID | Area | Where | Problem | Improvement needed |
|----|------|--------|---------|-------------------|
| F6 | **Bill pay** | `bills.tsx` `handlePay` | Expense always on `accounts[0]`, not bill’s `account_id`; category hard-coded utilities; `is_recurring: true` on the logged tx (smells like cron fodder); UI says funding reduces checking but balance only moves if ledger works | Use bill `account_id` (fallback picker); map bill type → category; `is_recurring: false` unless intentional template; rely on F1/F3 model |
| F7 | **Goal deposit** | `goals.tsx` `handleDeposit` | Updates `goals.current_amount`; inserts **transfer**-typed tx with **no** `transfer_to_account_id`, always `accounts[0]`, wrong `category_id` (health) | Treat as expense/transfer-out from chosen account (or dedicated “Goals” pot account); no fake category on transfers; account picker |
| F8 | **Loan EMI** | `goals.tsx` `handlePayEmi` | Reduces `outstanding_amount` + expense on `accounts[0]`; **does not** decrement `remaining_emis`; no account picker | Update `remaining_emis`; account picker; optional interest split later |
| F9 | **Edit / delete transactions** | `transactions.tsx` | Delete is hard `.delete()`; edit overwrites row only | Soft-delete (`is_deleted`) to match other entities + crons; if Option B, reverse prior balance effect before apply; if Option A, recompute is enough **after** stub is fixed |
| F10 | **Manual tx ownership** | `transactions.tsx` `handleSave` | Gemini paths set `created_by`; normal save payload often **omits** it | Always set `created_by` (and/or rely on DB default/trigger); required for RLS and `networth-cron` filters on `created_by` |
| F11 | **SIP cron vs cash** | `process-sips/index.ts` | Inserts expense + bumps `investments.quantity`; does **not** update `accounts.balance`; UI balances still stubbed | After F3, expense alone is enough; until then SIP “works” in holdings but not cash. Also: cron uses UTC `getDate()` vs user timezone; `user_id` on insert vs app `created_by`; no idempotency (re-run = double buy) |
| F12 | **Recurring cron** | `process-recurring-transactions/index.ts` | Clones due templates; same ownership / balance / idempotency risks; no skip if soft-deleted parent | Filter `is_deleted`; set `created_by`; idempotent per `(parent_id, due_date)`; align column names with live schema |

---

### 9.4 Medium / structural gaps

| ID | Topic | Detail | Improvement |
|----|--------|--------|-------------|
| F13 | **Duplicate live balance triggers** | Two AFTER triggers both adjust `accounts.balance` on income/expense | Drop `on_transaction_logged` / `handle_transaction_balance_sync`; keep one standard function; add SQL to repo; one-time reconcile balances |
| F14 | **Credit card sign convention** | Mock seed uses **negative** CC balance; Pay Off / edit form treat usage as **positive** | Document one convention (e.g. CC `balance` = amount owed ≥ 0) and use it in compute, payoff, and NW |
| F15 | **Account edit “opening balance”** | Form writes `accounts.balance` while claiming past txs preserved | Under Option A this **is** opening; under stub it silently resets displayed cash. Label + field must match chosen model |
| F16 | **`finance` edge function** | Yahoo search/quote proxy only — not a money trigger | Keep; not a balance bug. Monitor Yahoo/MF API failures for live prices / SIP NAV |
| F17 | **Cron scheduling not in repo** | No `config.toml` / cron definitions checked in | Document required schedules (SIP daily, recurring daily, NW daily) in Supabase dashboard or add config; add alerting on `automation_logs` failures |
| F18 | **SIP day edge cases** | `sip_date` = 29–31 skips short months | Use “last day of month if needed” or clamp |
| F19 | **Bill pay creates next bill** | Recurring path inserts next row OK | Also ensure paid bill doesn’t stay in “due” lists; verify status seed IDs |
| F20 | **Dashboard NW vs Assets NW** | Both depend on stub cash + live investment prices; loans may be missing from headline NW | Single `getNetWorth(user)` helper used by dashboard, assets header, and cron |
| F21 | **Export CSV** | Transfers labeled poorly (income vs spend only) | Include Transfer type and destination account |
| F22 | **Notifications from crons** | Use `user_id`; bell may filter differently | Align notification user column with insert paths |

---

### 9.5 Edge-function inventory

| Function | Role | Trigger model | Money side effects today | Gaps |
|----------|------|---------------|---------------------------|------|
| `finance` | Yahoo search/quote | Invoked from UI | None | External API fragility |
| `process-sips` | Monthly SIP buy | Cron (assumed) | Expense tx + qty↑; **no** balance column update | Timezone, idempotency, `user_id` vs `created_by`, cash visibility (F3/F11) |
| `process-recurring-transactions` | Clone due recurring txs | Cron (assumed) | Insert child txs only | Idempotency, deleted parents, ownership column, balance model |
| `networth-cron` | Snapshot NW / income / spent | Cron (assumed) | Writes `networth_history` | Stale cash, no liabilities, user-id inconsistency (F5) |

**Missing automations (not in repo, often expected by users):**

- Auto-mark overdue bills
- Auto EMI reminders / auto-pay (beyond manual Pay EMI)
- Price refresh cron for investments (UI fetches on demand via `finance`)
- Reconciliation job: `accounts.balance` vs ledger recompute drift report

---

### 9.6 Suggested fix order (when implementing)

1. **Decide Option A vs B** and write it once in `accountUtils` (and optional DB RPC).
2. **F1 transfers** + **F3 display** — unblocks “money moved” perception everywhere.
3. **F2 CC payoff** with funding account + ledger row.
4. **F6–F8** bills / goals / EMI — correct account + remaining_emis + clean tx flags.
5. **F4** investment/asset purchases — optional cash link to stop NW double-count.
6. **F9–F10** edit/delete + `created_by`.
7. **F11–F12–F5** harden edge functions (idempotency, timezone, same NW formula).
8. **F13–F17** triggers/config/convention cleanup.

---

### 9.7 Manual test checklist (after fixes)

- [ ] Transfer A→B: A down, B up by same amount; dashboard cash unchanged (internal move).
- [ ] Income / expense on account A: cash moves; CC expense increases CC usage only.
- [ ] CC payoff from bank: bank down, CC usage down; appears in Money feed.
- [ ] Bill pay: correct account, category, next recurring bill, cash down.
- [ ] Goal deposit: goal ↑, chosen account ↓.
- [ ] EMI: outstanding ↓, remaining_emis ↓, account ↓.
- [ ] Add stock/MF with funding: holding ↑, cash ↓; NW not double-counted.
- [ ] Edit/delete transfer: balances restore correctly.
- [ ] SIP cron dry-run once: one expense, one qty bump, no duplicate on re-run.
- [ ] Recurring cron: one child per due date; parent `next_recurring_date` advances.
- [ ] Networth cron: matches dashboard NW for same user/day.

---

### 9.8 Out of scope for this audit

- Mobile UI Phases A–F (separate; largely implemented).
- FX conversion (currency is symbol-only today).
- Multi-user shared households.
)

