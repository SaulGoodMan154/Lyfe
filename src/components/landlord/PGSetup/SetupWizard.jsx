import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../shared/Card';
import Button from '../../shared/Button';
import Input from '../../shared/Input';
import { createPGSetup } from '../../../lib/supabaseService';
import { useAuth } from '../../../context/AuthContext';

export default function PGSetupWizard() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [currentStep, setCurrentStep] = useState(1);
    const [currentPG, setCurrentPG] = useState(0);
    const [currentPGIndex, setCurrentPGIndex] = useState(0);
    const [currentFloorIndex, setCurrentFloorIndex] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        numberOfPGs: 0,
        pgs: [],
    });

    // ── Step 1 helpers ──────────────────────────────────────────
    const handleNumberOfPGs = (e) => {
        const num = parseInt(e.target.value) || 0;
        setFormData({
            ...formData,
            numberOfPGs: num,
            pgs: Array(num).fill(null).map((_, i) => ({
                id: i + 1,
                name: '',
                address: '',
                totalFloors: 0,
                floors: [],
            })),
        });
    };

    // ── Step 2 helpers ──────────────────────────────────────────
    const updatePG = (field, value) => {
        const updatedPGs = [...formData.pgs];
        updatedPGs[currentPG] = { ...updatedPGs[currentPG], [field]: value };

        if (field === 'totalFloors') {
            updatedPGs[currentPG].floors = Array(parseInt(value) || 0).fill(null).map((_, i) => ({
                floorNumber: i + 1,
                totalRooms: 0,
                rooms: [],
            }));
        }
        setFormData({ ...formData, pgs: updatedPGs });
    };

    // ── Step 3 helpers ──────────────────────────────────────────
    const updateFloor = (field, value) => {
        const updatedPGs = [...formData.pgs];
        updatedPGs[currentPGIndex].floors[currentFloorIndex] = {
            ...updatedPGs[currentPGIndex].floors[currentFloorIndex],
            [field]: value,
        };

        if (field === 'totalRooms') {
            updatedPGs[currentPGIndex].floors[currentFloorIndex].rooms = Array(parseInt(value) || 0).fill(null).map((_, i) => ({
                roomNumber: `${currentFloorIndex + 1}0${i + 1}`,
                rentAmount: '',
                occupancyType: 1,
            }));
        }
        setFormData({ ...formData, pgs: updatedPGs });
    };

    const updateRoom = (roomIndex, field, value) => {
        const updatedPGs = [...formData.pgs];
        updatedPGs[currentPGIndex].floors[currentFloorIndex].rooms[roomIndex] = {
            ...updatedPGs[currentPGIndex].floors[currentFloorIndex].rooms[roomIndex],
            [field]: value,
        };
        setFormData({ ...formData, pgs: updatedPGs });
    };

    // ── Step 4: Submit ──────────────────────────────────────────
    const handleSubmit = async () => {
        setError('');
        setSubmitting(true);
        try {
            for (const pg of formData.pgs) {
                // Flatten all rooms across all floors
                const rooms = pg.floors.flatMap(floor =>
                    floor.rooms.map(room => ({
                        room_number: room.roomNumber,
                        floor: floor.floorNumber,
                        rent_amount: parseFloat(room.rentAmount) || 0,
                    }))
                );

                // Use RPC to create property + rooms in one call (bypasses RLS recursion)
                await createPGSetup({
                    name: pg.name,
                    address: pg.address || pg.name,
                    totalFloors: parseInt(pg.totalFloors),
                    landlordId: user.id,
                    rooms,
                });
            }
            navigate('/landlord/dashboard');
        } catch (err) {
            setError(err.message || 'Failed to save setup. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const pg = formData.pgs[currentPG];
    const pg3 = formData.pgs[currentPGIndex];
    const floor = pg3?.floors[currentFloorIndex];

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4">
            <div className="max-w-4xl mx-auto">
                <Card>
                    {/* Progress Bar */}
                    <div className="mb-8">
                        <div className="flex justify-between mb-2">
                            {['PG Count', 'PG Details', 'Room Setup', 'Review'].map((step, idx) => (
                                <div key={idx} className={`text-sm ${currentStep > idx ? 'text-primary-600 font-semibold' : 'text-gray-400'}`}>
                                    {step}
                                </div>
                            ))}
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary-500 transition-all duration-300"
                                style={{ width: `${(currentStep / 4) * 100}%` }}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
                    )}

                    {/* ── STEP 1: How many PGs ── */}
                    {currentStep === 1 && (
                        <div className="space-y-6">
                            <div className="text-center mb-8">
                                <h2 className="text-3xl font-bold text-gray-900 mb-2">Let's Get Started!</h2>
                                <p className="text-gray-600">Tell us about your properties</p>
                            </div>

                            <Input
                                label="How many PGs do you own?"
                                type="number"
                                min="1"
                                value={formData.numberOfPGs || ''}
                                onChange={handleNumberOfPGs}
                                placeholder="e.g., 2 or 3"
                                required
                            />

                            <div className="flex justify-end mt-8">
                                <Button
                                    onClick={() => setCurrentStep(2)}
                                    disabled={formData.numberOfPGs < 1}
                                >
                                    Next →
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 2: PG Details ── */}
                    {currentStep === 2 && (
                        <div className="space-y-6">
                            <div className="text-center mb-8">
                                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                                    PG {currentPG + 1} of {formData.numberOfPGs}
                                </h2>
                                <p className="text-gray-600">Provide details for this property</p>
                            </div>

                            <Input
                                label="PG Name"
                                value={pg?.name || ''}
                                onChange={(e) => updatePG('name', e.target.value)}
                                placeholder="e.g., Sunrise PG"
                                required
                            />

                            <Input
                                label="Address"
                                value={pg?.address || ''}
                                onChange={(e) => updatePG('address', e.target.value)}
                                placeholder="e.g., 12 MG Road, Bangalore"
                                required
                            />

                            <Input
                                label="Number of Floors"
                                type="number"
                                min="1"
                                value={pg?.totalFloors || ''}
                                onChange={(e) => updatePG('totalFloors', e.target.value)}
                                placeholder="e.g., 2"
                                required
                            />

                            <div className="flex justify-between mt-8">
                                <Button variant="outline" onClick={() => setCurrentStep(1)}>← Back</Button>

                                <div className="space-x-2">
                                    {currentPG < formData.numberOfPGs - 1 ? (
                                        <Button
                                            onClick={() => setCurrentPG(currentPG + 1)}
                                            disabled={!pg?.name || !pg?.totalFloors}
                                        >
                                            Next PG →
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={() => setCurrentStep(3)}
                                            disabled={!pg?.name || !pg?.totalFloors}
                                        >
                                            Continue →
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 3: Room Setup ── */}
                    {currentStep === 3 && (
                        <div className="space-y-6">
                            <div className="text-center mb-8">
                                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                                    {pg3?.name} — Floor {currentFloorIndex + 1}
                                </h2>
                                <p className="text-gray-600">Set up rooms for this floor</p>
                            </div>

                            <Input
                                label="Number of Rooms on this Floor"
                                type="number"
                                min="1"
                                value={floor?.totalRooms || ''}
                                onChange={(e) => updateFloor('totalRooms', e.target.value)}
                                placeholder="e.g., 4"
                                required
                            />

                            {floor?.rooms && floor.rooms.length > 0 && (
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-lg">Room Details</h3>
                                    {floor.rooms.map((room, idx) => (
                                        <Card key={idx} className="bg-gray-50">
                                            <div className="grid md:grid-cols-3 gap-4">
                                                <Input
                                                    label="Room Number"
                                                    value={room.roomNumber}
                                                    onChange={(e) => updateRoom(idx, 'roomNumber', e.target.value)}
                                                    placeholder="e.g., 101"
                                                />
                                                <Input
                                                    label="Rent Amount (₹/month)"
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    value={room.rentAmount}
                                                    onChange={(e) => updateRoom(idx, 'rentAmount', e.target.value.replace(/[^0-9]/g, ''))}
                                                    placeholder="e.g., 5000"
                                                />
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Occupancy Type <span className="text-red-500">*</span>
                                                    </label>
                                                    <select
                                                        value={room.occupancyType}
                                                        onChange={(e) => updateRoom(idx, 'occupancyType', parseInt(e.target.value))}
                                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                                    >
                                                        <option value={1}>Single (1-share)</option>
                                                        <option value={2}>Double (2-share)</option>
                                                        <option value={3}>Triple (3-share)</option>
                                                        <option value={4}>Quad (4-share)</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            )}

                            <div className="flex justify-between mt-8">
                                <Button variant="outline" onClick={() => {
                                    if (currentFloorIndex > 0) {
                                        setCurrentFloorIndex(currentFloorIndex - 1);
                                    } else if (currentPGIndex > 0) {
                                        setCurrentPGIndex(currentPGIndex - 1);
                                        setCurrentFloorIndex(formData.pgs[currentPGIndex - 1].floors.length - 1);
                                    } else {
                                        setCurrentStep(2);
                                    }
                                }}>
                                    ← Back
                                </Button>

                                <Button
                                    onClick={() => {
                                        if (currentFloorIndex < pg3.floors.length - 1) {
                                            setCurrentFloorIndex(currentFloorIndex + 1);
                                        } else if (currentPGIndex < formData.pgs.length - 1) {
                                            setCurrentPGIndex(currentPGIndex + 1);
                                            setCurrentFloorIndex(0);
                                        } else {
                                            setCurrentStep(4);
                                        }
                                    }}
                                    disabled={!floor?.totalRooms}
                                >
                                    {currentFloorIndex < pg3.floors.length - 1 || currentPGIndex < formData.pgs.length - 1
                                        ? 'Next Floor →'
                                        : 'Review →'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 4: Review & Submit ── */}
                    {currentStep === 4 && (
                        <div className="space-y-6">
                            <div className="text-center mb-8">
                                <h2 className="text-3xl font-bold text-gray-900 mb-2">Review Your Setup</h2>
                                <p className="text-gray-600">Please review before submitting</p>
                            </div>

                            <div className="space-y-6">
                                {formData.pgs.map((pg, pgIdx) => (
                                    <Card key={pgIdx}>
                                        <h3 className="text-xl font-bold mb-1">{pg.name}</h3>
                                        <p className="text-gray-500 text-sm mb-3">{pg.address}</p>
                                        <p className="text-gray-600 mb-4">Total Floors: {pg.totalFloors}</p>

                                        {pg.floors.map((floor, floorIdx) => (
                                            <div key={floorIdx} className="mb-4 pl-4 border-l-4 border-primary-500">
                                                <p className="font-semibold">Floor {floor.floorNumber} — {floor.totalRooms} rooms</p>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                                                    {floor.rooms.map((room, roomIdx) => (
                                                        <div key={roomIdx} className="text-sm bg-gray-50 p-2 rounded">
                                                            <div className="font-medium">Room {room.roomNumber}</div>
                                                            <div className="text-gray-500">₹{room.rentAmount || 0}/mo</div>
                                                            <div className="text-gray-500">{room.occupancyType}-share</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </Card>
                                ))}
                            </div>

                            <div className="flex justify-between mt-8">
                                <Button variant="outline" onClick={() => setCurrentStep(3)}>← Back</Button>
                                <Button onClick={handleSubmit} disabled={submitting}>
                                    {submitting ? 'Saving...' : 'Complete Setup ✓'}
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
