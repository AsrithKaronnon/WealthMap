import { createRootRoute, createRoute, createRouter, createHashHistory } from '@tanstack/react-router';
import { RootLayout } from './__root';
import { Dashboard } from './index';
import { Transactions } from './transactions';
import { Goals } from './goals';
import { Bills } from './bills';
import { Settings } from './settings';
import { Investments } from './investments';
import { Insights } from './insights';

const hashHistory = createHashHistory();

// Create Root Route
export const rootRoute = createRootRoute({
  component: RootLayout,
});

// Configure core child routes for simplified consumer finance
export const dashboardRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Dashboard });
export const transactionsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/money', component: Transactions });
export const goalsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/goals', component: Goals });
export const billsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/bills', component: Bills });
export const investmentsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/investments', component: Investments });
export const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: Settings });
export const insightsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/insights', component: Insights });

// Add only core child routes to root
const routeTree = rootRoute.addChildren([
  dashboardRoute,
  transactionsRoute,
  goalsRoute,
  billsRoute,
  investmentsRoute,
  settingsRoute,
  insightsRoute,
]);

// Instantiate router using Hash History to prevent 404 reload errors on GitHub Pages
export const router = createRouter({ routeTree, history: hashHistory });

// Register router for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
