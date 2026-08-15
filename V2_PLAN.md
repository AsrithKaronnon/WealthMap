# WealthMap v2 Plan

**Status:** implemented (Phases A–D). Apply DB migration `20260815_cc_expense_increases_usage.sql` if not already on the linked Supabase.  
**Product north star:** a calm, minimalist money check-in — not a spreadsheet or “finance OS.”  
**Constraint:** keep desktop usable; prefer shared logic fixes. Mobile-only chrome stays `md:` / `md:hidden` where needed.  
**Theme:** claymorphism + **theme tokens only** (`text-foreground`, `text-muted-foreground`, `bg-card`, `border-border`). No hardcoded white text on light cards.

This plan is the locked scope from the v1 → v2 discussion. Do not expand into budgets-as-a-product, FX, trading, or AI coaches.

---

## 1. Product decisions (locked)

| Topic | Decision |
|--------|----------|
| **Goals** | Trackers only. Money **stays** in bank/cash accounts. “Contribute” updates `goals.current_amount` only — **no** expense/transfer that debits an account. |
| **Move money** | One entry flow for Transfer · Pay bill · Pay EMI · Pay credit card. |
| **Net worth** | Same formula everywhere + tiny Home breakdown: Cash · Invested · Assets · −Debt. |
| **Account pickers** | Never silently use `accounts[0]`; always show (and require) a funding account when money moves. |
| **CC** | `balance` = usage owed (≥ 0). Spend ↑ usage; payoff ↓ usage. Available = limit − used. |
| **Empty states** | One short sentence + one primary button. |
| **Out of scope** | Goal pot accounts, treating goals as spending, new nav tabs, multi-currency FX. |

### Goals copy (canonical)

- Button: **“Mark toward goal”** (not “Deposit” / “Transfer”).
- Helper: **“Cash stays in your accounts — this only tracks progress.”**
- Optional later (Phase D): **Free cash ≈ liquid cash − Σ(goal current_amount)** on Home — display-only, no ledger move.

---

## 2. Current gaps this plan closes

| Area | Today (v1) | v2 target |
|------|------------|-----------|
| Goals contribute | Inserts expense → bank drops | Update goal only; clear tracker copy |
| Bill / EMI / CC / transfer | Separate screens/modals | One **Move money** sheet + type |
| Home NW | Big number only | Number + Cash / Invested / Assets / −Debt chips |
| Account selection | Often defaults to first account | Explicit picker |
| Upcoming automations | Buried | Home strip: next bill / EMI / SIP |
| Empty dashboards | Sparse zeros | Guided first action |
| Theme | Some leftover dark-only colors | Tokens everywhere on shared surfaces |

Balance trigger work from the functional audit (single DB trigger, CC payoff via ledger, etc.) is **assumed done**; v2 builds on that.

---

## 3. Architecture notes (do not rewrite the app)

- Keep route-local handlers; extract only small shared helpers (`computeNetWorth`, maybe `MoveMoneySheet`).
- Reuse existing tables: `transactions`, `bills`, `loans`, `accounts`, `goals`.
- **Move money** can live as:
  - A shared component opened from Home (+) and/or Money, **or**
  - Deep-link into `/money` with `?move=transfer|bill|emi|cc`.
- Prefer one component used in both places over duplicating forms.

---

## 4. Phases

### Phase A — Goals as trackers + trust surfaces

**Goal:** Stop lying about money leaving the bank; make NW readable.

1. **Goals contribute**
   - Remove transaction insert from `handleDeposit` in `goals.tsx`.
   - Rename UI: “Mark toward goal”; add helper copy above.
   - Keep amount + optional note; no account picker required (nothing is debited).
2. **Home net-worth breakdown**
   - Under the NW figure, show four compact chips: Cash · Invested · Assets · −Debt (CC usage + loans).
   - Use `computeNetWorth` from `src/lib/netWorth.ts` (already shared with Assets).
3. **Empty states (Home first)**
   - If no accounts / no txs / no goals: one sentence + one CTA each (Add account / Log money / Add goal).

**Done when:** Marking toward a goal does not change any `accounts.balance`; Home NW chips match Assets math.

---

### Phase B — Move money (unified flow)

**Goal:** One place to move or pay cash.

1. **Type picker** (segment or list):  
   `Transfer` · `Pay bill` · `Pay EMI` · `Pay credit card`
2. **Shared fields**
   - Amount, date, **From account** (required), notes.
3. **Type-specific fields**
   - Transfer → To account (required, ≠ from).
   - Bill → Bill select (pending) or inline “one-off payee”.
   - EMI → Loan select.
   - CC → Credit card account + payoff amount (cap at usage).
