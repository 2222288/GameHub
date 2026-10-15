import { createBrowserRouter, useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';
import { PublicLayout } from '@/layouts/PublicLayout';
import { AdminLayout } from '@/layouts/AdminLayout';
function RouteLoading() {
  return (
    <div className="container-page py-20 text-ink-2" role="status">
      正在加载 GameHub…
    </div>
  );
}
function RouteError() {
  const error = useRouteError();
  return (
    <div className="container-page py-20 text-center">
      <h1 className="text-2xl font-bold">
        {isRouteErrorResponse(error) && error.status === 404 ? '页面不存在' : '页面暂时无法加载'}
      </h1>
      <p className="mt-4 text-ink-2">请返回首页，或刷新页面后重试。</p>
      <Link to="/" className="btn btn-primary mt-6">
        返回首页
      </Link>
      <button className="btn btn-secondary ml-3" onClick={() => location.reload()}>
        刷新页面
      </button>
    </div>
  );
}
export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    errorElement: <RouteError />,
    HydrateFallback: RouteLoading,
    children: [
      {
        path: '/',
        lazy: () => import('@/pages/HomePage').then((module) => ({ Component: module.default })),
      },
      {
        path: '/games',
        lazy: () => import('@/pages/GamesPage').then((module) => ({ Component: module.default })),
      },
      {
        path: '/games/:slug',
        lazy: () =>
          import('@/pages/GameDetailPage').then((module) => ({ Component: module.default })),
      },
      {
        path: '/search',
        lazy: () => import('@/pages/SearchPage').then((module) => ({ Component: module.default })),
      },
      {
        path: '/community',
        lazy: () =>
          import('@/pages/CommunityPage').then((module) => ({ Component: module.default })),
      },
      {
        path: '*',
        lazy: () =>
          import('@/pages/NotFoundPage').then((module) => ({ Component: module.default })),
      },
    ],
  },
  {
    path: '/admin/login',
    errorElement: <RouteError />,
    HydrateFallback: RouteLoading,
    lazy: () =>
      import('@/pages/admin/AdminLoginPage').then((module) => ({ Component: module.default })),
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    errorElement: <RouteError />,
    HydrateFallback: RouteLoading,
    children: [
      {
        index: true,
        lazy: () =>
          import('@/pages/admin/AdminDashboardPage').then((module) => ({
            Component: module.default,
          })),
      },
      {
        path: 'games',
        lazy: () =>
          import('@/pages/admin/AdminGamesPage').then((module) => ({ Component: module.default })),
      },
      {
        path: 'games/create',
        lazy: () =>
          import('@/pages/admin/AdminGameEditorPage').then((module) => ({
            Component: module.default,
          })),
      },
      {
        path: 'games/:id/edit',
        lazy: () =>
          import('@/pages/admin/AdminGameEditorPage').then((module) => ({
            Component: module.default,
          })),
      },
      {
        path: 'categories',
        lazy: () =>
          import('@/pages/admin/AdminCategoriesPage').then((module) => ({
            Component: module.default,
          })),
      },
      {
        path: 'tags',
        lazy: () =>
          import('@/pages/admin/AdminTagsPage').then((module) => ({ Component: module.default })),
      },
      {
        path: 'links',
        lazy: () =>
          import('@/pages/admin/AdminLinksPage').then((module) => ({ Component: module.default })),
      },
      {
        path: 'reports',
        lazy: () =>
          import('@/pages/admin/AdminReportsPage').then((module) => ({
            Component: module.default,
          })),
      },
    ],
  },
]);
