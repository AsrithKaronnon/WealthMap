# WealthMap 🗺️💎

WealthMap is a premium, modern, and comprehensive personal finance management application designed to give you complete control over your financial life. Built with React and tailored for exceptional user experience, WealthMap provides an elegant, responsive interface to track, analyze, and optimize your wealth.

## ✨ Premium UI & Aesthetics
WealthMap features a state-of-the-art interface utilizing glassmorphism, dynamic micro-animations, and custom typography. From the stunning rotating conic-gradient glow borders on dashboard cards to the smooth transitions across all responsive layouts, the application is built to feel incredibly polished on both desktop and mobile devices.

---

## 🚀 Features & Modules

### 1. 📊 Dashboard
The Dashboard acts as your financial command center, providing a high-level overview of your wealth.
- **Dynamic Date Filtering**: Use the global date filter at the top to instantly adjust all dashboard metrics and charts. View data for "This Month", "Last Month", "3 Months", "6 Months", or specify a "Custom Range".
- **At-a-Glance Metrics**: Four beautifully designed, glowing summary cards display your Total Balance, Income, Expenses, and savings percentages for the selected timeframe.
- **Customizable Layout**: Rearrange the dashboard widgets to suit your preferences via the Settings screen. Supported widgets include Cash Flow, Recent Transactions, Upcoming Bills, Goals Progress, Investment Allocations, and Net Worth Trend.
- **Mobile Optimized**: The header and cards intelligently adapt to mobile screens, ensuring a seamless, single-row experience without awkward wrapping.

### 2. 💸 Transactions
A robust ledger for logging and managing your day-to-day financial activities.
- **Income, Expense & Transfers**: Log various types of transactions accurately.
- **Detailed Data Entry**: Categorize transactions, select payment methods, tag specific accounts, and add custom notes and tags for granular tracking.
- **Filtering & Search**: Quickly find specific transactions using a powerful, responsive table view.
- **Edit & Delete**: Maintain a clean ledger by easily modifying or removing historical transactions.

### 3. 🎯 Goals & Loans
A unified workspace for managing your future aspirations and current liabilities.
- **Savings Goals**: Create visual savings goals with target amounts, expected due dates, and calculated monthly contributions. Progress bars dynamically update as you deposit funds towards a goal.
- **Active Loans**: Track mortgages, car loans, or personal loans. View outstanding balances, interest rates, and remaining EMIs. 
- **Smart Auto-Selection**: The app intelligently defaults to your Active Loans tab if you have ongoing debts but no active savings goals.

### 4. 📅 Bills & Subscriptions
Never miss a payment again with the automated bills tracker.
- **Recurring Schedules**: Add bills and specify their frequency (Monthly, Weekly, Yearly, or One-time). 
- **Automated Rollover**: When you mark a recurring bill as "Paid", WealthMap automatically records the payment as an expense transaction and generates the *next* pending bill for the subsequent billing cycle.
- **Paid vs Pending Tabs**: Keep your upcoming liabilities organized and distinct from your settled accounts.
- **Active / Paused Status**: Temporarily pause recurring bills without losing their configuration.

### 5. 📈 Analytics
Deep-dive insights to help you understand your spending habits.
- **Visual Breakdown**: Interactive charts breaking down expenses by category, comparing income versus expenses over time, and tracking investment allocations.
- **Budgeting Context**: See exactly where your money goes to make informed adjustments to your lifestyle.

### 6. ⚙️ Settings & Customization
Tailor the application to your exact needs.
- **Dashboard Customization**: Toggle and reorder dashboard widgets to prioritize the data most important to you.
- **Currency Preferences**: Change your base currency; all charts and cards globally reflect this preference.
- **Theme**: Seamlessly switch between Light and Dark mode, or inherit your system preference.

---

## 🛠️ Technical Stack & Architecture

- **Frontend**: React, TypeScript, Vite
- **Styling**: Vanilla CSS (`index.css`) & Tailwind CSS for utility classes, prioritizing bespoke aesthetics over generic frameworks.
- **Routing**: Client-side routing with comprehensive state persistence.
- **Data Layer**: Mocked backend implementation via `supabaseMock.ts` leveraging `localStorage` for complete client-side persistence and demonstration of database schema functionality without requiring a live server.
- **Icons**: Lucide React for consistent, crisp vector iconography.

## 🏃 Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Start the development server:**
   ```bash
   npm run dev
   ```
3. **Build for production:**
   ```bash
   npm run build
   ```

## 💡 How It Works Under The Hood
- **Data Seeding**: Upon first load, the app detects an empty `localStorage` state and automatically seeds itself with realistic mock data (accounts, transactions, bills, goals) via `supabaseMock.ts` so you can immediately experience the full interface.
- **State Management**: Robust custom hooks (`useToastStore`, `useConfirmStore`) handle global UI states for notifications and destructive-action confirmations.
- **Responsive Philosophy**: The UI heavily utilizes CSS Flexbox and Grid, with careful attention paid to mobile viewports (e.g., truncating long text, resizing buttons, scaling down dropdown options) to guarantee zero horizontal scrollbars or broken layouts.
