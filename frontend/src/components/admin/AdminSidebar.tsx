import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Gamepad2, Folder, Tags, Link2, Flag } from 'lucide-react';

const C = (...x: number[]) => String.fromCharCode(...x);

export const adminNavItems = [
  ['/admin', C(27010, 34920, 26495), LayoutDashboard, true],
  ['/admin/games', C(28216, 25103, 31649, 29702), Gamepad2, false],
  ['/admin/categories', C(20998, 31867, 31649, 29702), Folder, false],
  ['/admin/tags', C(26631, 31614, 31649, 29702), Tags, false],
  ['/admin/links', C(36164, 28304, 38142, 25509), Link2, false],
  ['/admin/reports', C(22833, 25928, 21453, 39304), Flag, false],
] as const;

export function AdminSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-line bg-surface lg:block">
      <div className="flex h-16 items-center border-b border-line px-5 text-xl font-black">
        Game<span className="text-brand">Hub</span>
        <span className="ml-2 text-xs font-medium text-ink-3">Admin</span>
      </div>
      <nav className="space-y-1 p-3">
        {adminNavItems.map(([to, label, Icon, end]) => (
          <NavLink
            end={end}
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${isActive ? 'bg-brand-soft text-brand' : 'text-ink-2 hover:bg-panel hover:text-brand'}`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
