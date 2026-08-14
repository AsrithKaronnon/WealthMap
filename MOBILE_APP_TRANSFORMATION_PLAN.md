# WealthMap — Mobile App Transformation Plan

> **Scope:** Mobile-only improvements. Desktop experience must remain exactly as-is.
> **Constraint:** No duplication of business logic. No hidden features on mobile.
> **Tech stack:** React + TailwindCSS v4 + Framer Motion + TanStack Router.

---

## 1. Current App Analysis

### Architecture

| Layer | Details |
|---|---|
| Router | TanStack Router — `__root.tsx` is the shell with sidebar (desktop) and bottom-nav (mobile) |
| State | Local useState per page — no global store |
| Styling | Tailwind v4 with custom CSS design tokens, Claymorphism theme |
| PWA | Vite-PWA, `display: standalone`, autoUpdate, single 512x512 icon |
| Animations | Framer Motion for page transitions and dialog slide-up |
| Charts | Recharts |
| Auth | Supabase Auth — guarded in root layout |

### Pages / Routes

| Route | File | Complexity |
|---|---|---|
| `/` | `index.tsx` | High — net worth cards, donut chart, line chart, activity feed |
| `/money` | `transactions.tsx` | Very High — quick-add AI bar, camera scan, filters, grouped list, full form modal |
| `/goals` | `goals.tsx` | High — goals + loans, progress circles, deposit/EMI modals |
| `/investments` | `investments.tsx` | Very High — 4 tabs, net worth banner, account cards, investments, physical assets |
| `/bills` | `bills.tsx` | Medium — upcoming/paid tabs, pay modal |
| `/insights` | `insights.tsx` | Medium — charts, budget bars (not in nav — accessed internally) |
| `/settings` | `settings.tsx` | Medium — accordion sections, profile, password, currency, biometrics, budgets |

### What Already Works on Mobile

- Bottom navigation bar exists (`md:hidden` floating pill at bottom-4)
- Header in `__root.tsx` hidden on mobile, replaced by in-page mobile header on Dashboard
- Page transitions work (Framer Motion)
- Dialog already slides up from bottom on mobile (`items-end` on small screens)
- Inputs have 48px height, claymorphism styling
- Content area has `pb-[80px]` to clear bottom nav
- Auth screen is already responsive

### Critical Problems on Mobile

1. **No safe area insets** — iPhones with home bar clip content behind home indicator
2. **Dashboard filter icon does nothing visually** — it is a hidden `<select>` overlay hack, hard to tap on small screens
3. **Transactions form modal** is extremely long (~10 fields) and keyboard overlaps Submit button
4. **Investments page net worth banner** mini-tiles overflow on 360px screens; text-[9px] is below readable threshold
5. **Goals/Loans page** has assumptions that break on narrow phones
6. **Settings page** has +$50/-$50 budget text buttons that are too small for touch
7. **No mobile sticky page header** on most pages — users lose context when scrolling
8. **Charts not touch-optimised** — tooltips rely on hover, not tap
9. **PWA manifest issues**: single icon marked `maskable` only; `theme_color: #000000` wrong; missing `start_url`, `orientation`, `display_override`
10. **`index.html` missing** `viewport-fit=cover` and Apple PWA meta tags
11. **No `-webkit-tap-highlight-color: transparent`** — shows blue flash on tap
12. **No `-webkit-overflow-scrolling: touch`** hints on scroll containers
13. **Global CSS `input { height: 48px !important }`** causes issues in compact inline filters
14. **`page-title` CSS forces `white-space: nowrap`** which truncates page titles on small screens

---

## 2. Screen-by-Screen Mobile Plan

### 2.1 Auth Screen (`__root.tsx` — unauthenticated)

**Current:** Renders a centred card with max-w-sm. Already looks good on mobile.

**Improvements:**
- Add `autocomplete` attributes to all form inputs for autofill
- Add `overflow-y-auto` so card scrolls when keyboard appears
- Add password show/hide toggle
- Add `pb-[env(safe-area-inset-bottom)]` to prevent keyboard clipping

---

### 2.2 Root Shell / Navigation (`__root.tsx` — authenticated)

**Current bottom nav problems:**
- Fixed at `bottom-4` with no safe area handling — clips behind iPhone home bar
- Active state is colour-only — no visual indicator
- No tap feedback (no `:active` state)
- Label shortening uses a hacky `.split(' ')` on "My Money" and "Goals & Loans"

