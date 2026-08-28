# HK Life Money — Product Requirements Document (v1)

## 1. Product vision

**HK Life Money** is a privacy-first personal-finance web app for Hong Kong residents. It starts with familiar, fast daily money tracking comparable to Money Pro, then turns real financial behaviour into useful forward-looking planning.

The product is built around three Hong Kong life concerns:

1. **Living / Home** — housing cost, property, mortgage, and essential monthly living cost.
2. **Travel** — annual travel spending, individual trip funds, foreign-currency expenses, and Asia Miles balances.
3. **Retirement** — whether the user’s current financial path can support their desired retirement lifestyle in Hong Kong.

The experience must have a simple front door: log an expense, income, or transfer quickly. Its second layer must answer the more strategic questions that a traditional expense tracker does not:

- How much can I safely spend for the rest of this month?
- How much does my home cost, and what happens if mortgage rates increase?
- Is my desired trip funded in time, in both cash and Asia Miles?
- Based on my actual income, spending, assets, liabilities, MPF/ORSO, mortgage, and assumptions, how much can I spend each month after retirement?

## 2. Product principles

- **Privacy by architecture:** financial records are stored in the user’s browser, not in an application database or analytics platform.
- **Local first:** work offline after loading; use IndexedDB as the primary local datastore.
- **Hong Kong by default:** HKD, local mortgage conventions, MPF/ORSO, government allowances, Asia Miles, and common travel currencies are first-class concepts.
- **Familiar before clever:** daily tracking follows a Money Pro-like interaction model so users can onboard with little relearning.
- **Progressive disclosure:** users can begin with accounts and transactions. Mortgage, travel plans, retirement, imports, and advanced settings are optional setup flows.
- **Assumption transparency:** every projection must display its assumptions; users can edit them and see results update.
- **No false certainty:** forecasts communicate scenarios and estimated ranges/status, never financial guarantees or regulated investment advice.

## 3. Target audience

### Primary user: Hong Kong financially engaged individual

- Hong Kong resident who already tracks personal expenses or accounts using Money Pro, spreadsheets, or banking apps.
- Owns a primary residence with a P-rate, H-rate, or fixed-rate mortgage, or rents and wants to understand housing affordability.
- Holds accounts across HKD and common travel currencies: USD, JPY, CNY, TWD, THB, and GBP.
- Uses credit cards and may earn/redeem Cathay Asia Miles.
- Wants to prepare for retirement using personal savings, investments, MPF/ORSO, property/mortgage position, possible government support, and expected one-off cash flows.
- Values privacy and is willing to enter data manually or import files rather than grant bank credential access.

### Secondary user: Household planner (future release)

- A couple or family member who wants shared visibility of home finances, travel plans, and long-term retirement readiness.
- Not in v1, but the data model must avoid assumptions that permanently prevent future household/shared-dataset support.

### Product maturity path

| Stage | Target user | Main value |
|---|---|---|
| v1 | Single privacy-conscious HK user | Daily tracking, reporting, housing/travel/retirement planning |
| Later | Household/family | Shared plans and controlled data sharing |
| Later | Broader HK public | Guided onboarding, templates, optional AI explanations |

## 4. Scope and information architecture

### Primary navigation

Use four persistent top-level areas. On mobile, present them in a bottom navigation bar; on desktop/tablet, use a persistent sidebar.

| Area | Purpose | Primary user question |
|---|---|---|
| **Today** | Daily money entry and immediate review | What happened today? |
| **Reports** | Historical analysis and future planning | Where is my money going, and what does my future look like? |
| **Assets** | Balance sheet and account/mortgage setup | What do I own and owe? |
| **More** | Configuration and data maintenance | How do I tailor and protect the app? |

### Screen hierarchy

