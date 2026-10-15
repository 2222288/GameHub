import { useState } from 'react';
import { LogOut, Menu, X } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/stores/auth';
import { adminNavItems } from './AdminSidebar';

const C = (...x: number[]) => String.fromCharCode(...x);

export function AdminHeader() {
  const [open, setOpen] = useState(false);
  const logout = useAuth((s) => s.logout);
  const nav = useNavigate();

  const signOut = () => {
    logout();
    nav('/admin/login');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur lg:ml-60">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-5">
        <button
          className="btn btn-secondary px-2.5 lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="管理员菜单"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">
            GameHub {C(31649, 29702, 21518, 21488)}
          </div>
          <div className="hidden text-xs text-ink-3 sm:block">
            {C(20869, 23481, 12289, 36164, 28304, 19982, 36816, 33829)}
          </div>
        </div>
        <button className="btn btn-secondary" onClick={signOut}>
          <LogOut size={16} />
          <span className="hidden sm:inline">{C(36864, 20986)}</span>
        </button>
      </div>
      {open && (
        <nav className="border-t border-line bg-surface p-3 lg:hidden">
          <div className="grid gap-1 sm:grid-cols-2">
            {adminNavItems.map(([to, label, Icon, end]) => (
              <NavLink
                end={end}
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${isActive ? 'bg-brand-soft text-brand' : 'text-ink-2 hover:bg-panel'}`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
