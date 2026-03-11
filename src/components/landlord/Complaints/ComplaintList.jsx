import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../shared/Card';
import Button from '../../shared/Button';
import Modal from '../../shared/Modal';
import { getComplaints, updateComplaintStatus } from '../../../lib/supabaseService';

export default function ComplaintManagement() {
    const navigate = useNavigate();
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filterPriority, setFilterPriority] = useState('all');
    const [filterStatus, setFilterStatus] = useState('open');
    const [updatingId, setUpdatingId] = useState(null);

    useEffect(() => {
        fetchComplaints();
    }, []);

    const fetchComplaints = async () => {
        try {
            const data = await getComplaints();
            setComplaints(data);
        } catch (err) {
            setError('Failed to load complaints');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (complaintId, newStatus) => {
        setUpdatingId(complaintId);
        try {
            const updated = await updateComplaintStatus(complaintId, newStatus);
            setComplaints(prev => prev.map(c => c.id === complaintId ? { ...c, ...updated } : c));
        } catch (err) {
            setError('Failed to update complaint status');
        } finally {
            setUpdatingId(null);
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
        const labels = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved' };
        return (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${styles[status] || ''}`}>
                {labels[status] || status}
            </span>
        );
    };

    const filteredComplaints = complaints.filter(c => {
        const matchesPriority = filterPriority === 'all' || c.priority === filterPriority;
        const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
        return matchesPriority && matchesStatus;
    });

    const urgentCount = complaints.filter(c => c.priority === 'urgent' && c.status !== 'resolved').length;
    const openCount = complaints.filter(c => c.status !== 'resolved').length;

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Complaint Management</h1>
                            <p className="text-gray-600 mt-1">View and resolve tenant complaints</p>
                        </div>
                        <Button variant="outline" onClick={() => navigate('/landlord/dashboard')}>← Back</Button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
                )}

                {/* Stats */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
                        <div className="text-3xl mb-2">🚨</div>
                        <div className="text-3xl font-bold">{urgentCount}</div>
                        <div className="text-red-100">Urgent Open</div>
                    </Card>
                    <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                        <div className="text-3xl mb-2">📋</div>
                        <div className="text-3xl font-bold">{openCount}</div>
                        <div className="text-orange-100">Total Open</div>
                    </Card>
                </div>

                {/* Filters */}
                <Card className="mb-6">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Priority</label>
                            <select
                                value={filterPriority}
                                onChange={(e) => setFilterPriority(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="all">All Priorities</option>
                                <option value="urgent">Urgent</option>
                                <option value="normal">Normal</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="all">All Statuses</option>
                                <option value="open">Open</option>
                                <option value="in_progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                            </select>
                        </div>
                    </div>
                </Card>

                {/* Complaints List */}
                {loading ? (
                    <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="bg-white rounded-xl p-6 animate-pulse h-32"></div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredComplaints.map((complaint) => (
                            <Card
                                key={complaint.id}
                                className={complaint.priority === 'urgent' && complaint.status !== 'resolved' ? 'border-2 border-red-400' : ''}
                            >
                                <div className="flex flex-col md:flex-row gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <h3 className="font-semibold text-lg">{complaint.title}</h3>
                                                <p className="text-sm text-gray-600">
                                                    {complaint.tenants?.full_name} • {complaint.properties?.name}
                                                </p>
                                            </div>
                                            <div className="flex gap-2 flex-wrap">
                                                {getPriorityBadge(complaint.priority)}
                                                {getStatusBadge(complaint.status)}
                                            </div>
                                        </div>

                                        <div className="bg-gray-50 p-4 rounded-lg mb-3">
                                            <p className="text-gray-800">{complaint.description}</p>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <p className="text-sm text-gray-500">
                                                {new Date(complaint.created_at).toLocaleString('en-IN')}
                                                {complaint.resolved_at && ` • Resolved: ${new Date(complaint.resolved_at).toLocaleString('en-IN')}`}
                                            </p>

                                            {complaint.status !== 'resolved' && (
                                                <div className="flex gap-2">
                                                    {complaint.status === 'open' && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            disabled={updatingId === complaint.id}
                                                            onClick={() => handleStatusUpdate(complaint.id, 'in_progress')}
                                                        >
                                                            Mark In Progress
                                                        </Button>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        disabled={updatingId === complaint.id}
                                                        onClick={() => handleStatusUpdate(complaint.id, 'resolved')}
                                                    >
                                                        {updatingId === complaint.id ? 'Updating...' : 'Mark Resolved'}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}

                        {filteredComplaints.length === 0 && (
                            <div className="text-center py-12 text-gray-500">
                                No complaints found matching your criteria
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