```text
Today
├── Day / Week / Month / Calendar views
├── Add expense
├── Add income
├── Add transfer
├── Add Asia Miles activity
├── Transaction detail/edit
└── Search/filter

Reports
├── History
│   ├── Spending analysis
│   ├── Income vs expense
│   ├── Budget vs actual
│   ├── Net worth trend
│   └── Travel spending
└── Planning
    ├── Life Dashboard
    ├── Living / Home
    ├── Travel plans
    ├── Cash-flow forecast
    └── Retirement projection

Assets
├── Accounts and wallets
├── Credit cards
├── Investment balances
├── MPF / ORSO retirement account
├── Property
├── Mortgage
└── Asia Miles account

More
├── Categories and themes
├── Recurring transactions
├── Budgets and goals
├── FX rate settings
├── Import / export
├── Encrypted backup / restore
├── Security / app lock
└── Display and preferences
```

## 5. Functional requirements

## 5.1 Today — daily tracking

### Goal

Allow users to record financial activity in seconds, similar to a familiar Money Pro workflow.

### Day, week, month, and calendar views

- Default to a **Today** view showing today’s transactions, net daily flow, and upcoming planned items.
- Allow switching among:
  - Day
  - Week
  - Month
  - Calendar / planned transactions
- Month view displays income, expense, net cash flow, and transaction activity by date.
- Calendar view highlights dates containing completed or planned transactions.
- The selected date/period persists during the session.

### Quick-add actions

A global `+` action exposes four choices:

1. Expense
2. Income
3. Transfer
4. Asia Miles activity

#### Expense

Required fields:

- Amount
- Currency
- Source account
- Category
- Date

Optional fields:

- Note/payee
- Tags
- Trip link
- Receipt image stored locally
- Manual FX rate override
- Split transaction lines

#### Income

Required fields:

- Amount
- Currency
- Destination account
- Category
- Date

Optional fields match expense, plus recurring rule selection.

#### Transfer

Required fields:

- Amount
- Source account
- Destination account
- Date

Rules:

- Transfers do not count as income or spending in cash-flow reports.
- Cross-currency transfers record a source amount, destination amount, and exchange rate.
- Transfers between cash, bank, credit card payment accounts, investment accounts, and goal accounts are supported.

#### Asia Miles activity

Treat Asia Miles as a quantity-based non-cash account, not as an HKD-valued asset.

Required fields:

- Type: Earn, Burn, Adjustment, or Expiry
- Miles amount
- Asia Miles account
- Date

Optional fields:

- Related trip
- Related cash transaction, such as taxes and surcharges paid on an award ticket
- Note/source, such as credit-card conversion, airline flight, redemption, or promotion

Rules:

- No implied or estimated HKD valuation is calculated for Asia Miles.
- A redemption can record both miles burned and separate HKD cash charges.

### Transaction list and management

- Chronological list grouped by date.
- Display category icon, category, payee/note, account, amount, and optional theme/trip chip.
- Color convention: income positive/green; expense negative/red; transfer neutral/blue; miles visually distinct.
- Search note/payee/category/tag.
- Filter by date range, account, category, theme, trip, currency, type, and tags.
- Edit, duplicate, delete, and optionally split transactions.
- Use undo after a deletion where feasible.

### Monthly money summary

Show a compact summary on Today screen without turning it into a planning dashboard:

- Income this month
- Expense this month
- Net cash flow this month
- Remaining soft budget
- Remaining discretionary amount
- Approximate daily spendable amount for remaining days in the month
- Upcoming recurring payments

## 5.2 Accounts and balance sheet

### Goal

Represent the user’s complete financial position, not merely cash accounts.

### Supported account types

| Group | Account types |
|---|---|
| Cash and banking | Cash, HKD/current account, savings account, foreign-currency account, e-wallet |
| Credit and debt | Credit card, personal loan, other debt |
| Assets | Investment account, MPF/ORSO, property, other manually valued asset |
| Housing | Primary mortgage |
| Loyalty | Asia Miles account |

### Account functions

