import React from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

interface LayoutProps {
  children: React.ReactNode;
  isDarkTheme: boolean;
  onThemeToggle: () => void;
}

export function Layout({ children, isDarkTheme, onThemeToggle }: LayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved !== null ? JSON.parse(saved) : false;
  });

  return (
    <div className="flex h-screen dark:bg-gray-900 bg-gray-50">
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        currentPage=""
        onNavigate={() => {}}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar 
          isDarkTheme={isDarkTheme}
          onThemeToggle={onThemeToggle}
        />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
} 