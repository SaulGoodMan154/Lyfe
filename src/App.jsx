import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import LandingPage from './components/LandingPage';
import Login from './components/auth/Login';
import Signup from './components/auth/Signup';
import TenantLogin from './components/auth/TenantLogin';
import ProtectedRoute from './components/auth/ProtectedRoute';

// Landlord Components
import LandlordDashboard from './components/landlord/Dashboard';
import PGSetupWizard from './components/landlord/PGSetup/SetupWizard';
import PropertyList from './components/landlord/PropertyManagement/PropertyList';
import TenantList from './components/landlord/TenantManagement/TenantList';
import PaymentDashboard from './components/landlord/RentTracking/PaymentDashboard';
import ComplaintList from './components/landlord/Complaints/ComplaintList';

// Tenant Components
import TenantDashboard from './components/tenant/Dashboard';
import RaiseComplaint from './components/tenant/RaiseComplaint';
import MyComplaints from './components/tenant/MyComplaints';
import PaymentHistory from './components/tenant/PaymentHistory';

import './index.css';

// Auto-redirect logged-in users from landing page
function LandingPageWrapper() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && profile) {
      if (profile.role === 'landlord') navigate('/landlord/dashboard');
      else navigate('/tenant/dashboard');
    }
  }, [profile, loading, navigate]);

  return <LandingPage />;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPageWrapper />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/tenant-login" element={<TenantLogin />} />

          {/* Landlord Routes */}
          <Route path="/landlord/dashboard" element={
            <ProtectedRoute requiredRole="landlord"><LandlordDashboard /></ProtectedRoute>
          } />
          <Route path="/landlord/pg-setup" element={
            <ProtectedRoute requiredRole="landlord"><PGSetupWizard /></ProtectedRoute>
          } />
          <Route path="/landlord/properties" element={
            <ProtectedRoute requiredRole="landlord"><PropertyList /></ProtectedRoute>
          } />
          <Route path="/landlord/tenants" element={
            <ProtectedRoute requiredRole="landlord"><TenantList /></ProtectedRoute>
          } />
          <Route path="/landlord/rent" element={
            <ProtectedRoute requiredRole="landlord"><PaymentDashboard /></ProtectedRoute>
          } />
          <Route path="/landlord/complaints" element={
            <ProtectedRoute requiredRole="landlord"><ComplaintList /></ProtectedRoute>
          } />

          {/* Tenant Routes */}
          <Route path="/tenant/dashboard" element={
            <ProtectedRoute requiredRole="tenant"><TenantDashboard /></ProtectedRoute>
          } />
          <Route path="/tenant/raise-complaint" element={
            <ProtectedRoute requiredRole="tenant"><RaiseComplaint /></ProtectedRoute>
          } />
          <Route path="/tenant/my-complaints" element={
            <ProtectedRoute requiredRole="tenant"><MyComplaints /></ProtectedRoute>
          } />
          <Route path="/tenant/payment-history" element={
            <ProtectedRoute requiredRole="tenant"><PaymentHistory /></ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