- Create, edit, archive, and reorder accounts.
- Store account name, type, native currency/unit, opening balance, current balance, notes, and whether it appears in net-worth calculations.
- Display account balance in native currency and, for monetary accounts, base-currency HKD equivalent.
- Account detail includes transaction history and balance history.
- Credit cards are represented as liabilities; payments are transfers and do not create duplicate spending.
- Property value is manually entered or periodically updated; it may be included in net worth but is not automatically treated as spendable retirement capital.

### Net worth

- Net worth = included assets minus included liabilities.
- Show total assets, total liabilities, net worth, and historical trend.
- Support a monthly snapshot to create a stable historical chart even when a user does not record every valuation change.

## 5.3 Categories, themes, and tags

### Themes

Every expense/income category can be linked to one primary theme:

- Living / Home
- Travel
- Retirement
- Other

Theme mapping enables Life Dashboard and planning reports without changing everyday transaction entry.

### Default Hong Kong-oriented categories

- Housing: mortgage principal, mortgage interest, rent, management fee, rates/government rent, home insurance, repairs, utilities, internet/mobile.
- Daily living: groceries, dining, MTR/bus, taxi/ride-hailing, medical, insurance, education, entertainment, personal care.
- Travel: flights, hotels, local transport, food, attractions, travel insurance, shopping, foreign cash withdrawal.
- Retirement: MPF/ORSO contribution, voluntary retirement contribution, retirement investment contribution.
- Income: salary, bonus, interest, dividend, rental income, refund, other income.

### Tags

- User-created freeform tags, e.g. `Japan2027`, `Renovation`, `Work expense`.
- A transaction may have multiple tags.
- Trips use a dedicated relationship, not only a text tag, so trip reports remain reliable.

## 5.4 Recurring transactions

### Goal

Reduce manual entry and enable credible forward cash-flow projections.

### Requirements

- Create recurring income, expenses, and transfers.
- Frequencies: weekly, monthly, quarterly, yearly, and custom interval.
- Start date, optional end date, expected amount, account, category, and notes.
- Optional variable amount flag for bills that should be reviewed before posting.
- Mark recurring costs as **essential** for budget and retirement modelling.
- Display upcoming planned entries in Today and cash-flow forecast.
- User can skip, edit one occurrence, edit future occurrences, or stop a rule.

Examples:

- Salary
- Mortgage instalment
- Management fee
- Insurance premium
- Mobile plan
- Subscription
- MPF voluntary contribution
- Monthly travel-fund transfer

## 5.5 Multi-currency and FX

### Goals

Support actual spending and account balances in common HK travel currencies while keeping reports understandable in HKD.

### Required currencies in v1

- HKD base currency (default)
- USD
- JPY
- CNY
- TWD
- THB
- GBP

### Requirements

- Every monetary account has a native currency.
- Transactions capture original amount and currency.
- Monetary reports convert to the base currency using a transaction-level rate.
- FX rate is editable per transaction.
- Support online FX synchronisation using a public rate source or a user-controlled serverless proxy.
- Cache retrieved rates locally with source and date.
- Do not send transaction, account, or personal data to the FX service.
- Clearly label reference rates as indicative; actual card/bank conversion can differ.
- Cross-currency transfers require both sides and a stored effective rate.

## 5.6 Soft budgeting and monthly spend guidance

### Goal

Help users decide how much they can spend without preventing spending or forcing envelope-style accounting.

### Budget setup

- Set monthly soft budgets by category and optionally by theme.
- Support budget rollover as a later enhancement; v1 can default to no rollover.
- Mark categories/recurring rules as essential or discretionary.

### Monthly guidance calculations

- Monthly income: actual income plus reasonably confirmed planned income for the selected month.
- Essential commitments: scheduled essential recurring payments plus baseline essential category budgets.
- Remaining discretionary budget: available monthly income minus essential commitments minus already recorded non-essential expenditure, subject to budget allocation settings.
- Remaining budget: applicable monthly budget minus actual spending to date.
- Daily spendable: remaining discretionary budget divided by remaining calendar days, with clear wording that it is guidance, not a cash-balance guarantee.

### UI requirements