4. **Handlers** (reuse existing correct ledger behavior)
   - Transfer → one transfer tx (trigger moves balances).
   - Bill → expense on from-account + mark bill paid / spawn next (current bills logic).
   - EMI → expense + reduce outstanding + `remaining_emis`.
   - CC → funding expense + CC adjustment (current payoff pattern).
5. **Entry points**
   - Home primary + (and/or Money header): opens Move money.
   - Keep deep links into specialized pages for “manage list” (all bills, all loans), not for the pay action itself.
6. **Desktop**
   - Same sheet/dialog; no separate desktop-only flow.

**Done when:** User can complete all four money moves without visiting four different page-specific modals.

---

### Phase C — Money logic hardening

**Goal:** Pickers, reconcile, upcoming, CC clarity.

1. **Account pickers everywhere money moves**
   - Bills pay, EMI (if any leftover entry), investment “debit cash”, SIP setup — all explicit.
2. **Soft reconcile**
   - Settings or Assets account row: “Matches bank?” → set current balance (existing account edit is enough; add a clear label + optional Home nudge once / 30 days via `localStorage`).
3. **Upcoming strip on Home**
   - Next 7–14 days: bills due, EMI hint, SIP day if configured.
   - Tap → Move money prefilled, or Bills/Goals list.
4. **CC semantics in UI**
   - Assets liquid cards: **Credit used** + **Available** (`limit − used`).
   - Money: spending on a CC account should increase usage (confirm trigger/expense behavior matches; fix UI labels if not).
5. **Recurring visibility**
   - Simple list or Home chips; pause = deactivate bill / turn off SIP flag (no new tables unless required).

**Done when:** No pay flow hides the funding account; Home shows at least one “upcoming” row when data exists; CC shows used + available.

---

### Phase D — UX polish (minimalist)

**Goal:** Calm empty states + theme safety.

1. **Empty states on Money, Goals, Assets, Bills** — same pattern as Home.
2. **Theme audit**
   - Grep for `text-white` on non-primary surfaces; replace with tokens.
   - Charts: tick/legend/tooltip use `hsl(var(--foreground))` / `muted-foreground` / `card` / `border`.
3. **Optional:** Free cash line on Home  
   `Free cash = liquid − Σ(goal currents)` with tooltip explaining earmark vs actual cash.
4. **Copy pass** — short labels, no jargon (“Mark toward goal”, “Pay from”, “Available credit”).

**Done when:** Light and dark both readable on Home charts/activity; empty screens never show a grid of meaningless zeros without a CTA.

---

## 5. Suggested implementation order

```
A1 Goals tracker fix
A2 Home NW chips
A3 Home empty states
B  Move money sheet + wire entry points
C  Pickers / upcoming / CC available / reconcile nudge
D  Empty states elsewhere + theme grep + optional free cash
```

Do not start B until A1 is done (avoids teaching users that goals spend money).

---

## 6. File touch map (expected)

| Phase | Likely files |
|-------|----------------|
| A | `src/routes/goals.tsx`, `src/routes/index.tsx`, `src/lib/netWorth.ts` |
| B | New `src/components/MoveMoneySheet.tsx` (or similar), `index.tsx`, `transactions.tsx`, thin calls into bills/loans/cc helpers |
| C | `bills.tsx`, `investments.tsx`, `index.tsx`, maybe `settings.tsx` |
| D | Route empty states, `index.css` / chart props, residual `text-white` cleanups |

---

## 7. Test checklist (v2)

### Goals
- [x] Mark toward goal ↑ `current_amount`; all account balances unchanged.
- [x] Copy does not say transfer/deposit/spend.

### Move money
- [x] Transfer A→B: A down, B up; total liquid unchanged.
- [x] Pay bill: from-account down; bill paid / next created if recurring.
- [x] Pay EMI: from-account down; outstanding ↓; remaining_emis ↓.
- [x] Pay CC: bank down; CC usage ↓; usage never below 0.

### Trust / UX
- [x] Home NW chips sum to the headline (within rounding).
- [x] Assets NW matches Home.
- [x] Light mode: chart labels, activity, goals/loans chips readable.
- [x] Empty Home shows one CTA, not a dead dashboard.

---

## 8. Non-goals (explicit)

- New bottom-nav items.
- Budget module revival.
- Goal = sub-account / envelope banking (revisit only if users ask after Free cash).
- Rewriting data layer to React Query.
- Changing clay visual language.

---

## Implementation principles

1. **Minimal surfaces** — one composition per job; no extra dashboards.
2. **One money model** — DB trigger + transactions remain source of cash movement; goals never invent a second ledger.
3. **Same handlers** — Move money calls the same Supabase writes as today’s correct paths.
4. **Theme tokens only** on shared UI.
5. **This file is the v2 spec.** Implement A→D; don’t start a parallel redesign.
