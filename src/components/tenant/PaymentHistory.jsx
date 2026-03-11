import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../shared/Card';
import Button from '../shared/Button';
import { useAuth } from '../../context/AuthContext';
import { getTenantByUserId, getPaymentsByTenant } from '../../lib/supabaseService';

export default function PaymentHistory() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchPayments();
    }, []);

    const fetchPayments = async () => {
        try {
            const tenant = await getTenantByUserId(user.id);
            const data = await getPaymentsByTenant(tenant.id);
            setPayments(data);
        } catch (err) {
            setError('Failed to load payment history');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            paid: 'bg-green-100 text-green-800',
            pending: 'bg-orange-100 text-orange-800',
            overdue: 'bg-red-100 text-red-800',
        };
        return (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
                {status}
            </span>
        );
    };

    const getPaymentMethodBadge = (method) => {
        if (!method) return null;
        const styles = {
            upi: 'bg-purple-100 text-purple-800',
            cash: 'bg-gray-100 text-gray-800',
        };
        return (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${styles[method] || 'bg-gray-100 text-gray-800'}`}>
                {method.toUpperCase()}
            </span>
        );
    };

    const totalPaid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount), 0);

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Payment History</h1>
                            <p className="text-gray-600 mt-1">View all your rent payments</p>
                        </div>
                        <Button variant="outline" onClick={() => navigate('/tenant/dashboard')}>← Back</Button>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
                )}

                {/* Summary Card */}
                <Card className="mb-8 bg-gradient-to-r from-green-500 to-green-600 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-green-100 mb-1">Total Paid</p>
                            <p className="text-4xl font-bold">₹{totalPaid.toLocaleString()}</p>
                            <p className="text-green-100 mt-2">
                                {payments.filter(p => p.status === 'paid').length} payments
                            </p>
                        </div>
                        <div className="text-6xl">💰</div>
                    </div>
                </Card>

                {/* Payment List */}
                {loading ? (
                    <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="bg-white rounded-xl p-6 animate-pulse h-24"></div>
                        ))}
                    </div>
                ) : payments.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">No payment history available</div>
                ) : (
                    <div className="space-y-4">
                        {payments.map((payment) => (
                            <Card key={payment.id} hover>
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl
                      ${payment.status === 'paid' ? 'bg-green-100' : payment.status === 'overdue' ? 'bg-red-100' : 'bg-orange-100'}`}>
                                            {payment.status === 'paid' ? '✓' : '⏳'}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-lg">
                                                {new Date(payment.due_date).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                                            </h3>
                                            <p className="text-sm text-gray-600">
                                                Due: {new Date(payment.due_date).toLocaleDateString('en-IN')}
                                                {payment.paid_date && ` • Paid: ${new Date(payment.paid_date).toLocaleDateString('en-IN')}`}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="text-2xl font-bold text-gray-900">₹{Number(payment.amount).toLocaleString()}</p>
                                            <div className="flex gap-2 mt-1 justify-end">
                                                {getStatusBadge(payment.status)}
                                                {getPaymentMethodBadge(payment.payment_method)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