- Show soft warning at configurable thresholds, e.g. 80%, 100%, 120% of category budget.
- Never block a transaction because a budget is exceeded.
- Explain calculations via a tappable information icon.

## 5.7 Travel planning

### Annual travel budget

- Set an annual travel budget in HKD.
- Automatically include transactions categorised as Travel and/or linked to a trip.
- Show YTD actual spending, budget used percentage, remaining annual budget, and monthly trend.
- Avoid double-counting a trip-linked transaction that is already categorised as Travel.

### Asia Miles

- Support Asia Miles as the primary miles program in v1.
- A separate miles account stores quantity only.
- Record earned, burned, expired, and adjusted miles.
- Display current balance, recent activity, and trip-linked miles activity.
- Do not calculate cash equivalents, projected monetary value, or redemption value per mile.

### Trip objects

A trip is a first-class planning and tracking object.

Required trip fields:

- Name
- Destination(s)
- Target start date and optional end date
- Status: Planning, Booked, Completed, Cancelled
- Cash budget in HKD
- Asia Miles target

Optional fields:

- Cash budget by category: flights, hotel, food, transport, activities, shopping, insurance, contingency
- Cash already reserved/saved
- Miles allocated/saved toward this trip
- Planned monthly cash contribution
- Planned monthly miles contribution
- Notes

### Trip goal calculations

For cash and miles separately:

- Remaining amount = target minus saved/allocated amount, not below zero.
- Months remaining = target date minus current date.
- Required monthly contribution = remaining amount divided by months remaining.
- Estimated time to goal = remaining amount divided by planned monthly contribution, when contribution is greater than zero.
- Status:
  - On track when planned contribution reaches target by trip date.
  - At risk when it does not.
  - Complete when target is met.

### Trip actuals

- A cash transaction can link to one trip.
- A miles transaction can link to one trip.
- Trip screen displays planned cash and miles, actual cash spend, actual miles burned, remaining goal, and linked activity.
- Award-ticket taxes/surcharges remain ordinary monetary transactions, linked to the trip and optionally to the miles redemption.

## 5.8 Living / Home and mortgage

### Home profile

v1 supports one primary residence.

- Living mode: Owner with mortgage, Owner without mortgage, Renter, Other.
- Include home-related recurring costs: mortgage, rent, management fees, rates/government rent, home insurance, utilities, repairs.

### Mortgage setup

v1 supports a primary amortising mortgage with a schema that can expand later.

Required fields:

- Loan name
- Original loan amount
- Current outstanding principal
- Remaining term in months/years
- Repayment frequency, default monthly
- Rate type: P-rate, H-rate, Fixed
- Current applicable benchmark rate, where relevant
- Signed adjustment, e.g. `P − 3.15%` or `H + 1.30%`
- Effective rate override if supplied by the user
- Next repricing date, optional

Optional fields:

- Rate cap/floor
- Monthly payment override
- Lender name
- Mortgage-linked payment account
- Planned lump-sum repayments

### Mortgage outputs

- Current effective annual rate.
- Estimated scheduled monthly payment.
- Remaining principal.
- Amortisation schedule by month: opening balance, payment, interest, principal, closing balance.
- Total future interest under the current constant-rate assumption.
- Rate stress tests at user-selectable shocks such as +0.5%, +1%, and +2%.
- Updated payment and total-interest estimate for each stress scenario.
- Mortgage contribution to total liabilities and monthly essential cost.

### Retirement linkage

- Retirement model recognises projected mortgage payoff date.
- Mortgage instalments are included before payoff; after payoff, only selected ongoing housing costs remain.
- Property value and mortgage balance can be displayed separately from liquid retirement assets.

## 5.9 Retirement base scenario

### Goal

Answer the user’s central question in today’s HKD:

> Based on my current income, spending, savings, assets, liabilities, home costs, MPF/ORSO, travel intentions, and assumptions, how much can I safely spend each month in retirement, and is my desired lifestyle funded?

### Base scenario design

