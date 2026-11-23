import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Dumbbell, BarChart3, Home, Trophy, Settings } from 'lucide-react';
import { cn } from '../../utils/cn';

export function Layout() {
 return (
 <div className="flex h-[100dvh] flex-col bg-page text-content ">
 <main className="flex-1 overflow-y-auto pb-24">
 <Outlet />
 </main>

 <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-20 items-center justify-around bg-page/80 backdrop-blur-md px-2 pb-safe border-t border-content/5">
 <NavItem to="/workouts" icon={Dumbbell} label="Workout" />
 <NavItem to="/stats" icon={BarChart3} label="Stats" />

 {/* Elevated Home Button */}
 <NavLink
 to="/"
 className={({ isActive }) =>
 cn(
 'relative -top-6 flex h-16 w-16 flex-col items-center justify-center rounded-full bg-primary-500 text-white shadow-lg shadow-primary-500/40 transition-all duration-300 active:scale-95',
 isActive 
 ? 'bg-primary-400 shadow-[0_0_25px_var(--color-primary-400),0_0_50px_var(--color-primary-500)] scale-110' 
 : 'hover:bg-primary-400 hover:scale-105 hover:shadow-[0_0_20px_var(--color-primary-500)]'
 )
 }
 >
 <Home size={28}/>
 <span className="absolute -bottom-6 text-[10px] font-medium text-primary-400">Home</span>
 </NavLink>

 <NavItem to="/goals" icon={Trophy} label="Goals" />
 <NavItem to="/settings" icon={Settings} label="Settings" />
 </nav>
 </div>
 );
}

function NavItem({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) {
 return (
 <NavLink
 to={to}
 className={({ isActive }) =>
 cn(
 'flex flex-col items-center justify-center gap-1 p-2 text-[10px] font-bold transition-all duration-300',
 isActive 
 ? 'text-primary-400 [filter:drop-shadow(0_0_8px_var(--color-primary-500))_drop-shadow(0_0_12px_var(--color-primary-500))] scale-110' 
 : 'text-muted hover:text-muted hover:scale-105 hover:[filter:drop-shadow(0_0_4px_theme(colors.white/20))]'
 )
 }
 >
 <Icon size={24}/>
 <span className="tracking-wide">{label}</span>
 </NavLink>
 );
}
