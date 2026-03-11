import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Loading from '../shared/Loading';

export default function ProtectedRoute({ children, requiredRole }) {
    const { user, profile, loading } = useAuth();

    if (loading) return <Loading />;

    if (!user) {
        // Send tenants to their own login page, landlords to the main login
        return <Navigate to={requiredRole === 'tenant' ? '/tenant-login' : '/login'} replace />;
    }

    if (requiredRole && profile?.role !== requiredRole) {
        // Redirect to the correct dashboard based on actual role
        if (profile?.role === 'landlord') return <Navigate to="/landlord/dashboard" replace />;
        if (profile?.role === 'tenant') return <Navigate to="/tenant/dashboard" replace />;
        return <Navigate to="/login" replace />;
    }

    return children;
}