- One active base scenario in v1.
- Advanced multiple named scenarios are deferred, but data structures should allow future expansion.
- Display outputs in today’s HKD by default, with nominal values available later.

### Inputs

#### Personal timeline

- Current age
- Target retirement age
- Expected age at death

#### Current and pre-retirement cash flow

- Current monthly income, derived from actual history or manually overridden
- Current monthly spending, derived from actual history/budgets or manually overridden
- Expected annual income growth, optional
- Expected annual saving/investment contribution, derived or manual
- Essential versus discretionary spending

#### Assets and liabilities

- Included liquid/investable assets from Assets tab
- MPF/ORSO represented as one retirement account in v1
- Investment balances as manually maintained account values
- Mortgage and other liabilities
- Property value displayed separately and excluded from spendable assets by default

#### Assumptions

- Pre-retirement nominal investment return
- Post-retirement nominal investment return
- Inflation rate
- Retirement lifestyle target:
  - Direct monthly target spending in today’s HKD, or
  - Percentage of current spending, with user confirmation of derived amount
- Optional expected annual travel budget in retirement
- Health/medical or other extra retirement cost, optional

#### Hong Kong-specific expected income

- Government Old Age Allowance / Old Age Living Allowance / Disability Allowance as user-entered expected income.
- Start age, monthly amount, and whether it is inflation-adjusted.
- Private pension, annuity, part-time income, or other recurring retirement income as generic user-entered income streams.

#### One-off cash flows

- Expected inheritance, property sale, bonus, major medical cost, education expense, or other event.
- Amount, currency, expected age/date, and direction (inflow/outflow).
- Convert monetary amounts to projection base currency using stored/manual rate as appropriate.

### Core projection requirements

#### Accumulation phase: current age to retirement age

For each projection year:

1. Start with prior year’s investable assets.
2. Apply pre-retirement return according to a documented timing convention.
3. Add projected income.
4. Subtract projected spending, mortgage payments, and planned contributions/expenses.
5. Add or subtract one-off cash flows scheduled for that year.
6. Track MPF/ORSO separately where relevant, then aggregate in retirement resources.

#### Retirement phase: retirement age to expected age at death

For each projection year:

1. Start with assets available at retirement / prior year-end assets.
2. Apply post-retirement return according to the documented timing convention.
3. Inflate desired spending from today’s HKD into the relevant year, then deduct it.
4. Add government allowance, pension/annuity, or part-time income; inflate them only when the user marks them inflation-adjusted.
5. Add/subtract scheduled one-off cash flows.
6. Continue until expected age at death or assets are depleted.

### Required outputs

- Projected investable retirement corpus at target retirement age.
- Target monthly retirement spending in today’s HKD.
- Sustainable monthly retirement spending in today’s HKD for the assumed lifespan.
- Whether assets last to the expected age at death.
- Estimated depletion age if assets run out.
- Required corpus at retirement for the target spending level.
- Funding gap/surplus at retirement.
- Indicative action levers:
  - Additional monthly saving required to meet target.
  - Alternative retirement age required, where computationally feasible.
  - Difference caused by adjusting travel budget, mortgage payoff, return, or inflation.
- Annual table and assets-over-age line chart, marking current age, retirement age, mortgage payoff date/age where applicable, one-off cash flows, and depletion age where applicable.

### Required safeguards and disclosures

- Clearly label projections as illustrative scenarios, not financial advice, investment advice, or a guarantee.
- Display current assumptions alongside every primary result.
- Explain whether figures are nominal or inflation-adjusted; default to today’s HKD / real-value view.
- Show a warning if critical inputs are missing or inconsistent, e.g. retirement age is before current age or desired death age is not after retirement age.

## 5.10 Reports and Life Dashboard

### Historical reports

- Income vs expense by month, category, theme, account, and custom date range.
- Spending by category and theme.
- Budget vs actual.
- Net worth trend.
- Account balance history.
- Travel spending: annual budget vs actual, by trip and category.
- Reports can filter to original currency where meaningful; default consolidated reports are in HKD.

