import { createRootRoute, createRoute, createRouter, createHashHistory } from '@tanstack/react-router';
import { RootLayout } from './__root';
import { Dashboard } from './index';
import { Transactions } from './transactions';
import { Goals } from './goals';
import { Settings } from './settings';
import { Investments } from './investments';
import { Insights } from './insights';
import { Projects } from './projects';
import { ProjectDetail } from './project-detail';

const hashHistory = createHashHistory();

// Create Root Route
export const rootRoute = createRootRoute({
  component: RootLayout,
});

// Configure core child routes for simplified consumer finance
export const dashboardRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Dashboard });
export const transactionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/money',
  component: Transactions,
  validateSearch: (search: Record<string, unknown>): {
    add?: string;
    move?: 'transfer' | 'recurring' | 'emi' | 'cc';
    recurringId?: string;
    loanId?: string;
    ccId?: string;
    tab?: 'recurring';
    project?: string;
  } => {
    const moveRaw = typeof search.move === 'string' ? search.move : undefined;
    const move =
      moveRaw === 'transfer' || moveRaw === 'recurring' || moveRaw === 'emi' || moveRaw === 'cc'
        ? moveRaw
        : undefined;
    return {
      add: search.add === '1' || search.add === 1 || search.add === true ? '1' : undefined,
      move,
      recurringId: typeof search.recurringId === 'string' ? search.recurringId : undefined,
      loanId: typeof search.loanId === 'string' ? search.loanId : undefined,
      ccId: typeof search.ccId === 'string' ? search.ccId : undefined,
      tab: search.tab === 'recurring' ? 'recurring' : undefined,
      project: typeof search.project === 'string' && search.project ? search.project : undefined,
    };
  },
});
export const goalsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/goals', component: Goals });
export const investmentsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/investments', component: Investments });
export const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: Settings });
export const insightsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/insights', component: Insights });
export const projectsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/projects', component: Projects });
export const projectDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$projectId',
  component: ProjectDetail,
});

// Add only core child routes to root
const routeTree = rootRoute.addChildren([
  dashboardRoute,
  transactionsRoute,
  goalsRoute,
  investmentsRoute,
  settingsRoute,
  insightsRoute,
  projectsRoute,
  projectDetailRoute,
]);

// Instantiate router using Hash History to prevent 404 reload errors on GitHub Pages
export const router = createRouter({ routeTree, history: hashHistory });

// Register router for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
