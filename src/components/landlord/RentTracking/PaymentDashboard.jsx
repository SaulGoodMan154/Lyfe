import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../shared/Card';
import Button from '../../shared/Button';
import Input from '../../shared/Input';
import Modal from '../../shared/Modal';
import { getPayments, updatePayment, deletePayment, generateMonthlyPayments } from '../../../lib/supabaseService';

export default function RentTracking() {
    const navigate = useNavigate();
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

    // Modal states
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingPayment, setEditingPayment] = useState(null);
    const [deletingPayment, setDeletingPayment] = useState(null); // for delete confirmation

    const [generating, setGenerating] = useState(false);
    const [generateMsg, setGenerateMsg] = useState('');

    useEffect(() => { fetchPayments(); }, []);

    const fetchPayments = async () => {
        try {
            const data = await getPayments();
            setPayments(data);
        } catch (err) {
            setError('Failed to load payments');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePayment = async (updatedData) => {
        try {
            await updatePayment(editingPayment.id, updatedData);
            // Refresh list or update local state
            await fetchPayments();
            setIsEditModalOpen(false);
            setEditingPayment(null);
        } catch (err) {
            alert('Failed to update payment: ' + err.message);
        }
    };

    const handleDeletePayment = async () => {
        if (!deletingPayment) return;
        try {
            await deletePayment(deletingPayment.id);
            setPayments(prev => prev.filter(p => p.id !== deletingPayment.id));
            setDeletingPayment(null);
        } catch (err) {
            alert('Failed to delete payment: ' + err.message);
        }
    };

    const handleGeneratePayments = async () => {
        setGenerating(true);
        setGenerateMsg('');
        try {
            const [year, month] = selectedMonth.split('-');
            const targetDate = `${year}-${month}-01`;
            const count = await generateMonthlyPayments(targetDate);
            setGenerateMsg(count === 0 ? '✅ All tenants already have payments for this month.' : `✅ ${count} new payment record${count > 1 ? 's' : ''} created!`);
            await fetchPayments();
        } catch (err) {
            setGenerateMsg('❌ Failed to generate payments: ' + err.message);
        } finally {
            setGenerating(false);
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            paid: 'bg-green-100 text-green-800',
            pending: 'bg-orange-100 text-orange-800',
            overdue: 'bg-red-100 text-red-800',
        };
        return <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${styles[status]}`}>{status}</span>;
    };

    const filteredPayments = payments.filter(p => p.due_date?.slice(0, 7) === selectedMonth);
    const totalCollected = filteredPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount), 0);
    const totalPending = filteredPayments.filter(p => p.status === 'pending').reduce((sum, p) => sum + Number(p.amount), 0);
    const totalOverdue = filteredPayments.filter(p => p.status === 'overdue').reduce((sum, p) => sum + Number(p.amount), 0);

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Rent Tracking</h1>
                            <p className="text-gray-600 mt-1">Monitor and manage rent payments</p>
                        </div>
                        <Button variant="outline" onClick={() => navigate('/landlord/dashboard')}>← Back</Button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>}

                <Card className="mb-6">
                    <div className="flex flex-wrap items-center gap-4">
                        <label className="font-semibold">Select Month:</label>
                        <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" />
                        <Button onClick={handleGeneratePayments} disabled={generating} variant="outline">
                            {generating ? 'Generating...' : '⚡ Generate Payments'}
                        </Button>
                        {generateMsg && <span className="text-sm font-medium text-gray-700">{generateMsg}</span>}
                    </div>
                </Card>

                <div className="grid md:grid-cols-3 gap-6 mb-8">
                    <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
                        <div className="text-3xl mb-2">✅</div>
                        <div className="text-3xl font-bold">₹{totalCollected.toLocaleString()}</div>
                        <div className="text-green-100">Collected</div>
                    </Card>
                    <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                        <div className="text-3xl mb-2">⏳</div>
                        <div className="text-3xl font-bold">₹{totalPending.toLocaleString()}</div>
                        <div className="text-orange-100">Pending</div>
                    </Card>
                    <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
                        <div className="text-3xl mb-2">⚠️</div>
                        <div className="text-3xl font-bold">₹{totalOverdue.toLocaleString()}</div>
                        <div className="text-red-100">Overdue</div>
                    </Card>
                </div>

                <Card>
                    <h3 className="text-xl font-semibold mb-4">Payment Details</h3>
                    {loading ? (
                        <div className="animate-pulse space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded" />)}</div>
                    ) : filteredPayments.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">No payments for this month</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tenant</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">PG & Room</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Amount</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Due Date</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredPayments.map((payment) => (
                                        <tr key={payment.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-4">
                                                <div className="font-semibold">{payment.tenants?.full_name}</div>
                                                <div className="text-xs text-gray-500">{payment.tenants?.contact}</div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="text-sm text-gray-600">{payment.tenants?.rooms?.properties?.name}</div>
                                                <div className="text-sm font-semibold">Room {payment.tenants?.rooms?.room_number}</div>
                                            </td>
                                            <td className="px-4 py-4 font-bold">₹{Number(payment.amount).toLocaleString()}</td>
                                            <td className="px-4 py-4 text-sm">{new Date(payment.due_date).toLocaleDateString('en-IN')}</td>
                                            <td className="px-4 py-4">{getStatusBadge(payment.status)}</td>
                                            <td className="px-4 py-4">
                                                <div className="flex gap-2">
                                                    {payment.status !== 'paid' && (
                                                        <Button size="sm" onClick={() => {
                                                            setEditingPayment(payment);
                                                            setIsEditModalOpen(true);
                                                        }}>
                                                            Mark Paid / Edit
                                                        </Button>
                                                    )}
                                                    {payment.status === 'paid' && (
                                                        <Button size="sm" variant="outline" onClick={() => {
                                                            setEditingPayment(payment);
                                                            setIsEditModalOpen(true);
                                                        }}>
                                                            Edit
                                                        </Button>
                                                    )}
                                                    <button onClick={() => setDeletingPayment(payment)} className="p-2 text-red-600 hover:bg-red-50 rounded transition">
                                                        🗑️
                                                    </button>
                                                </div>
                                                {payment.status === 'paid' && (
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        Paid {payment.paid_date ? new Date(payment.paid_date).toLocaleDateString('en-IN') : ''}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            </main>

            {/* Edit Payment Modal */}
            <Modal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setEditingPayment(null); }} title="Update Payment">
                {editingPayment && (
                    <EditPaymentForm
                        payment={editingPayment}
                        onConfirm={handleUpdatePayment}
                        onClose={() => { setIsEditModalOpen(false); setEditingPayment(null); }}
                    />
                )}
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal isOpen={!!deletingPayment} onClose={() => setDeletingPayment(null)} title="Delete Payment" size="sm">
                <div className="text-center">
                    <div className="text-5xl mb-4">⚠️</div>
                    <p className="text-gray-700 mb-1">Are you sure you want to delete this payment record for <strong>{deletingPayment?.tenants?.full_name}</strong>?</p>
                    <div className="flex gap-3 justify-center mt-6">
                        <Button variant="outline" onClick={() => setDeletingPayment(null)}>Cancel</Button>
                        <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDeletePayment}>Delete Record</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

function EditPaymentForm({ payment, onConfirm, onClose }) {
    const [formData, setFormData] = useState({
        amount: payment.amount,
        status: payment.status,
        payment_method: payment.payment_method || 'cash',
        transaction_id: payment.transaction_id || '',
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        await onConfirm(formData);
        setLoading(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <p className="text-sm text-gray-600">Tenant: <span className="font-semibold">{payment.tenants?.full_name}</span></p>
                <p className="text-sm text-gray-600">Due Date: <span className="font-semibold">{new Date(payment.due_date).toLocaleDateString('en-IN')}</span></p>
            </div>

            <Input label="Amount" type="number" value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required />

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500">
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                </select>
            </div>

            {formData.status === 'paid' && (
                <>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                        <select value={formData.payment_method} onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500">
                            <option value="cash">Cash</option>
                            <option value="upi">UPI</option>
                            <option value="bank_transfer">Bank Transfer</option>
                        </select>
                    </div>
                    <Input label="Transaction ID (Optional)" value={formData.transaction_id}
                        onChange={(e) => setFormData({ ...formData, transaction_id: e.target.value })} />
                </>
            )}

            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</Button>
            </div>
        </form>
    );
}