### Life Dashboard

The Life Dashboard appears under `Reports → Planning`, not on the day-to-day entry screen.

It shows three visual cards:

#### Living / Home card

- Monthly housing cost
- Monthly essential living cost
- Mortgage outstanding and effective rate, if applicable
- Mortgage stress-test status/link

#### Travel card

- YTD travel spend versus annual travel budget
- Asia Miles balance
- Next/upcoming trip with cash and miles funding progress
- At-risk/on-track status for target date

#### Retirement card

- Projected corpus at retirement
- Sustainable monthly spending in today’s HKD
- Target monthly spending
- On-track / watch / at-risk status

### Status logic

- Green / On track: target is met under base assumptions.
- Amber / Watch: target is narrowly met, a major input is missing, or a planning target is at risk.
- Red / At risk: target will not be met under base assumptions or assets deplete before expected lifespan.
- The app must show the calculation basis on tap; never present colour alone as a financial conclusion.

## 5.11 Data import, export, backup, and privacy

### Browser-local storage

- Store operational data in IndexedDB.
- App functions offline for stored data after initial asset load.
- Do not transmit user financial records to a backend by default.
- Do not include third-party behavioural analytics in v1.

### Import

- CSV import for transactions as a v1 priority.
- Import wizard supports mapping columns: date, amount, currency, account, category, note/payee, tags.
- Offer saved mapping templates for repeated imports later.
- Detect likely duplicates and ask user to resolve them before committing.
- Money Pro-specific import mapping can be added after examining actual exported files.

### Export

- Export transactions and reports to CSV.
- Export complete application snapshot to JSON.
- Include schema version and integrity metadata in complete export.

### Encrypted backup

- Allow optional password-protected encrypted JSON export.
- Use standards-based browser cryptography, e.g. AES-GCM with a key derived from a user password via a suitable KDF.
- Never store the backup password in the app.
- Provide clear recovery warning: lost password means an encrypted backup cannot be restored.
- User manually stores the exported file locally or in a personal storage provider such as Google Drive.

### App lock

- v1 baseline: optional app lock / passphrase after inactivity, where technically feasible in a browser/PWA context.
- Full encrypted-at-rest IndexedDB can be evaluated after the baseline product is stable; it adds usability and recovery complexity.

## 6. UX flows

## 6.1 First-time onboarding

### Intent

Get users to a useful daily tracker quickly without requiring mortgage, retirement, or travel setup on day one.

```text
Welcome
  → Select base currency (HKD default)
  → Add first account OR import data OR explore sample data
  → Add opening balance
  → Add first transaction
  → Arrive at Today
  → Optional setup invitation:
       - Set up Home / Mortgage
       - Set up Travel and Asia Miles
       - Set up Retirement
       - Do this later
```

### Requirements

- Users can skip all planning setup.
- Explain that setup can be completed later under Assets and Reports → Planning.
- Provide an option to remove demo/sample data before real use.

## 6.2 Daily expense entry

```text
Today
  → Tap +
  → Choose Expense
  → Enter amount and currency
  → Select account
  → Select category
  → Optional: trip / note / tag / receipt
  → Save
  → Transaction appears in selected date
  → Monthly budget and reports update
```

Success criteria: the median user can record a normal HKD expense in under 15 seconds after setup.

## 6.3 Income and transfer entry

```text
Today
  → Tap +
  → Income OR Transfer
  → Enter amount
  → Choose account destination or source/destination pair
  → Confirm date and optional note
  → Save
  → Account balances update immediately
```

For a transfer, the UI must label it clearly as an internal movement and exclude it from income/expense totals.

## 6.4 Add an account or mortgage

```text
Assets
  → Tap +
  → Select account type
  → Enter name, currency/unit, opening balance
  → Save
  → Account included in balance sheet as configured

Assets
  → Tap +
  → Select Mortgage
  → Enter P/H/fixed rate setup, outstanding balance, term
  → Review calculated monthly payment
  → Save
  → Mortgage appears under liabilities and Living planning
```

