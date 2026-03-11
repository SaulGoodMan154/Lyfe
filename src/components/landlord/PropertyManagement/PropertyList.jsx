import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../shared/Card';
import Button from '../../shared/Button';
import EmptyState from '../../shared/EmptyState';
import { getProperties } from '../../../lib/supabaseService';

export default function PropertyManagement() {
    const navigate = useNavigate();
    const [properties, setProperties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchProperties();
    }, []);

    const fetchProperties = async () => {
        try {
            const data = await getProperties();
            setProperties(data);
        } catch (err) {
            setError('Failed to load properties');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getOccupancyPercentage = (occupied, total) =>
        total === 0 ? 0 : Math.round((occupied / total) * 100);

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Property Management</h1>
                            <p className="text-gray-600 mt-1">Manage all your PG properties</p>
                        </div>
                        <div className="space-x-2">
                            <Button variant="outline" onClick={() => navigate('/landlord/dashboard')}>← Back</Button>
                            <Button onClick={() => navigate('/landlord/pg-setup')}>+ Add New PG</Button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
                )}

                {loading ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="bg-white rounded-xl p-6 animate-pulse h-48"></div>
                        ))}
                    </div>
                ) : properties.length === 0 ? (
                    <EmptyState
                        icon="🏠"
                        title="No Properties Yet"
                        description="Get started by adding your first PG property"
                        action={<Button onClick={() => navigate('/landlord/pg-setup')}>+ Add Your First PG</Button>}
                    />
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {properties.map((property) => (
                            <Card key={property.id} hover className="cursor-pointer">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900">{property.name}</h3>
                                        <p className="text-gray-600 text-sm">{property.total_floors} Floors • {property.totalRooms} Rooms</p>
                                        <p className="text-gray-500 text-xs mt-1">{property.address}</p>
                                    </div>
                                    <div className="text-3xl">🏢</div>
                                </div>

                                <div className="mb-4">
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600">Occupancy</span>
                                        <span className="font-semibold">
                                            {getOccupancyPercentage(property.occupiedRooms, property.totalRooms)}%
                                        </span>
                                    </div>
                                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-green-500"
                                            style={{ width: `${getOccupancyPercentage(property.occupiedRooms, property.totalRooms)}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                                        <span>{property.occupiedRooms} Occupied</span>
                                        <span>{property.vacantRooms} Vacant</span>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-gray-200">
                                    <p className="text-sm text-gray-600">Monthly Collection</p>
                                    <p className="text-2xl font-bold text-green-600">₹{(property.monthlyRent || 0).toLocaleString()}</p>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
