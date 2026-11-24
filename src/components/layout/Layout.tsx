import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Dumbbell, BarChart3, Home, Trophy, Settings } from 'lucide-react';
import { cn } from '../../utils/cn';

export function Layout() {
  return (
    <div className="flex h-[100dvh] w-full justify-center bg-transparent text-content">
      {/* Mobile-First App Shell with Transparent Canvas so Liquid Mesh Blurs Through */}
      <div className="relative flex h-full w-full max-w-[460px] flex-col bg-transparent sm:border-x sm:border-content/10 sm:shadow-2xl">
        <main className="flex-1 overflow-y-auto overscroll-y-contain pb-28">
          <Outlet />
        </main>

        {/* Persistent Liquid Glass Bottom Navigation Bar */}
        <nav
          aria-label="Primary navigation"
          className="liquid-glass-strong fixed bottom-3 left-1/2 z-50 flex w-[calc(100%-1.5rem)] max-w-[436px] -translate-x-1/2 items-center justify-around rounded-[26px] px-2 py-1.5 pb-safe"
        >
          <BottomNavItem to="/workouts" icon={Dumbbell} label="Workouts" />
          <BottomNavItem to="/stats" icon={BarChart3} label="Stats" />
          <BottomNavItem to="/" icon={Home} label="Home" end isPrimaryHome />
          <BottomNavItem to="/goals" icon={Trophy} label="Goals" />
          <BottomNavItem to="/settings" icon={Settings} label="Settings" />
        </nav>
      </div>
    </div>
  );
}

function BottomNavItem({
  to,
  icon: Icon,
  label,
  end = false,
  isPrimaryHome = false,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  end?: boolean;
  isPrimaryHome?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-1.5 text-[10px] font-bold transition-all active:scale-95',
          isActive
            ? isPrimaryHome
              ? 'liquid-btn-primary text-white'
              : 'liquid-btn-subtle'
            : 'text-muted hover:text-content',
        )
      }
    >
      <Icon size={20} strokeWidth={2.2} />
      <span className="leading-none tracking-wide">{label}</span>
    </NavLink>
  );
}