**Mobile Plan:**
```
┌────────────────────────────────────┐
│  Home   Money   Goals  Assets  ⚙️   │  <- flush bottom with safe area
│    ●                                │  <- active dot indicator
└────────────────────────────────────┘
```

Changes:
- Change `bottom-4 left-4 right-4` → `bottom-0 left-0 right-0`, add `rounded-t-[2rem]` (round top only)
- Add `pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+8px)]` inside nav
- Add active dot indicator under active nav icon
- Add `active:scale-95` tap feedback to each nav item
- Add `-webkit-tap-highlight-color: transparent` globally

**Desktop:** No changes whatsoever.

---

### 2.3 Dashboard — `/` (`index.tsx`)

**Current mobile layout:** Greeting header with filter + bell, Net Worth card, 3-col stat grid, Credit Card usage row, 2 charts stacked, Goals/Loans horizontal scroll, Activity feed.

**Issues:**
- Time filter is an invisible `<select>` overlay — opaque and unreliable on touch
- Area chart on Net Worth card can overlap text on very narrow screens
- Charts require hover for tooltips

**Mobile Plan:**
- **Filter**: Replace the hidden-select hack with a proper `<button>` that opens an action-sheet / native `<select>` styled as a pill with visible feedback
- **Net Worth card**: Verify `z-20` on text, `z-0` on chart. Cap chart at 70% card height on mobile
- **Charts**: Use Recharts `Tooltip trigger="click"` so tooltips show on tap
- **Activity feed rows**: Ensure minimum 44px height touch targets
- **Goals/Loans scroll**: Add `-webkit-overflow-scrolling: touch` and a fade edge gradient to hint scrollability

---

### 2.4 Transactions — `/money` (`transactions.tsx`)

**Issues:**
- Transaction Add/Edit modal has ~10 fields. When keyboard opens, Submit button is unreachable
- Export CSV download button is a tiny 36×36 icon — hard to tap
- Quick-Add AI bar logic (`handleQuickAdd`, `quickAddVal`) exists but appears missing from rendered JSX — needs verification

**Mobile Plan:**
- **Download button**: On mobile, hide from inline header. Move to a kebab `...` menu or inside Settings
- **Modal fields**: Group into 2-col grids on mobile (type+amount, category+date). Add `inputmode="numeric"` to amount field. Ensure inner div has `overflow-y-auto flex-1` so form scrolls with keyboard open
- **Quick-Add bar (T21 below)**: If missing from JSX, restore as a sticky bar above transaction list

---

### 2.5 Goals & Loans — `/goals` (`goals.tsx`)

**Issues:** Modal forms have many fields; keyboard-overlap same as transactions. Progress circle text tiny at size=34.

**Mobile Plan:**
- Apply same modal keyboard-safe fix as transactions
- Ensure all action button tap targets ≥ 44px
- Deposit modal (1 field) is already fine

---

### 2.6 Assets — `/investments` (`investments.tsx`)

**Issues:**
- Net Worth banner mini-tiles (Bank & Cash, Credit Card, Stocks & MF, Other Assets) all in one flex row — overflows on phones < 360px, text-[9px] is illegible
- Account cards in Liquid tab are cramped on narrow screens
- Large modals have keyboard-overlap problem

**Mobile Plan:**
- **Net Worth banner tiles**: Wrap to 2×2 grid on mobile — `grid-cols-2 sm:flex` on the tile container
- **Account cards**: Tighten layout. Ensure Pay Off button is readable
- **Modals**: Same keyboard-safe fix as transactions
- **Add Investment modal**: Add `inputmode="search"` and `autocapitalize="characters"` to symbol search input

---

### 2.7 Bills — `/bills` (`bills.tsx`)

**Issues:** Bill cards show date, amount, type badge, Pay/Edit/Delete in a single flex row — cramped on mobile.

**Mobile Plan:**
- Restructure bill cards to 2-row mobile layout: name+date on top, amount+actions on bottom
- Use `flex flex-col sm:flex-row` on card content
- Ensure mark-as-paid button meets 44px minimum

---

### 2.8 Settings — `/settings` (`settings.tsx`)

**Issues:**
- Budget +$50/-$50 text buttons are too small for touch
- `autocomplete` attributes missing from all form inputs

**Mobile Plan:**
- Replace `+$50`/`-$50` text buttons with proper icon buttons with `p-2` padding
- Add `autocomplete` attributes: `given-name`, `family-name`, `tel`, `new-password`, `current-password`
- Accordion structure works well on mobile — no structural changes needed

---

## 3. Recommended Mobile Navigation Approach

### Bottom Navigation (already exists, needs polish)

