import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../shared/Card';
import Button from '../shared/Button';
import EmptyState from '../shared/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { getTenantByUserId, getComplaintsByTenant } from '../../lib/supabaseService';

export default function MyComplaints() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    useEffect(() => {
        fetchComplaints();
    }, []);

    const fetchComplaints = async () => {
        try {
            const tenant = await getTenantByUserId(user.id);
            const data = await getComplaintsByTenant(tenant.id);
            setComplaints(data);
        } catch (err) {
            setError('Failed to load complaints');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getPriorityBadge = (priority) =>
        priority === 'urgent' ? (
            <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase bg-red-100 text-red-800">🔴 Urgent</span>
        ) : (
            <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase bg-blue-100 text-blue-800">🔵 Normal</span>
        );

    const getStatusBadge = (status) => {
        const styles = {
            open: 'bg-orange-100 text-orange-800',
            in_progress: 'bg-blue-100 text-blue-800',
            resolved: 'bg-green-100 text-green-800',
        };
        const labels = { open: '⏳ Pending', in_progress: '🔧 In Progress', resolved: '✓ Resolved' };
        return (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${styles[status] || ''}`}>
                {labels[status] || status}
            </span>
        );
    };

    const filteredComplaints = complaints.filter(c =>
        filterStatus === 'all' || c.status === filterStatus
    );

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">My Complaints</h1>
                            <p className="text-gray-600 mt-1">Track your reported issues</p>
                        </div>
                        <div className="space-x-2">
                            <Button variant="outline" onClick={() => navigate('/tenant/dashboard')}>← Back</Button>
                            <Button onClick={() => navigate('/tenant/raise-complaint')}>+ Raise New Complaint</Button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
                )}

                {/* Filter */}
                <Card className="mb-6">
                    <div className="flex items-center gap-4">
                        <label className="font-semibold">Filter:</label>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="all">All Complaints</option>
                            <option value="open">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                        </select>
                    </div>
                </Card>

                {/* Complaints List */}
                {loading ? (
                    <div className="space-y-4">
                        {[...Array(2)].map((_, i) => (
                            <div key={i} className="bg-white rounded-xl p-6 animate-pulse h-32"></div>
                        ))}
                    </div>
                ) : filteredComplaints.length === 0 ? (
                    <EmptyState
                        icon="📋"
                        title="No Complaints"
                        description={filterStatus === 'all' ? "You haven't raised any complaints yet" : `No ${filterStatus} complaints found`}
                        action={<Button onClick={() => navigate('/tenant/raise-complaint')}>Raise Your First Complaint</Button>}
                    />
                ) : (
                    <div className="space-y-4">
                        {filteredComplaints.map((complaint) => (
                            <Card key={complaint.id}>
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h3 className="font-semibold text-gray-900 mb-1">{complaint.title}</h3>
                                        <div className="flex gap-2">
                                            {getPriorityBadge(complaint.priority)}
                                            {getStatusBadge(complaint.status)}
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-500 whitespace-nowrap">
                                        {new Date(complaint.created_at).toLocaleDateString('en-IN')}
                                    </p>
                                </div>

                                <div className="bg-gray-50 p-4 rounded-lg mb-3">
                                    <p className="text-gray-800">{complaint.description}</p>
                                </div>

                                {complaint.status === 'resolved' && complaint.resolved_at && (
                                    <div className="flex items-center gap-2 text-sm text-green-600">
                                        <span>✓</span>
                                        <span>Resolved on {new Date(complaint.resolved_at).toLocaleDateString('en-IN')}</span>
                                    </div>
                                )}

                                {complaint.status === 'in_progress' && (
                                    <div className="flex items-center gap-2 text-sm text-blue-600">
                                        <span>🔧</span>
                                        <span>Your landlord is working on this</span>
                                    </div>
                                )}

                                {complaint.status === 'open' && (
                                    <div className="flex items-center gap-2 text-sm text-orange-600">
                                        <span>⏳</span>
                                        <span>Waiting for landlord to respond</span>
                                    </div>
                                )}
                            </Card>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
