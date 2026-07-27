'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger,
  DropdownMenuGroup
} from '@/components/ui/dropdown-menu';
import { 
  LayoutDashboard, 
  Video, 
  CalendarPlus, 
  User as UserIcon, 
  LogOut, 
  Menu, 
  X,
  Sun,
  Moon,
  Laptop,
  Settings as SettingsIcon
} from 'lucide-react';
import Link from 'next/link';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Meetings', href: '/meetings', icon: Video },
  { name: 'Schedule Meeting', href: '/schedule', icon: CalendarPlus },
  { name: 'Profile', href: '/profile', icon: UserIcon },
  { name: 'Settings', href: '/settings', icon: SettingsIcon },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  const applyTheme = (t: 'light' | 'dark' | 'system') => {
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (t === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      // Resolve system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

  // Load theme preference on mount
  useEffect(() => {
    const storedTheme = localStorage.getItem('zoom_clone_theme') as 'light' | 'dark' | 'system' | null;
    const initialTheme = storedTheme || 'system';
    setTheme(initialTheme);
    applyTheme(initialTheme);

    // Watch for system preference changes if theme is set to 'system'
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      const currentStored = localStorage.getItem('zoom_clone_theme');
      if (!currentStored || currentStored === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, []);

  const toggleTheme = () => {
    let nextTheme: 'light' | 'dark' | 'system';
    if (theme === 'light') nextTheme = 'dark';
    else if (theme === 'dark') nextTheme = 'system';
    else nextTheme = 'light';
    
    setTheme(nextTheme);
    localStorage.setItem('zoom_clone_theme', nextTheme);
    applyTheme(nextTheme);
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-muted-foreground gap-4">
        <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-xs font-medium tracking-wide text-muted-foreground">Securing session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const getPageTitle = () => {
    const matched = navItems.find(item => item.href === pathname);
    return matched ? matched.name : 'Workspace';
  };

  const renderThemeIcon = () => {
    if (theme === 'light') return <Sun className="h-4 w-4 text-amber-500" />;
    if (theme === 'dark') return <Moon className="h-4 w-4 text-indigo-400" />;
    return <Laptop className="h-4 w-4 text-muted-foreground" />;
  };

  const getThemeTitle = () => {
    if (theme === 'light') return 'Theme: Light';
    if (theme === 'dark') return 'Theme: Dark';
    return 'Theme: System';
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row relative transition-colors duration-200">
      {/* Mobile Sidebar Backdrop overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/20 dark:bg-black/50 backdrop-blur-xs md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - Desktop Layout */}
      <aside className="hidden md:flex flex-col w-60 bg-sidebar border-r border-border fixed inset-y-0 left-0 z-30 transition-colors duration-200">
        {/* Workspace Brand details */}
        <div className="h-14 flex items-center gap-3 px-6 border-b border-border/80">
          <div className="bg-primary/10 p-1.5 rounded-lg text-primary shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
          </div>
          <span className="font-bold text-xs tracking-tight text-foreground select-none">Zoom Clone</span>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 px-3.5 py-5 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 group relative ${
                  isActive 
                    ? 'bg-zinc-200/50 dark:bg-zinc-800/50 text-foreground font-semibold' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-zinc-150/40 dark:hover:bg-zinc-800/15'
                }`}
              >
                {/* Thin vertical blue stripe for selected Apple list indicators */}
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-primary rounded-r" />
                )}
                <Icon className={`h-4 w-4 shrink-0 transition-colors duration-150 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Desktop Profile Info Footer */}
        <div className="p-3.5 border-t border-border/80 bg-sidebar">
          <div className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/40">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center overflow-hidden border border-border shrink-0">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt={user.full_name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[10px] font-bold text-muted-foreground">{user?.full_name.charAt(0)}</span>
                )}
              </div>
              <div className="w-20">
                <p className="text-[10px] font-bold truncate text-foreground leading-none">{user?.full_name}</p>
                <p className="text-[8px] text-muted-foreground truncate mt-1 leading-none">{user?.email}</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={logout} 
              className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 h-6.5 w-6.5 rounded-md cursor-pointer"
              title="Logout"
            >
              <LogOut className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Sidebar - Mobile Menu Drawer */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-60 bg-sidebar border-r border-border flex flex-col transform transition-transform duration-300 ease-in-out md:hidden ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="h-14 flex items-center justify-between px-5 border-b border-border/80">
          <div className="flex items-center gap-2.5">
            <div className="bg-primary/10 p-1.5 rounded-lg text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
            </div>
            <span className="font-bold text-xs tracking-tight text-foreground">Zoom Clone</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} className="text-muted-foreground hover:bg-muted h-7 w-7">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all relative ${
                  isActive 
                    ? 'bg-zinc-200/50 dark:bg-zinc-800/50 text-foreground font-semibold' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-zinc-150/40 dark:hover:bg-zinc-800/15'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-primary rounded-r" />
                )}
                <Icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border bg-sidebar">
          <div className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/40">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center overflow-hidden border border-border shrink-0">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt={user.full_name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[10px] font-bold text-muted-foreground">{user?.full_name.charAt(0)}</span>
                )}
              </div>
              <div className="w-20">
                <p className="text-[10px] font-bold truncate text-foreground leading-none">{user?.full_name}</p>
                <p className="text-[8px] text-muted-foreground truncate mt-1 leading-none">{user?.email}</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={logout} 
              className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 h-6.5 w-6.5 rounded-md"
            >
              <LogOut className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Panel Content Container */}
      <div className="flex-1 md:pl-60 flex flex-col min-h-screen">
        {/* Sticky Top Header Navigation */}
        <header className="h-14 border-b border-border/80 bg-background/80 backdrop-blur sticky top-0 z-20 flex items-center justify-between px-5 shrink-0 transition-colors duration-200">
          <div className="flex items-center gap-3 min-w-0">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setMobileOpen(true)} 
              className="md:hidden text-muted-foreground hover:bg-muted h-7 w-7 shrink-0"
            >
              <Menu className="h-4 w-4" />
            </Button>
            
            {/* SaaS breadcrumb page hierarchy */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold tracking-wide truncate">
              <span className="hover:text-foreground cursor-pointer">Zoom Clone</span>
              <span className="text-muted-foreground/50">/</span>
              <span className="text-foreground font-bold">{getPageTitle()}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Persistent Theme Switcher Toggle (Light, Dark, System cycle) */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleTheme}
              className="h-7.5 w-7.5 rounded-md text-muted-foreground hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 cursor-pointer shrink-0"
              title={getThemeTitle()}
            >
              {renderThemeIcon()}
            </Button>

            {/* User Profile avatar dropdown menu */}
            <DropdownMenu>
              <DropdownMenuTrigger className="relative h-7.5 w-7.5 rounded-md bg-muted border border-border hover:border-border-hover p-0 flex items-center justify-center overflow-hidden focus:outline-none cursor-pointer shrink-0">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt={user.full_name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[10px] font-bold text-muted-foreground">{user?.full_name.charAt(0)}</span>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-52 bg-popover border-border text-popover-foreground shadow-sm rounded-lg" align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-xs font-bold leading-none text-foreground">{user?.full_name}</p>
                      <p className="text-[10px] leading-none text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem className="focus:bg-muted focus:text-foreground cursor-pointer text-xs">
                  <Link href="/profile" className="flex w-full items-center">
                    <UserIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-semibold">My Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="focus:bg-muted focus:text-foreground cursor-pointer text-xs">
                  <Link href="/settings" className="flex w-full items-center">
                    <SettingsIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-semibold">Preferences</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem 
                  onClick={logout} 
                  className="focus:bg-red-500/10 focus:text-red-650 cursor-pointer text-red-500 text-xs"
                >
                  <LogOut className="mr-2 h-3.5 w-3.5" />
                  <span className="font-semibold">Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content Body Pane */}
        <main className="flex-1 p-6 md:p-8 bg-background overflow-y-auto transition-colors duration-200">
          {children}
        </main>
      </div>
    </div>
  );
}