```
Current:  bottom-4 left-4 right-4  (floating, 16px margins on all sides)
Proposed: bottom-0 left-0 right-0  (flush to bottom edge)
          Rounded: rounded-t-[2rem]  (top corners rounded only)
          Inner padding: pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+8px)]
```

### Floating Action Button (FAB)

Add a prominent `+` FAB button above the bottom nav. On any page, tapping it opens the Add Transaction modal:

```
┌─────────────────────────────────────────┐
│                 main content            │
│                          [+]  <- FAB    │  <- 56x56, fixed above nav
├─────────────────────────────────────────┤
│  Home  Money  Goals  Assets  Settings   │  <- nav, flush bottom + safe area
└─────────────────────────────────────────┘
```

Implementation: Use URL approach — navigate to `/money?add=1`, transactions page reads query param and auto-opens modal. This avoids lifting state into root.

### Mobile Page Headers

Add a lightweight sticky header visible only on mobile (`md:hidden`) at the top of each page's render JSX:

```
Transactions    [+]  [Export]
Goals & Loans   [+]
Assets          [+]
Bills           [+]
Settings
```

---

## 4. Components / Layouts That Need Changes

### 4.1 `Dialog.tsx` — Keyboard-Safe

Current: slides up from bottom. Missing: keyboard avoidance.

**Fix:** Add `pb-[env(safe-area-inset-bottom,16px)]` to the dialog outer container. Ensure the inner body div (`<div className="p-6 overflow-y-auto flex-1">`) already has `overflow-y-auto` — it does. Also add `overscroll-contain` to prevent scroll chaining.

### 4.2 `__root.tsx` — Safe Area Padding

- Main content `pb-[80px]` → `pb-[calc(80px+env(safe-area-inset-bottom,0px))]`
- Bottom nav: flush to bottom, internal safe area padding

### 4.3 `index.html` — PWA Meta Tags

```html
<!-- Change -->
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- To -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">

<!-- Add -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="WealthMap">
<meta name="theme-color" content="#0d1117" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#f5f7fa" media="(prefers-color-scheme: light)">
```

### 4.4 `vite.config.ts` — PWA Manifest

```ts
manifest: {
  name: 'WealthMap',
  short_name: 'WealthMap',
  description: 'Modern Personal Finance Tracker',
  start_url: '/WealthMap/',
  orientation: 'portrait',
  display: 'standalone',
  display_override: ['standalone', 'minimal-ui'],
  theme_color: '#0d1117',
  background_color: '#0d1117',
  icons: [
    { src: 'logo.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'logo.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
  ]
}
```

### 4.5 `index.css` — Touch and Safe Area Fixes

```css
body {
  overscroll-behavior: none;  /* prevents rubber-band revealing browser chrome */
}

/* Tap highlight fix */
a, button, [role="button"] {
  -webkit-tap-highlight-color: transparent;
}

/* Touch scrolling on iOS */
.overflow-y-auto, .overflow-x-auto {
  -webkit-overflow-scrolling: touch;
}
```

### 4.6 `Tabs.tsx` — Overflow Scroll

The Tabs component (used in bills, investments, transactions) should support `overflow-x-auto` with hidden scrollbar when tabs overflow screen width.

---

## 5. PWA / Mobile-App Improvements

### 5.1 Installed-App Behaviour

- `viewport-fit=cover` + `apple-mobile-web-app-status-bar-style: black-translucent` makes status bar transparent with content under it (safe-area-inset-top compensates layout)
- `overscroll-behavior: none` prevents rubber-band revealing browser chrome
- `background_color` should match the actual app background colour (currently `#000000` which is wrong)

### 5.2 Offline Behaviour

VitePWA with `generateSW` is configured but no offline fallback UI exists. Supabase calls fail silently when offline.

**Add:** `navigator.onLine` event listener in `__root.tsx`, display a toast banner "You're offline — data may not be current" when offline.

### 5.3 App Icon

Currently one icon file (`logo.png` 512x512, marked `any maskable`). Maskable icons need 20% safe zone padding — if logo doesn't have it, it clips on some Android launchers.

**Action:** Generate separate `any` and `maskable` variants with proper padding.

---

## 6. Detailed Implementation Tasks (Ordered)

Tasks ordered from foundational to enhancement. Do Phase 1 before anything else.

### Phase 1: Foundation — Safe Areas & PWA

