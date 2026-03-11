import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../shared/Card';
import Button from '../../shared/Button';
import Input from '../../shared/Input';
import Modal from '../../shared/Modal';
import { getTenants, getProperties, getVacantRooms, createTenant, updateTenant, deactivateTenant } from '../../../lib/supabaseService';

export default function TenantManagement() {
    const navigate = useNavigate();
    const [tenants, setTenants] = useState([]);
    const [properties, setProperties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingTenant, setEditingTenant] = useState(null);   // tenant object to edit
    const [deletingTenant, setDeletingTenant] = useState(null); // tenant object to confirm delete
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const propertiesData = await getProperties();
            setProperties(propertiesData);
        } catch (err) {
            console.error('Failed to load properties:', err);
            setError('Failed to load properties. Please refresh.');
        }
        try {
            const tenantsData = await getTenants();
            setTenants(tenantsData);
        } catch (err) {
            console.error('Failed to load tenants:', err);
            setError(prev => prev || 'Failed to load tenants list.');
        }
        setLoading(false);
    };

    const handleDelete = async () => {
        if (!deletingTenant) return;
        setDeleteLoading(true);
        try {
            await deactivateTenant(deletingTenant.id);
            setTenants(prev => prev.filter(t => t.id !== deletingTenant.id));
            setDeletingTenant(null);
        } catch (err) {
            alert('Failed to remove tenant: ' + err.message);
        } finally {
            setDeleteLoading(false);
        }
    };

    const filteredTenants = tenants.filter(tenant =>
        tenant.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tenant.room_number?.includes(searchQuery) ||
        tenant.contact?.includes(searchQuery)
    );

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Tenant Management</h1>
                            <p className="text-gray-600 mt-1">Manage all your tenants</p>
                        </div>
                        <div className="space-x-2">
                            <Button variant="outline" onClick={() => navigate('/landlord/dashboard')}>← Back</Button>
                            <Button onClick={() => setIsAddModalOpen(true)}>+ Add Tenant</Button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
                )}

                <Card className="mb-6">
                    <Input
                        placeholder="Search by name, room, or contact..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </Card>

                {loading ? (
                    <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="bg-white rounded-xl p-6 animate-pulse h-24" />
                        ))}
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {filteredTenants.map((tenant) => (
                            <Card key={tenant.id} className="hover:shadow-md transition-shadow">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    {/* Avatar + name */}
                                    <div className="flex items-center gap-4 min-w-[160px]">
                                        <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-2xl shrink-0">👤</div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900">{tenant.full_name}</h3>
                                            <p className="text-sm text-gray-600">{tenant.contact}</p>
                                        </div>
                                    </div>

                                    {/* Info grid */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                                        <div>
                                            <p className="text-xs text-gray-500">PG & Room</p>
                                            <p className="font-semibold text-sm">{tenant.property_name}</p>
                                            <p className="text-sm text-gray-600">Room {tenant.room_number}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Company</p>
                                            <p className="font-semibold text-sm">{tenant.company || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Move-in Date</p>
                                            <p className="font-semibold text-sm">
                                                {new Date(tenant.move_in_date).toLocaleDateString('en-IN')}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Rent</p>
                                            <p className="font-bold text-gray-900">₹{Number(tenant.rent_amount).toLocaleString()}/mo</p>
                                        </div>
                                    </div>

                                    {/* Vehicles + Actions */}
                                    <div className="flex items-center gap-3">
                                        <div className="flex gap-1 text-xl">
                                            {tenant.has_bike && <span title="Has Bike">🏍️</span>}
                                            {tenant.has_car && <span title="Has Car">🚗</span>}
                                        </div>
                                        <button
                                            onClick={() => setEditingTenant(tenant)}
                                            className="px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition"
                                        >
                                            ✏️ Edit
                                        </button>
                                        <button
                                            onClick={() => setDeletingTenant(tenant)}
                                            className="px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition"
                                        >
                                            🗑️ Remove
                                        </button>
                                    </div>
                                </div>
                            </Card>
                        ))}

                        {filteredTenants.length === 0 && (
                            <div className="text-center py-12 text-gray-500">
                                {searchQuery ? 'No tenants found matching your search' : 'No tenants yet. Add your first tenant!'}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Add Tenant Modal */}
            <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add New Tenant" size="lg">
                <AddTenantForm
                    properties={properties}
                    onSuccess={() => { fetchData(); setIsAddModalOpen(false); }}
                    onClose={() => setIsAddModalOpen(false)}
                />
            </Modal>

            {/* Edit Tenant Modal */}
            <Modal isOpen={!!editingTenant} onClose={() => setEditingTenant(null)} title="Edit Tenant" size="lg">
                {editingTenant && (
                    <EditTenantForm
                        tenant={editingTenant}
                        properties={properties}
                        onSuccess={() => { fetchData(); setEditingTenant(null); }}
                        onClose={() => setEditingTenant(null)}
                    />
                )}
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal isOpen={!!deletingTenant} onClose={() => setDeletingTenant(null)} title="Remove Tenant" size="sm">
                <div className="text-center">
                    <div className="text-5xl mb-4">⚠️</div>
                    <p className="text-gray-700 mb-1">
                        Are you sure you want to remove <strong>{deletingTenant?.full_name}</strong>?
                    </p>
                    <p className="text-sm text-gray-500 mb-6">
                        Their room will be freed. Payment history will be preserved. This action can be reversed from the database.
                    </p>
                    <div className="flex gap-3 justify-center">
                        <Button variant="outline" onClick={() => setDeletingTenant(null)}>Cancel</Button>
                        <button
                            onClick={handleDelete}
                            disabled={deleteLoading}
                            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition disabled:opacity-60"
                        >
                            {deleteLoading ? 'Removing...' : 'Yes, Remove'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

// ─── Add Tenant Form ─────────────────────────────────────────────────────────
function AddTenantForm({ properties, onSuccess, onClose }) {
    const [formData, setFormData] = useState({
        full_name: '', contact: '', property_id: '', room_id: '',
        move_in_date: '', emergency_contact_name: '', emergency_contact_phone: '',
        company: '', expected_stay_months: '', has_bike: false, has_car: false,
    });
    const [vacantRooms, setVacantRooms] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handlePropertyChange = async (propertyId) => {
        setFormData(prev => ({ ...prev, property_id: propertyId, room_id: '' }));
        if (propertyId) {
            const rooms = await getVacantRooms(propertyId);
            setVacantRooms(rooms);
        } else {
            setVacantRooms([]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await createTenant({
                full_name: formData.full_name,
                contact: formData.contact,
                room_id: formData.room_id,
                move_in_date: formData.move_in_date,
                emergency_contact_name: formData.emergency_contact_name,
                emergency_contact_phone: formData.emergency_contact_phone,
                company: formData.company,
                expected_stay_months: formData.expected_stay_months ? parseInt(formData.expected_stay_months) : null,
                has_bike: formData.has_bike,
                has_car: formData.has_car,
            });
            onSuccess();
        } catch (err) {
            setError(err.message || 'Failed to add tenant');
        } finally {
            setLoading(false);
        }
    };

    return <TenantForm formData={formData} setFormData={setFormData} vacantRooms={vacantRooms}
        properties={properties} onPropertyChange={handlePropertyChange}
        onSubmit={handleSubmit} onClose={onClose} loading={loading} error={error}
        submitLabel="Add Tenant" loadingLabel="Adding..." />;
}

// ─── Edit Tenant Form ─────────────────────────────────────────────────────────
function EditTenantForm({ tenant, properties, onSuccess, onClose }) {
    const [formData, setFormData] = useState({
        full_name: tenant.full_name || '',
        contact: tenant.contact || '',
        property_id: tenant.property_id || '',
        room_id: tenant.room_id || '',
        new_room_id: '',      // only set if changing room
        move_in_date: tenant.move_in_date || '',
        emergency_contact_name: tenant.emergency_contact_name || '',
        emergency_contact_phone: tenant.emergency_contact_phone || '',
        company: tenant.company || '',
        expected_stay_months: tenant.expected_stay_months || '',
        has_bike: tenant.has_bike || false,
        has_car: tenant.has_car || false,
    });
    const [vacantRooms, setVacantRooms] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handlePropertyChange = async (propertyId) => {
        setFormData(prev => ({ ...prev, property_id: propertyId, new_room_id: '' }));
        if (propertyId) {
            const rooms = await getVacantRooms(propertyId);
            setVacantRooms(rooms);
        } else {
            setVacantRooms([]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await updateTenant(tenant.id, {
                full_name: formData.full_name,
                contact: formData.contact,
                move_in_date: formData.move_in_date,
                emergency_contact_name: formData.emergency_contact_name,
                emergency_contact_phone: formData.emergency_contact_phone,
                company: formData.company,
                expected_stay_months: formData.expected_stay_months,
                has_bike: formData.has_bike,
                has_car: formData.has_car,
                new_room_id: formData.new_room_id || null,
            });
            onSuccess();
        } catch (err) {
            setError(err.message || 'Failed to update tenant');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

            <div className="grid md:grid-cols-2 gap-4">
                <Input label="Full Name" value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} required />
                <Input label="Contact Number" type="tel" value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })} required />
            </div>

            <Input label="Move-in Date" type="date" value={formData.move_in_date}
                onChange={(e) => setFormData({ ...formData, move_in_date: e.target.value })} required />
            <Input label="Company/Workplace" value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })} />

            <div className="grid md:grid-cols-2 gap-4">
                <Input label="Emergency Contact Name" value={formData.emergency_contact_name}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })} />
                <Input label="Emergency Contact Phone" type="tel" value={formData.emergency_contact_phone}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })} />
            </div>

            <Input label="Expected Stay (months)" type="number" value={formData.expected_stay_months}
                onChange={(e) => setFormData({ ...formData, expected_stay_months: e.target.value })} />

            {/* Optional room transfer */}
            <div className="border border-dashed border-gray-300 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Transfer Room (optional)</p>
                <div className="grid md:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">New PG</label>
                        <select value={formData.property_id} onChange={(e) => handlePropertyChange(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm">
                            <option value="">Keep current PG</option>
                            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">New Vacant Room</label>
                        <select value={formData.new_room_id} onChange={(e) => setFormData({ ...formData, new_room_id: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                            disabled={!formData.property_id || vacantRooms.length === 0}>
                            <option value="">Keep current room</option>
                            {vacantRooms.map(r => (
                                <option key={r.id} value={r.id}>Room {r.room_number} (Floor {r.floor}) — ₹{r.rent_amount}/mo</option>
                            ))}
                        </select>
                    </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">Leave blank to keep the current room assignment.</p>
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Vehicle Ownership</label>
                <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                        <input type="checkbox" checked={formData.has_bike}
                            onChange={(e) => setFormData({ ...formData, has_bike: e.target.checked })}
                            className="w-4 h-4 text-primary-600 rounded" />
                        <span>Bike 🏍️</span>
                    </label>
                    <label className="flex items-center gap-2">
                        <input type="checkbox" checked={formData.has_car}
                            onChange={(e) => setFormData({ ...formData, has_car: e.target.checked })}
                            className="w-4 h-4 text-primary-600 rounded" />
                        <span>Car 🚗</span>
                    </label>
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</Button>
            </div>
        </form>
    );
}

// ─── Shared form for Add ─────────────────────────────────────────────────────
function TenantForm({ formData, setFormData, vacantRooms, properties, onPropertyChange, onSubmit, onClose, loading, error, submitLabel, loadingLabel }) {
    return (
        <form onSubmit={onSubmit} className="space-y-4">
            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

            <div className="grid md:grid-cols-2 gap-4">
                <Input label="Full Name" value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} required />
                <Input label="Contact Number" type="tel" value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })} required />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select PG <span className="text-red-500">*</span></label>
                    <select value={formData.property_id} onChange={(e) => onPropertyChange(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" required>
                        <option value="">Choose PG</option>
                        {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Room <span className="text-red-500">*</span></label>
                    <select value={formData.room_id} onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        required disabled={!formData.property_id}>
                        <option value="">Choose Room</option>
                        {vacantRooms.map(r => (
                            <option key={r.id} value={r.id}>Room {r.room_number} (Floor {r.floor}) — ₹{r.rent_amount}/mo</option>
                        ))}
                    </select>
                </div>
            </div>

            <Input label="Move-in Date" type="date" value={formData.move_in_date}
                onChange={(e) => setFormData({ ...formData, move_in_date: e.target.value })} required />
            <Input label="Company/Workplace" value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })} />

            <div className="grid md:grid-cols-2 gap-4">
                <Input label="Emergency Contact Name" value={formData.emergency_contact_name}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })} />
                <Input label="Emergency Contact Phone" type="tel" value={formData.emergency_contact_phone}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })} />
            </div>

            <Input label="Expected Stay Duration (months)" type="number" value={formData.expected_stay_months}
                onChange={(e) => setFormData({ ...formData, expected_stay_months: e.target.value })} />

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Vehicle Ownership</label>
                <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                        <input type="checkbox" checked={formData.has_bike}
                            onChange={(e) => setFormData({ ...formData, has_bike: e.target.checked })}
                            className="w-4 h-4 text-primary-600 rounded" />
                        <span>Bike 🏍️</span>
                    </label>
                    <label className="flex items-center gap-2">
                        <input type="checkbox" checked={formData.has_car}
                            onChange={(e) => setFormData({ ...formData, has_car: e.target.checked })}
                            className="w-4 h-4 text-primary-600 rounded" />
                        <span>Car 🚗</span>
                    </label>
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={loading}>{loading ? loadingLabel : submitLabel}</Button>
            </div>
        </form>
    );
}
