import React from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

interface LayoutProps {
  children: React.ReactNode;
  theme: 'light' | 'dark' | 'darcula' | 'monokai' | 'github-dark';
  onThemeChange: (theme: 'light' | 'dark' | 'darcula' | 'monokai' | 'github-dark') => void;
}

export function Layout({ children, theme, onThemeChange }: LayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved !== null ? JSON.parse(saved) : false;
  });

  const [isKioskMode, setIsKioskMode] = React.useState(() => {
    return document.documentElement.classList.contains('ah-kiosk-mode');
  });

  React.useEffect(() => {
    const handleKioskMode = (e: Event) => {
      const custom = e as CustomEvent<{ isKioskMode: boolean }>;
      setIsKioskMode(Boolean(custom.detail?.isKioskMode));
    };

    window.addEventListener('ah:kiosk-mode', handleKioskMode);
    return () => window.removeEventListener('ah:kiosk-mode', handleKioskMode);
  }, []);

  const toggleSidebar = React.useCallback(() => {
    setIsSidebarCollapsed((prev: boolean) => {
      const next = !prev;
      try {
        localStorage.setItem('sidebarCollapsed', JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      {!isKioskMode && (
        <Sidebar 
          isCollapsed={isSidebarCollapsed} 
          toggleSidebar={toggleSidebar}
          currentPage=""
          onNavigate={() => {}}
        />
      )}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {!isKioskMode && (
          <TopBar 
            theme={theme}
            onThemeChange={onThemeChange}
          />
        )}
        <main className={`flex-1 min-h-0 ${isKioskMode ? 'overflow-hidden' : 'overflow-auto'}`}>
          {children}
        </main>
      </div>
    </div>
  );
} 