- [ ] **T1**: Update `index.html` — add `viewport-fit=cover` to viewport meta, add Apple PWA meta tags, add `theme-color` meta with dark/light media queries
- [ ] **T2**: Update `vite.config.ts` — fix manifest: add `start_url`, `orientation`, `display_override`, correct `theme_color` and `background_color`, add separate `any` and `maskable` icon entries
- [ ] **T3**: Update `index.css` — add `overscroll-behavior: none` to body; add `-webkit-tap-highlight-color: transparent` to buttons/links; add `-webkit-overflow-scrolling: touch` to scroll containers
- [ ] **T4**: Update `__root.tsx` — change main content `pb-[80px]` to `pb-[calc(80px+env(safe-area-inset-bottom,0px))]`
- [ ] **T5**: Update bottom nav in `__root.tsx` — change `bottom-4 left-4 right-4` to `bottom-0 left-0 right-0 rounded-t-[2rem]`, add safe-area padding inside nav, add active dot indicator, add `active:scale-95` tap feedback

### Phase 2: Dialog / Modal Keyboard Safety

- [ ] **T6**: Update `Dialog.tsx` — add `pb-[env(safe-area-inset-bottom,16px)]` to dialog outer container, add `overscroll-contain` to inner scrollable body
- [ ] **T7**: Update `transactions.tsx` form — add `inputmode="numeric"` to amount field; on mobile group type+amount and category+date as 2-col grids to reduce modal height
- [ ] **T8**: Apply same keyboard-safe modal fixes to `goals.tsx` (Add Goal, Add Loan modals), `bills.tsx` (Add Bill modal), `investments.tsx` (Account modal, Payoff modal)

### Phase 3: Navigation Enhancement

- [ ] **T9**: Add active indicator to bottom nav tabs (coloured dot or filled background pill under active icon)
- [ ] **T10**: Add floating `+` FAB button above bottom nav in `__root.tsx`. On tap, navigate to `/money?add=1`. In `transactions.tsx`, check for `add=1` query param and auto-open the Add Transaction modal
- [ ] **T11**: Add lightweight sticky mobile page headers (`md:hidden`) to the top of: `transactions.tsx`, `goals.tsx`, `investments.tsx`, `bills.tsx`, `settings.tsx`

### Phase 4: Dashboard Improvements

- [ ] **T12**: Replace Dashboard time filter hidden-select hack with a proper `<button>` that has visible label and opens a bottom sheet or styled `<select>` on mobile
- [ ] **T13**: Verify and fix Net Worth card chart z-index / overflow on narrow screens (< 375px)
- [ ] **T14**: Add touch-friendly chart tooltips — Recharts `Tooltip` with `trigger="click"` or custom tap handler for mobile
- [ ] **T15**: Ensure goals/loans horizontal scroll strip has `-webkit-overflow-scrolling: touch` and a fade-out gradient on the right edge

### Phase 5: Bills Page Restructure

- [ ] **T16**: Restructure bill cards — `flex flex-col sm:flex-row` on card content; name+badge+date on top row, amount+actions on bottom row on mobile only

### Phase 6: Assets Page Mobile Polish

- [ ] **T17**: Net Worth banner mini-tiles — change tile container from `flex flex-row` to `grid grid-cols-2 sm:flex sm:flex-row` on mobile so tiles wrap instead of overflow
- [ ] **T18**: Audit all action buttons in the Liquid tab account cards for 44px minimum touch target

### Phase 7: Settings Page Polish

- [ ] **T19**: Replace `+$50`/`-$50` text buttons in budget section with `<button>` elements with `p-2 min-h-[44px]` padding and `Minus`/`Plus` icons
- [ ] **T20**: Add `autocomplete` attributes to all form inputs in Settings (profile: `given-name`, `family-name`, `tel`; password: `current-password`, `new-password`)

### Phase 8: Transactions Quick-Add

- [ ] **T21**: Audit whether the AI quick-add bar (`handleQuickAdd`, `quickAddVal`) is rendered in the `/money` page JSX (currently appears absent from rendered JSX starting at line 578). If missing, restore as a sticky bar at the top of the transaction list with a text input and camera button.

### Phase 9: Offline Support

- [ ] **T22**: Add `navigator.onLine` listener in `__root.tsx`. Show a dismissable banner toast "You are offline — data may not be current" when offline, and "Back online" when reconnected.

---

## 7. Testing Plan

### Devices to Test

| Device | Width | Why |
|---|---|---|
| iPhone SE | 375px | Smallest modern iPhone, no notch |
| iPhone 14 Pro | 393px | Dynamic Island + home indicator |
| Samsung Galaxy S21 | 360px | Common Android width |
| iPad (any) | 768px | Should behave like desktop |

