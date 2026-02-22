import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CreateConsultPage from './pages/CreateConsultPage';
import ConsultListPage from './pages/ConsultListPage';
import ConsultDetailPage from './pages/ConsultDetailPage';
import ReviewPage from './pages/ReviewPage';
import SchedulePage from './pages/SchedulePage';
import NotificationsPage from './pages/NotificationsPage';
import AdminPage from './pages/AdminPage';

function ProtectedRoute({ children, roles }) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return children;
}

export default function App() {

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: '10px',
            background: '#1e293b',
            color: '#f8fafc',
            fontSize: '14px',
          },
        }}
      />
      <Routes>
        {/* Open-access landing page (consult form + doctor login) */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<Navigate to="/" replace />} />

        {/* Protected admin / doctor routes */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="consults" element={<ConsultListPage />} />
          <Route path="consults/new" element={<CreateConsultPage />} />
          <Route path="consults/:id" element={<ConsultDetailPage />} />
          <Route
            path="consults/:id/review"
            element={
              <ProtectedRoute roles={['registrar', 'senior_registrar', 'consultant']}>
                <ReviewPage />
              </ProtectedRoute>
            }
          />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route
            path="admin"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminPage />
              </ProtectedRoute>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