## 6.5 Set up an Asia Miles account and record redemption

```text
Assets
  → Add Asia Miles account
  → Enter current miles balance
  → Save

Today
  → Tap +
  → Asia Miles activity
  → Choose Burn
  → Enter miles amount
  → Select related trip, if any
  → Save

Today
  → Tap +
  → Expense
  → Record award-ticket taxes/surcharges in HKD
  → Link to same trip and optionally same miles activity
  → Save
```

## 6.6 Create a trip and funding plan

```text
Reports → Planning → Travel
  → Add trip
  → Enter destination and target dates
  → Enter cash budget and Asia Miles target
  → Enter current cash/miles allocation and monthly contributions
  → Save
  → Trip page shows remaining cash/miles, required monthly amount, and time-to-goal
  → Link future expenses and miles activity to trip
```

## 6.7 Set up retirement base scenario

```text
Reports → Planning → Retirement
  → Enter current age, retirement age, and expected age at death
  → Confirm/override income and spending derived from tracker
  → Review included assets and liabilities
  → Add MPF/ORSO balance and expected return
  → Set return, inflation, and target lifestyle/spending
  → Add government allowance, other retirement income, and one-off cash flows
  → Review assumptions
  → Calculate
  → View corpus, sustainable spending, gap, chart, and sensitivity controls
```

## 6.8 Monthly review

```text
Reports → History
  → Review income, expense, budget, and net worth
  → Correct categories / reconcile balances if necessary
  → Reports → Planning → Life Dashboard
  → Review Living, Travel, and Retirement cards
  → Adjust budget, contribution, trip, or retirement assumptions when plans change
  → More → Encrypted backup export
```

## 7. Key screen requirements

| Screen | Main content | Primary actions |
|---|---|---|
| Today | Period selector, transaction list, compact monthly summary, upcoming recurring items | Add expense/income/transfer/miles; search; filter |
| Add transaction | Type selector and quick-entry form | Save, attach receipt, link trip |
| Assets | Net worth, asset/liability groups, Asia Miles quantity | Open account, add account/mortgage/property/MPF |
| Account detail | Native balance, HKD equivalent where applicable, history | Edit, reconcile, add transaction |
| Reports overview | History/Planning selector and report navigation | Open report/Life Dashboard |
| Life Dashboard | Living, Travel, Retirement cards | Drill down to thematic planning |
| Travel detail | Annual budget, Asia Miles balance, trip cards | Add trip, miles activity, link transaction |
| Trip detail | Cash/miles targets, progress, time-to-goal, linked activity | Edit plan, add linked expense/miles burn |
| Living detail | Essential cost, mortgage status, stress test | Edit mortgage, adjust rate scenario |
| Retirement detail | Inputs, assumptions, corpus, sustainable spend, chart | Edit assumptions, add cash flow, run what-if |
| More | Categories, recurring rules, budgets, FX, backup, security | Configure/export/import |

## 8. Non-functional requirements

### Privacy and security

- No user finance data stored on application servers by default.
- No third-party analytics SDKs that capture user behaviour or financial content.
- HTTPS for app delivery and FX requests.
- Sanitize all imported CSV content and user-provided notes before rendering to prevent script injection.
- Exports must clearly state whether they are plain JSON/CSV or encrypted.

### Performance

- App should open to usable Today view quickly from a local PWA install.
- Normal transaction entry must remain responsive with at least 10,000 transactions locally.
- Reports should be calculated locally and provide progress/loading state for larger datasets.

### Accessibility

- Do not rely on red/green colour alone for financial meaning.
- Support screen-reader labels, keyboard navigation, visible focus states, scalable text, and adequate contrast.
- Use explicit plus/minus signs and clear text for income/expense/transfer status.

### Responsive design

- Mobile-first PWA for iPhone-sized screens.
- Tablet/desktop uses the same information architecture with a sidebar and wider report layouts.
- Offline capability after application assets and data are available locally.

### Localisation

