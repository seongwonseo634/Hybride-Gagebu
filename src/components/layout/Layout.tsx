import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Home, Calendar, PlusCircle, Settings, Moon, Sun, PieChart as PieChartIcon, Sparkles, WifiOff, Users } from 'lucide-react';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { useTheme } from '../ThemeProvider';
import { FinancialChat } from '../FinancialChat';
import { useTransactions } from '../../contexts/TransactionsContext';
import HelpDialog from '../HelpDialog';
import { toast } from 'sonner';

export default function Layout() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { transactions } = useTransactions();
  
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('인터넷에 다시 연결되었습니다.');
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error('인터넷 연결이 끊겼습니다. 오프라인 모드로 전환합니다.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Member is restricted based on user role
  const isMemberLimited = false;

  const navItems = [
    { icon: Home, label: '홈', path: '/' },
    { icon: PieChartIcon, label: '리포트', path: '/report' },
    { icon: Calendar, label: '달력', path: '/calendar' },
    { icon: Sparkles, label: '운세', path: '/horoscope' },
    { icon: Users, label: '모임', path: '/groups' },
    { icon: Settings, label: '설정', path: '/settings' },
  ];

  
  // Only show "모임" if restricted, otherwise show all items
  const filteredNavItems = navItems;


  return (
    <div className="flex flex-col h-screen w-full mx-auto overflow-hidden relative" style={{ backgroundColor: 'var(--neo-bg)' }}>
      {/* Top Header */}
      <header className="flex justify-between items-center px-3 md:px-8 py-3 md:py-4 z-10 neo rounded-b-2xl mb-2 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <h1 className="text-lg md:text-xl font-bold tracking-tight text-primary px-1 hidden xs:block">하이브리드 가계부</h1>
          <h1 className="text-lg font-bold text-primary px-1 xs:hidden">가계부</h1>
          {!isOnline && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-[10px] font-bold border border-red-200">
              <WifiOff size={10} />
            </div>
          )}
        </div>
        <div className="flex items-center space-x-1.5 md:space-x-4">
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <HelpDialog />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-24 scroll-smooth">
        <Outlet />
      </main>

      <FinancialChat contextData={{ transactions }} />

      {/* Bottom Navigation */}
      <nav className="absolute bottom-0 w-full z-20 pb-safe">
        {/* Plus Button - Positioned Centered Above Nav */}
        <button 
          onClick={() => navigate('/input')}
          className="absolute left-1/2 -translate-x-1/2 -translate-y-12 flex items-center justify-center w-14 h-14 rounded-full transition-all neo-button bg-emerald-500 text-white hover:opacity-90 active:scale-95 z-30"
        >
          <PlusCircle size={28} />
        </button>

         <div className="mx-auto w-fit px-2 py-1 flex items-center gap-1 neo rounded-full bg-background/80 backdrop-blur">
          {filteredNavItems.map((item, index) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          
          return (
            <button
              key={index}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center space-y-0 transition-colors w-12 h-11 rounded-lg ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              } ${isActive ? 'neo-inset' : ''}`}
            >
              <item.icon size={16} className={isActive ? 'stroke-[2.5px]' : 'stroke-2'} />
              <span className="text-[9px] font-bold">{item.label}</span>
            </button>
          )
        })}
        </div>
      </nav>
    </div>
  )
}
