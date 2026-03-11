import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../shared/Card';
import Button from '../shared/Button';
import { useAuth } from '../../context/AuthContext';
import { getTenantByUserId, createComplaint } from '../../lib/supabaseService';

export default function RaiseComplaint() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [tenant, setTenant] = useState(null);
    const [formData, setFormData] = useState({ title: '', description: '', priority: 'normal' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        getTenantByUserId(user.id).then(setTenant).catch(console.error);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!tenant) return;
        setError('');
        setLoading(true);
        try {
            await createComplaint({
                tenant_id: tenant.id,
                property_id: tenant.property_id,
                title: formData.title,
                description: formData.description,
                priority: formData.priority,
            });
            navigate('/tenant/my-complaints');
        } catch (err) {
            setError('Failed to submit complaint. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Raise a Complaint</h1>
                            <p className="text-gray-600 mt-1">Report any issues or maintenance requests</p>
                        </div>
                        <Button variant="outline" onClick={() => navigate('/tenant/dashboard')}>← Back</Button>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
                )}

                <Card>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Title */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Issue Title <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="e.g., Fan not working, Water leakage"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                required
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Describe the Issue <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={5}
                                placeholder="Please describe the issue in detail..."
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none outline-none"
                                required
                            />
                            <p className="text-sm text-gray-500 mt-1">Be as specific as possible to help resolve the issue quickly</p>
                        </div>

                        {/* Priority */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                Priority Level <span className="text-red-500">*</span>
                            </label>
                            <div className="space-y-3">
                                <label
                                    className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                                    style={{ borderColor: formData.priority === 'urgent' ? '#ef4444' : '#e5e7eb' }}
                                >
                                    <input
                                        type="radio" name="priority" value="urgent"
                                        checked={formData.priority === 'urgent'}
                                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                        className="mt-1 w-4 h-4 text-red-600"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-2xl">🔴</span>
                                            <span className="font-semibold text-gray-900">Urgent</span>
                                        </div>
                                        <p className="text-sm text-gray-600">
                                            Critical issues needing immediate attention (water leakage, electrical problems, safety hazards)
                                        </p>
                                        {formData.priority === 'urgent' && (
                                            <p className="text-sm text-red-600 font-semibold mt-2">⚡ Landlord will receive instant notification</p>
                                        )}
                                    </div>
                                </label>

                                <label
                                    className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                                    style={{ borderColor: formData.priority === 'normal' ? '#3b82f6' : '#e5e7eb' }}
                                >
                                    <input
                                        type="radio" name="priority" value="normal"
                                        checked={formData.priority === 'normal'}
                                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                        className="mt-1 w-4 h-4 text-blue-600"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-2xl">🔵</span>
                                            <span className="font-semibold text-gray-900">Normal</span>
                                        </div>
                                        <p className="text-sm text-gray-600">
                                            Regular maintenance or non-urgent issues (light bulb replacement, slow WiFi, minor repairs)
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Submit */}
                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" variant="outline" onClick={() => navigate('/tenant/dashboard')}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={loading || !formData.title.trim() || !formData.description.trim()}>
                                {loading ? 'Submitting...' : 'Submit Complaint'}
                            </Button>
                        </div>
                    </form>
                </Card>

                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-2">💡 Tips for faster resolution:</h4>
                    <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                        <li>Be specific about the location and nature of the problem</li>
                        <li>Mention if the issue affects your daily routine</li>
                        <li>Include relevant details like when the problem started</li>
                        <li>Use "Urgent" priority only for critical issues</li>
                    </ul>
                </div>
            </main>
        </div>
    );
}
