import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../shared/Card';
import Button from '../shared/Button';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { getTenantDashboardData } from '../../lib/supabaseService';

export default function TenantDashboard() {
    const navigate = useNavigate();
    const { profile, signOut } = useAuth();
    const [dashData, setDashData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isUnlinked, setIsUnlinked] = useState(false);

    // Recovery form state for Bug 4 — tenant confirmed email on different device
    const [linkContact, setLinkContact] = useState('');
    const [linkLoading, setLinkLoading] = useState(false);
    const [linkError, setLinkError] = useState('');

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        setError('');
        setIsUnlinked(false);
        try {
            const data = await getTenantDashboardData();
            setDashData(data);
        } catch (err) {
            if (err.message?.includes('No active tenant record')) {
                setIsUnlinked(true);
            } else {
                setError('Failed to load your dashboard. Please try again.');
            }
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Bug 4 recovery: let tenant type their contact number to link on this device
    const handleLinkAccount = async (e) => {
        e.preventDefault();
        setLinkError('');
        setLinkLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: linked, error: linkErr } = await supabase.rpc('link_tenant_to_user', {
                p_user_id: user.id,
                p_contact: linkContact.trim(),
            });
            if (linkErr) throw linkErr;
            if (!linked || linked.length === 0) {
                setLinkError('No tenant record found for this contact number. Please check with your landlord.');
                return;
            }
            // Success — re-fetch dashboard
            await fetchData();
        } catch (err) {
            setLinkError(err.message || 'Linking failed. Please try again.');
        } finally {
            setLinkLoading(false);
        }
    };

    // Bug 3 fix — navigate to tenant login, not landlord login
    const handleLogout = async () => {
        await signOut();
        navigate('/tenant-login');
    };

    const getRentStatusColor = (status) => {
        switch (status) {
            case 'paid': return 'text-green-600 bg-green-50';
            case 'pending': return 'text-orange-600 bg-orange-50';
            case 'overdue': return 'text-red-600 bg-red-50';
            default: return 'text-gray-600 bg-gray-50';
        }
    };

    const tenant = dashData?.tenant;
    const currentPayment = dashData?.currentPayment;
    const activeComplaints = dashData?.activeComplaints ?? 0;

    // Bug 2 fix — prefer tenant table's full_name (landlord-entered) over profile name (may be phone number)
    const displayName = tenant?.full_name || profile?.full_name || 'Tenant';

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Tenant Dashboard</h1>
                            <p className="text-gray-600 mt-1">Welcome, {displayName}!</p>
                        </div>
                        <Button onClick={handleLogout}>Logout</Button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* Bug 4 recovery — show link form if account is not linked */}
                {isUnlinked && (
                    <div className="mb-6 p-6 bg-yellow-50 border border-yellow-200 rounded-xl">
                        <h2 className="text-lg font-semibold text-yellow-900 mb-1">Your account isn't linked yet</h2>
                        <p className="text-yellow-700 text-sm mb-4">
                            Enter the contact number your landlord recorded when adding you. It must match exactly.
                        </p>
                        <form onSubmit={handleLinkAccount} className="flex flex-col sm:flex-row gap-3 max-w-md">
                            <input
                                type="text"
                                value={linkContact}
                                onChange={(e) => setLinkContact(e.target.value)}
                                placeholder="Contact number (e.g. 9629200000)"
                                className="flex-1 px-4 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none text-sm"
                                required
                            />
                            <button
                                type="submit"
                                disabled={linkLoading}
                                className="px-5 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded-lg transition disabled:opacity-60 text-sm whitespace-nowrap"
                            >
                                {linkLoading ? 'Linking...' : 'Link My Room'}
                            </button>
                        </form>
                        {linkError && <p className="mt-2 text-sm text-red-600">{linkError}</p>}
                        <p className="mt-3 text-xs text-yellow-600">
                            Can't link? Contact your landlord to verify the contact number on file.
                        </p>
                    </div>
                )}

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="space-y-6">
                        <div className="bg-white rounded-xl p-6 animate-pulse h-32"></div>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="bg-white rounded-xl p-6 animate-pulse h-48"></div>
                            <div className="bg-white rounded-xl p-6 animate-pulse h-48"></div>
                        </div>
                    </div>
                ) : !isUnlinked && (
                    <>
                        {/* Room Info */}
                        {tenant && (
                            <Card className="mb-8 bg-gradient-to-r from-primary-500 to-primary-600 text-white">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-2xl font-bold mb-2">{tenant.property_name}</h2>
                                        <p className="text-primary-100">Room Number: {tenant.room_number}</p>
                                        <p className="text-primary-100 text-sm mt-1">
                                            Move-in: {new Date(tenant.move_in_date).toLocaleDateString('en-IN')}
                                        </p>
                                    </div>
                                    <div className="text-6xl">🏠</div>
                                </div>
                            </Card>
                        )}

                        {/* Rent Status */}
                        <div className="grid md:grid-cols-2 gap-6 mb-8">
                            <Card>
                                <h3 className="text-xl font-semibold mb-4">Rent Status</h3>
                                {currentPayment ? (
                                    <>
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-gray-600">Current Month</span>
                                            <span className={`px-4 py-2 rounded-full font-semibold uppercase text-sm ${getRentStatusColor(currentPayment.status)}`}>
                                                {currentPayment.status}
                                            </span>
                                        </div>
                                        <div className="mb-4">
                                            <span className="text-gray-600">Amount: </span>
                                            <span className="text-2xl font-bold">₹{Number(currentPayment.amount).toLocaleString()}</span>
                                        </div>
                                        <div className="mb-6">
                                            <span className="text-gray-600">Due Date: </span>
                                            <span className="font-semibold">
                                                {new Date(currentPayment.due_date).toLocaleDateString('en-IN')}
                                            </span>
                                        </div>
                                        {currentPayment.status !== 'paid' && (
                                            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-orange-700 text-sm">
                                                Please contact your landlord to record your payment.
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-center py-6 text-gray-500">
                                        <div className="text-4xl mb-2">✅</div>
                                        <p>No pending payments this month</p>
                                    </div>
                                )}
                            </Card>

                            <Card>
                                <h3 className="text-xl font-semibold mb-4">Active Complaints</h3>
                                <div className="text-center py-8">
                                    <div className="text-5xl mb-4">📋</div>
                                    <div className="text-3xl font-bold text-gray-900 mb-2">{activeComplaints}</div>
                                    <p className="text-gray-600">Pending Resolution</p>
                                </div>
                            </Card>
                        </div>
                    </>
                )}

                {/* Quick Actions — always visible once logged in */}
                {!isUnlinked && (
                    <Card>
                        <h3 className="text-xl font-semibold mb-6">Quick Actions</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Button variant="outline" className="flex flex-col items-center py-6" onClick={() => navigate('/tenant/payment-history')}>
                                <span className="text-3xl mb-2">📜</span>
                                <span>Payment History</span>
                            </Button>
                            <Button variant="outline" className="flex flex-col items-center py-6" onClick={() => navigate('/tenant/raise-complaint')}>
                                <span className="text-3xl mb-2">🔧</span>
                                <span>Raise Complaint</span>
                            </Button>
                            <Button variant="outline" className="flex flex-col items-center py-6" onClick={() => navigate('/tenant/my-complaints')}>
                                <span className="text-3xl mb-2">📋</span>
                                <span>My Complaints</span>
                            </Button>
                        </div>
                    </Card>
                )}
            </main>
        </div>
    );
}
