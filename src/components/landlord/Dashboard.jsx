import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../shared/Card';
import Button from '../shared/Button';
import { useAuth } from '../../context/AuthContext';
import { getLandlordStats } from '../../lib/supabaseService';

export default function LandlordDashboard() {
    const navigate = useNavigate();
    const { profile, signOut } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const data = await getLandlordStats();
            setStats(data);
        } catch (err) {
            setError('Failed to load dashboard data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await signOut();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Landlord Dashboard</h1>
                            <p className="text-gray-600 mt-1">Welcome back, {profile?.full_name || 'Landlord'}!</p>
                        </div>
                        <Button onClick={handleLogout}>Logout</Button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="bg-white rounded-xl p-6 animate-pulse">
                                <div className="h-8 w-8 bg-gray-200 rounded mb-3"></div>
                                <div className="h-8 bg-gray-200 rounded mb-2"></div>
                                <div className="h-4 bg-gray-100 rounded w-2/3"></div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                                <div className="text-4xl mb-2">🏢</div>
                                <div className="text-3xl font-bold">{stats?.totalPGs ?? 0}</div>
                                <div className="text-blue-100">Total PGs</div>
                            </Card>

                            <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
                                <div className="text-4xl mb-2">🚪</div>
                                <div className="text-3xl font-bold">{stats?.totalRooms ?? 0}</div>
                                <div className="text-green-100">Total Rooms</div>
                            </Card>

                            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                                <div className="text-4xl mb-2">👥</div>
                                <div className="text-3xl font-bold">{stats?.totalTenants ?? 0}</div>
                                <div className="text-purple-100">Total Tenants</div>
                            </Card>

                            <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                                <div className="text-4xl mb-2">⚠️</div>
                                <div className="text-3xl font-bold">{stats?.urgentComplaints ?? 0}</div>
                                <div className="text-orange-100">Urgent Complaints</div>
                            </Card>
                        </div>

                        {/* Rent Collection */}
                        <div className="grid md:grid-cols-2 gap-6 mb-8">
                            <Card>
                                <h3 className="text-xl font-semibold mb-4 flex items-center">
                                    <span className="text-2xl mr-2">💰</span>
                                    Rent Collected This Month
                                </h3>
                                <div className="text-3xl font-bold text-green-600">
                                    ₹{(stats?.rentCollected ?? 0).toLocaleString()}
                                </div>
                            </Card>

                            <Card>
                                <h3 className="text-xl font-semibold mb-4 flex items-center">
                                    <span className="text-2xl mr-2">⏳</span>
                                    Pending Rent
                                </h3>
                                <div className="text-3xl font-bold text-orange-600">
                                    ₹{(stats?.pendingRent ?? 0).toLocaleString()}
                                </div>
                            </Card>
                        </div>
                    </>
                )}

                {/* Quick Actions */}
                <Card>
                    <h3 className="text-xl font-semibold mb-6">Quick Actions</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Button variant="outline" className="flex flex-col items-center py-6" onClick={() => navigate('/landlord/properties')}>
                            <span className="text-3xl mb-2">🏠</span>
                            <span>View Properties</span>
                        </Button>
                        <Button variant="outline" className="flex flex-col items-center py-6" onClick={() => navigate('/landlord/tenants')}>
                            <span className="text-3xl mb-2">👤</span>
                            <span>Manage Tenants</span>
                        </Button>
                        <Button variant="outline" className="flex flex-col items-center py-6" onClick={() => navigate('/landlord/rent')}>
                            <span className="text-3xl mb-2">💵</span>
                            <span>Rent Tracking</span>
                        </Button>
                        <Button variant="outline" className="flex flex-col items-center py-6" onClick={() => navigate('/landlord/complaints')}>
                            <span className="text-3xl mb-2">📋</span>
                            <span>Complaints</span>
                        </Button>
                    </div>
                </Card>
            </main>
        </div>
    );
}
