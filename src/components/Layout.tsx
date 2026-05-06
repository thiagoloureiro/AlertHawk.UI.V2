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

  return (
    <div className="flex h-screen dark:bg-gray-900 bg-gray-50">
      {!isKioskMode && (
        <Sidebar 
          isCollapsed={isSidebarCollapsed} 
          toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          currentPage=""
          onNavigate={() => {}}
        />
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!isKioskMode && (
          <TopBar 
            theme={theme}
            onThemeChange={onThemeChange}
          />
        )}
        <main className={`flex-1 ${isKioskMode ? 'overflow-hidden' : 'overflow-auto'}`}>
          {children}
        </main>
      </div>
    </div>
  );
} 