### Per-Page Manual Checklist

For each page after changes:
- [ ] Page title/header visible after scrolling (sticky header exists)
- [ ] All buttons are minimum 44px touch target
- [ ] No horizontal overflow (check with DevTools)
- [ ] Keyboard does not obscure active input or Submit button
- [ ] Bottom nav is not clipped by home indicator on iPhone
- [ ] Dialogs slide up correctly and close on backdrop tap
- [ ] Charts show tooltip on tap (not just hover)
- [ ] Page transitions are smooth (60fps, no jank)

### PWA Install Testing

- [ ] Install from Chrome on Android — icon on home screen, correct shape (not clipped)
- [ ] Install from Safari on iPhone — no address bar in standalone mode, correct status bar styling
- [ ] Offline test: disable WiFi — app loads from cache, offline banner shows
- [ ] Update test: deploy a code change, reopen app — update applies

### Automated Tools

- Chrome DevTools Device Mode at 375px for all development
- Lighthouse PWA audit → target 100 on PWA section
- `npx lighthouse https://yourdomain.com/WealthMap/ --view`

---

## 8. Risks and Open Questions

### Risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | `input { height: 48px !important }` conflicts with compact inline filter elements | Medium | Add `.compact-input { height: auto !important; }` override class |
| R2 | Recharts `trigger="click"` tooltips may interfere with tap-to-navigate | Low | Test per chart. Fall back to static label if broken |
| R3 | FAB Add Transaction from any page requires coupling with `/money` route | Medium | Use URL query param approach (`/money?add=1`) to avoid state lifting |
| R4 | Framer Motion + keyboard slide-up simultaneously = layout jank on low-end Android | Low | Wrap transitions in `prefers-reduced-motion` check |
| R5 | `env(safe-area-inset-bottom)` returns `0` on older devices — verify no excess padding | Low | Use `max(8px, env(safe-area-inset-bottom))` as fallback |
| R6 | Logo.png may not have 20% safe zone for maskable PWA icon | Medium | Regenerate maskable icon variant with proper safe zone |
| R7 | Bills.tsx budget amount uses hardcoded `$` instead of `currencySymbol` | Low | Fix as part of T19 |

### Open Questions

**Q1: Quick-Add bar** — Is the AI quick-add bar (`quickAddVal`, `handleQuickAdd`) intentionally hidden from the `/money` page JSX, or was it accidentally removed? The handlers exist but the UI element appears missing from the rendered JSX starting at line 578. Clarify before T21.

**Q2: FAB approach** — Should the FAB navigate to `/money` and auto-open the modal (URL approach), or should the transaction form be lifted into the root shell? URL approach is simpler but involves navigation. Confirm preference.

**Q3: Bills in bottom nav** — Bills is not in `navigationItems` (5 tabs: Home, Money, Goals, Assets, Settings). Should Bills be accessible from the mobile bottom nav? Adding it would make 6 tabs — too many. Options: keep Bills accessed only from Dashboard activity feed; OR replace Settings with Bills in the nav (Settings accessible from profile icon).

**Q4: Insights page** — `insights.tsx` exists but is not in `navigationItems`. How is it currently accessed on mobile? Should it be reachable without going through a specific page? Clarify.

**Q5: Clay shadow performance** — The claymorphism box-shadow is GPU-expensive with 4 layers. On low-end Android this may cause scroll jank. Should there be a reduced-motion / low-power mode? Enhancement — not blocking.

**Q6: Lock Screen** — `LockScreen.tsx` and `PinSetupPrompt.tsx` exist. When exactly does the lock screen appear on a PWA installed on iOS/Android? Does it trigger on app foreground/resume? This needs specific PWA lifecycle testing.

---

## Summary Priority Matrix

| Priority | Tasks | Reason |
|---|---|---|
| MUST first | T1, T2, T3, T4, T5 | Foundation — safe areas and PWA affect every screen |
| MUST | T6, T7, T8 | Keyboard safety in modals — biggest mobile UX pain point |
| HIGH | T9, T10, T11 | Navigation feel, FAB, sticky page headers |
| HIGH | T12, T13 | Dashboard filter UX, chart overlap fix |
| MEDIUM | T14, T15, T16, T17, T18 | Per-page polish |
| MEDIUM | T19, T20 | Settings polish |
| ENHANCEMENT | T21, T22 | Quick-add bar, offline support |

---

*Plan authored via full codebase analysis of WealthMap — 2026-08-14*
