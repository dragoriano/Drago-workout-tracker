import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { HomePage } from '../features/home/HomePage';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';

const WorkoutsPage = lazy(() =>
  import('../features/workouts/WorkoutsPage').then((m) => ({ default: m.WorkoutsPage })),
);
const ProgramDetailsPage = lazy(() =>
  import('../features/workouts/ProgramDetailsPage').then((m) => ({ default: m.ProgramDetailsPage })),
);
const WorkoutSessionPage = lazy(() =>
  import('../features/workouts/WorkoutSessionPage').then((m) => ({ default: m.WorkoutSessionPage })),
);
const WorkoutSummaryPage = lazy(() =>
  import('../features/workouts/WorkoutSummaryPage').then((m) => ({ default: m.WorkoutSummaryPage })),
);
const HistoryPage = lazy(() =>
  import('../features/analytics/HistoryPage').then((m) => ({ default: m.HistoryPage })),
);
const AnalyticsPage = lazy(() =>
  import('../features/analytics/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
);
const GoalsPage = lazy(() =>
  import('../features/goals/GoalsPage').then((m) => ({ default: m.GoalsPage })),
);
const SettingsPage = lazy(() =>
  import('../features/sync/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);

function PageLoader() {
  return (
    <div className="flex h-[60dvh] w-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
    </div>
  );
}

function withSuspense(Component: React.ComponentType) {
  return (
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'workouts', element: withSuspense(WorkoutsPage) },
      { path: 'history', element: withSuspense(HistoryPage) },
      { path: 'stats', element: withSuspense(AnalyticsPage) },
      { path: 'goals', element: withSuspense(GoalsPage) },
      { path: 'settings', element: withSuspense(SettingsPage) },
      { path: 'workout/:programId', element: withSuspense(ProgramDetailsPage) },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
  {
    path: '/workout/:programId/:dayId',
    element: withSuspense(WorkoutSessionPage),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/quick-workout',
    element: withSuspense(WorkoutSessionPage),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/workout/summary/:sessionId',
    element: withSuspense(WorkoutSummaryPage),
    errorElement: <ErrorBoundary />,
  }
], {
  basename: import.meta.env.BASE_URL === './' ? '/' : (import.meta.env.BASE_URL || '/')
});

export function AppRouter() {
  return <RouterProvider router={router} />;
}