- Initial UI language can be English, with architecture ready for Traditional Chinese.
- Use `HK$`/`HKD` consistently according to user display preference.
- Support Hong Kong date formats and configurable first day of week.

## 9. v1 prioritisation

### Must have (launch core)

- Browser-local IndexedDB storage.
- Today tab: expense, income, transfer, transaction list, day/week/month views.
- Accounts, credit cards, assets/liabilities, net worth.
- Categories, themes, tags, recurring transactions.
- HKD plus USD/JPY/CNY/TWD/THB/GBP and locally cached FX rates.
- Soft monthly budgets, remaining monthly budget, daily spend guidance.
- Reports: income/expense, spending categories/themes, budget vs actual, net worth.
- Assets setup: MPF/ORSO as one retirement account, property value, one primary mortgage.
- P/H/fixed mortgage configuration and core amortisation/stress test.
- Travel: annual travel budget, Asia Miles quantity account, per-trip cash and miles goals, time-to-goal.
- Retirement: one base scenario, government allowance input, one-off cash flows, corpus and sustainable-spending outputs.
- JSON/CSV import/export and optional encrypted JSON backup.

### Should have (if time permits in v1)

- Receipt images stored locally.
- Split transactions.
- Transaction deduplication during import.
- Detailed mortgage lump-sum prepayment scenarios.
- Account reconciliation workflow.
- Traditional Chinese UI.
- PWA app lock after inactivity.

### Later releases

- Multiple named retirement scenarios and comparison.
- Full HIBOR rate synchronisation and repricing calendar.
- Multiple properties/mortgages.
- More airline and hotel loyalty programs.
- Household/shared-data workflows with explicit consent and encryption design.
- Bank-statement parsers for common HK institutions.
- Financial-advisor-style AI explanation layer, only with user-controlled local processing or explicit consent before sharing data externally.
- Investment holdings, dividends, cost basis, and portfolio analytics.
- Automated cloud backup chosen and controlled by the user.

## 10. Success metrics and acceptance criteria

### Product success criteria

- A new user can create an account and record their first expense without mandatory retirement/mortgage setup.
- A returning user can record expense, income, or transfer in fewer than 15 seconds in a typical case.
- Users can identify current month income, spending, remaining budget, and per-day guidance from Today.
- Users can inspect total assets, liabilities, net worth, and Asia Miles balance from Assets.
- Users can set a trip’s cash and miles targets and see both required monthly contribution and estimated time-to-goal.
- Users can model a P-rate mortgage using a signed P adjustment such as `P − 3.15%` and see payment/stress-test results.
- Users can produce a retirement base projection incorporating MPF/ORSO, mortgage, government support, one-off cash flows, and a user-defined lifespan.
- Users can export their entire dataset and restore it in a new browser profile/device using a file.
- No transaction/account data is sent to a product backend during ordinary use.

### MVP quality gates

- Calculation unit tests cover transfer exclusion, FX conversion, budget remaining, mortgage amortisation, trip goals, and retirement depletion logic.
- Import preview prevents accidental commit until mapping and duplicate review are complete.
- Backup restore validates schema version and warns before overwriting existing local data.
- Every planning result visibly identifies its key assumptions and includes a non-advice disclaimer.

## 11. Future AI direction

AI is not required for v1. The v1 architecture should, however, retain clean separation between raw records, calculated metrics, and user assumptions so an explanation layer can later operate safely.

Potential later capabilities:

- Explain spending changes in plain language.
- Identify categories exceeding soft budget due to a few transactions.
- Explain how mortgage-rate changes alter cash flow and retirement results.
- Convert retirement-gap outputs into understandable options: save more, alter retirement age, reduce spending, or alter travel budget.
- Summarise upcoming cash commitments.

Constraints for future AI:

- No user financial data is sent to a third-party model without explicit, contextual consent.
- AI output is educational and scenario-based, not regulated personal investment, tax, insurance, or mortgage advice.
- Any recommendation must show its data basis and assumptions.
