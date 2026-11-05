import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';

// Pages
import { LandingPage } from './pages/landing/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { WebsitesPage } from './pages/websites/WebsitesPage';
import { ExposuresPage } from './pages/exposures/ExposuresPage';
import { RemovalRequestsPage } from './pages/removals/RemovalRequestsPage';
import { CategoriesPage } from './pages/categories/CategoriesPage';
import { RemindersPage } from './pages/reminders/RemindersPage';
import { NotificationsPage } from './pages/notifications/NotificationsPage';
import { AuditLogsPage } from './pages/audit/AuditLogsPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <NotificationProvider>
              <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected Application Routes */}
              <Route
                path="/app"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="websites" element={<WebsitesPage />} />
                <Route path="exposures" element={<ExposuresPage />} />
                <Route path="removal-requests" element={<RemovalRequestsPage />} />
                <Route path="categories" element={<CategoriesPage />} />
                <Route path="reminders" element={<RemindersPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="audit-logs" element={<AuditLogsPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              {/* 404 Catch-All */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </NotificationProvider>
        </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;
