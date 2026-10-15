import { Outlet, Navigate } from 'react-router-dom';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { useAuth } from '@/stores/auth';
export function AdminLayout() {
  const token = useAuth((s) => s.token);
  if (!token) return <Navigate to="/admin/login" replace />;
  return (
    <div className="min-h-screen bg-page text-ink">
      <AdminSidebar />
      <AdminHeader />
      <main className="p-4 lg:ml-60 lg:p-7">
        <Outlet />
      </main>
    </div>
  );
}
