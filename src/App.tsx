import React, { Component, ErrorInfo, ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './components/ThemeProvider';
import { Toaster } from './components/ui/sonner';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CalendarPage from './pages/CalendarPage';
import GroupsPage from './pages/GroupsPage';
import JoinPage from './pages/JoinPage';
import SettingsPage from './pages/SettingsPage';
import InputTransactionPage from './pages/InputTransactionPage';
import ReportPage from './pages/ReportPage';
import PredictPage from './pages/PredictPage';
import HoroscopePage from './pages/HoroscopePage';

// Layout
import Layout from './components/layout/Layout';
import { TransactionsProvider } from './contexts/TransactionsContext';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen w-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px", wordBreak: "break-all" }}>
          <h2>문제가 발생했습니다.</h2>
          <p style={{ color: "red", fontWeight: "bold" }}>{this.state.error?.message}</p>
          <button onClick={() => (this as any).setState({ hasError: false })} style={{ padding: '8px', background: 'blue', color: 'white', borderRadius: '4px', marginTop: '10px' }}>다시 시도</button>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

export default function App() {
  console.log("App component loaded. Location:", window.location.pathname, window.location.hash);
  return (
    <ThemeProvider defaultTheme="light" storageKey="syncledger-theme">
      <BrowserRouter>
        <AuthProvider>
          <TransactionsProvider>
            <ErrorBoundary>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/invite/:groupId" element={<JoinPage />} />
                <Route path="/join/:groupId" element={<JoinPage />} />

                <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                  <Route index element={<DashboardPage />} />
                  <Route path="report" element={<ReportPage />} />
                  <Route path="predict" element={<PredictPage />} />
                  <Route path="calendar" element={<CalendarPage />} />
                  <Route path="horoscope" element={<HoroscopePage />} />
                  <Route path="input" element={<InputTransactionPage />} />
                  <Route path="groups/*" element={<GroupsPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </ErrorBoundary>
          </TransactionsProvider>
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
