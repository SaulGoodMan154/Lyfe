import { supabase } from './supabase';

// ============================================================
// AUTH HELPERS
// ============================================================

export const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
};

export const getUserProfile = async (userId) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    if (error) throw error;
    return data;
};

// ============================================================
// PROPERTIES
// ============================================================

export const getProperties = async () => {
    const user = await getCurrentUser();

    // Use SECURITY DEFINER RPC to get properties (bypasses any RLS recursion)
    const { data: properties, error } = await supabase
        .rpc('get_properties_for_landlord', { landlord_uuid: user.id });
    if (error) throw error;
    if (!properties || properties.length === 0) return [];

    // Fetch rooms via SECURITY DEFINER RPC too (bypasses RLS on rooms)
    const { data: rooms } = await supabase
        .rpc('get_rooms_for_landlord', { landlord_uuid: user.id });

    const roomsByProperty = {};
    (rooms || []).forEach(r => {
        if (!roomsByProperty[r.property_id]) roomsByProperty[r.property_id] = [];
        roomsByProperty[r.property_id].push(r);
    });

    return properties.map(p => {
        const propRooms = roomsByProperty[p.id] || [];
        return {
            ...p,
            totalRooms: propRooms.length,
            occupiedRooms: propRooms.filter(r => r.is_occupied).length,
            vacantRooms: propRooms.filter(r => !r.is_occupied).length,
            monthlyRent: propRooms.filter(r => r.is_occupied).reduce((sum, r) => sum + Number(r.rent_amount), 0),
        };
    });
};

export const getPropertyById = async (propertyId) => {
    const { data, error } = await supabase
        .from('properties')
        .select(`*, rooms (*)`)
        .eq('id', propertyId)
        .single();
    if (error) throw error;
    return data;
};

export const createProperty = async (propertyData) => {
    const user = await getCurrentUser();
    const { data, error } = await supabase
        .from('properties')
        .insert({ ...propertyData, landlord_id: user.id })
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const updateProperty = async (propertyId, updates) => {
    const { data, error } = await supabase
        .from('properties')
        .update(updates)
        .eq('id', propertyId)
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const deleteProperty = async (propertyId) => {
    const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', propertyId);
    if (error) throw error;
};

// ============================================================
// ROOMS
// ============================================================

export const getRoomsByProperty = async (propertyId) => {
    const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('property_id', propertyId)
        .order('floor', { ascending: true })
        .order('room_number', { ascending: true });
    if (error) throw error;
    return data;
};

export const getVacantRooms = async (propertyId) => {
    // Use SECURITY DEFINER RPC to bypass RLS on rooms table
    const { data, error } = await supabase
        .rpc('get_vacant_rooms_for_property', { property_uuid: propertyId });
    if (error) throw error;
    return data || [];
};

export const createRoom = async (roomData) => {
    const { data, error } = await supabase
        .from('rooms')
        .insert(roomData)
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const createRooms = async (rooms) => {
    const { data, error } = await supabase
        .from('rooms')
        .insert(rooms)
        .select();
    if (error) throw error;
    return data;
};

// Use RPC to bypass RLS recursion when creating a full PG setup
export const createPGSetup = async ({ name, address, totalFloors, landlordId, rooms }) => {
    const { data, error } = await supabase.rpc('create_pg_setup', {
        p_name: name,
        p_address: address,
        p_total_floors: totalFloors,
        p_landlord_id: landlordId,
        p_rooms: rooms,
    });
    if (error) throw error;
    return data;
};

export const updateRoom = async (roomId, updates) => {
    const { data, error } = await supabase
        .from('rooms')
        .update(updates)
        .eq('id', roomId)
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const deleteRoom = async (roomId) => {
    const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', roomId);
    if (error) throw error;
};

// ============================================================
// TENANTS
// ============================================================

export const getTenants = async () => {
    const user = await getCurrentUser();

    // Use SECURITY DEFINER RPC — single join across tenants+rooms+properties, bypasses RLS
    const { data, error } = await supabase
        .rpc('get_tenants_for_landlord', { landlord_uuid: user.id });
    if (error) throw error;
    return data || [];
};

export const getTenantById = async (tenantId) => {
    const { data: tenant, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single();
    if (error) throw error;

    const { data: room } = await supabase
        .from('rooms')
        .select('id, room_number, floor, rent_amount, property_id')
        .eq('id', tenant.room_id)
        .single();

    const { data: property } = room
        ? await supabase.from('properties').select('id, name').eq('id', room.property_id).single()
        : { data: null };

    return {
        ...tenant,
        room_number: room?.room_number,
        rent_amount: room?.rent_amount,
        property_id: property?.id,
        property_name: property?.name,
    };
};

export const getTenantByUserId = async (userId) => {
    // Use SECURITY DEFINER RPC — raw table queries for rooms/properties are blocked by RLS for tenant-role users
    const { data: rows, error } = await supabase
        .rpc('get_tenant_by_user_id', { p_user_id: userId });
    if (error) throw error;
    const tenant = rows?.[0];
    if (!tenant) throw new Error('No active tenant record linked to your account.');
    return tenant;
};

export const createTenant = async (tenantData) => {
    // Use SECURITY DEFINER RPC — bypasses tenants↔rooms RLS recursion entirely.
    // The RPC also marks the room as occupied atomically.
    const { data, error } = await supabase.rpc('create_tenant_for_landlord', {
        p_full_name: tenantData.full_name,
        p_contact: tenantData.contact,
        p_room_id: tenantData.room_id,
        p_move_in_date: tenantData.move_in_date,
        p_emergency_contact_name: tenantData.emergency_contact_name || null,
        p_emergency_contact_phone: tenantData.emergency_contact_phone || null,
        p_company: tenantData.company || null,
        p_expected_stay_months: tenantData.expected_stay_months || null,
        p_has_bike: tenantData.has_bike || false,
        p_has_car: tenantData.has_car || false,
    });
    if (error) throw error;
    return data; // returns the new tenant UUID
};

export const updateTenant = async (tenantId, updates) => {
    // Use SECURITY DEFINER RPC — bypasses RLS, handles room transfer atomically
    const { error } = await supabase.rpc('update_tenant_for_landlord', {
        p_tenant_id: tenantId,
        p_full_name: updates.full_name,
        p_contact: updates.contact,
        p_move_in_date: updates.move_in_date,
        p_emergency_contact_name: updates.emergency_contact_name || null,
        p_emergency_contact_phone: updates.emergency_contact_phone || null,
        p_company: updates.company || null,
        p_expected_stay_months: updates.expected_stay_months ? parseInt(updates.expected_stay_months) : null,
        p_has_bike: updates.has_bike || false,
        p_has_car: updates.has_car || false,
        p_new_room_id: updates.new_room_id || null,
    });
    if (error) throw error;
};

export const deactivateTenant = async (tenantId) => {
    // Use SECURITY DEFINER RPC — soft-deletes tenant and frees the room atomically
    const { error } = await supabase.rpc('deactivate_tenant_for_landlord', {
        p_tenant_id: tenantId,
    });
    if (error) throw error;
};

// ============================================================
// PAYMENTS
// ============================================================

export const getPayments = async () => {
    const user = await getCurrentUser();

    // Use SECURITY DEFINER RPC — bypasses payments→tenants→rooms RLS recursion entirely
    const { data, error } = await supabase
        .rpc('get_payments_for_landlord', { landlord_uuid: user.id });
    if (error) throw error;
    if (!data || data.length === 0) return [];

    // Map flat RPC result to nested shape that PaymentDashboard expects
    return data.map(row => ({
        id: row.id,
        tenant_id: row.tenant_id,
        amount: row.amount,
        due_date: row.due_date,
        paid_date: row.paid_date,
        status: row.status,
        payment_method: row.payment_method,
        transaction_id: row.transaction_id,
        created_at: row.created_at,
        tenants: {
            id: row.tenant_id,
            full_name: row.tenant_name,
            contact: row.tenant_contact,
            rooms: {
                room_number: row.room_number,
                properties: { name: row.property_name },
            },
        },
    }));
};

export const generateMonthlyPayments = async (targetMonthDate) => {
    const user = await getCurrentUser();
    // targetMonthDate should be the 1st of the month, e.g. '2026-02-01'
    const { data, error } = await supabase.rpc('generate_monthly_payments_for_landlord', {
        landlord_uuid: user.id,
        target_month: targetMonthDate,
    });
    if (error) throw error;
    return data; // number of payment records created
};


export const getPaymentsByTenant = async (tenantId) => {
    const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('due_date', { ascending: false });
    if (error) throw error;
    return data;
};

export const createPayment = async (paymentData) => {
    const { data, error } = await supabase
        .from('payments')
        .insert(paymentData)
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const updatePayment = async (paymentId, updates) => {
    // updates: { amount, status, payment_method, transaction_id }
    const { error } = await supabase.rpc('update_payment_for_landlord', {
        p_payment_id: paymentId,
        p_amount: updates.amount, // numeric
        p_status: updates.status, // 'pending', 'paid', 'overdue'
        p_payment_method: updates.payment_method || null,
        p_transaction_id: updates.transaction_id || null,
    });
    if (error) throw error;
};

export const deletePayment = async (paymentId) => {
    const { error } = await supabase.rpc('delete_payment_for_landlord', {
        p_payment_id: paymentId,
    });
    if (error) throw error;
};

// ============================================================
// COMPLAINTS
// ============================================================

export const getComplaints = async () => {
    const { data: complaints, error } = await supabase
        .from('complaints')
        .select('*, properties (name)')
        .order('created_at', { ascending: false });
    if (error) throw error;
    if (!complaints || complaints.length === 0) return [];

    // Fetch tenant names separately to avoid recursive RLS via tenants→rooms
    const tenantIds = [...new Set(complaints.map(c => c.tenant_id).filter(Boolean))];
    const { data: tenants } = tenantIds.length > 0
        ? await supabase.from('tenants').select('id, full_name, contact').in('id', tenantIds)
        : { data: [] };

    const tenantMap = {};
    (tenants || []).forEach(t => { tenantMap[t.id] = t; });

    return complaints.map(c => ({
        ...c,
        tenants: tenantMap[c.tenant_id] || null,
    }));
};


export const getComplaintsByTenant = async (tenantId) => {
    // Select complaints only — tenants cannot join properties table (RLS blocks it)
    const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
};

export const createComplaint = async (complaintData) => {
    const { data, error } = await supabase
        .from('complaints')
        .insert(complaintData)
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const updateComplaintStatus = async (complaintId, status) => {
    const updates = { status };
    if (status === 'resolved') {
        updates.resolved_at = new Date().toISOString();
    }
    const { data, error } = await supabase
        .from('complaints')
        .update(updates)
        .eq('id', complaintId)
        .select()
        .single();
    if (error) throw error;
    return data;
};

// ============================================================
// DASHBOARD STATS
// ============================================================

export const getLandlordStats = async () => {
    const user = await getCurrentUser();

    // Get all properties
    const { data: properties, error: propError } = await supabase
        .from('properties')
        .select('id')
        .eq('landlord_id', user.id);
    if (propError) throw propError;

    const propertyIds = properties.map(p => p.id);

    if (propertyIds.length === 0) {
        return {
            totalPGs: 0,
            totalRooms: 0,
            totalTenants: 0,
            rentCollected: 0,
            pendingRent: 0,
            urgentComplaints: 0,
            normalComplaints: 0,
        };
    }

    // Get rooms via SECURITY DEFINER RPC to bypass RLS recursion
    const { data: rooms, error: roomsError } = await supabase
        .rpc('get_rooms_for_landlord', { landlord_uuid: user.id });
    if (roomsError) console.error('get_rooms_for_landlord error:', roomsError);

    const roomIds = (rooms || []).map(r => r.id);

    // Get active tenants via SECURITY DEFINER RPC to bypass RLS recursion
    const { data: tenants, error: tenantsError } = await supabase
        .rpc('get_tenant_ids_for_landlord', { landlord_uuid: user.id });
    if (tenantsError) console.error('get_tenant_ids_for_landlord error:', tenantsError);

    const tenantIds = (tenants || []).map(t => t.id);

    // Get current month payments via SECURITY DEFINER RPC (bypasses payments RLS recursion)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const { data: allPayments } = await supabase
        .rpc('get_payments_for_landlord', { landlord_uuid: user.id });

    const payments = (allPayments || []).filter(p =>
        p.due_date >= monthStart && p.due_date <= monthEnd
    );

    // Get complaints (complaints table joins only properties, no tenants → safe)
    const { data: complaints } = await supabase
        .from('complaints')
        .select('priority, status')
        .in('property_id', propertyIds)
        .neq('status', 'resolved');

    const rentCollected = payments
        .filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + Number(p.amount), 0);

    const pendingRent = payments
        .filter(p => p.status !== 'paid')
        .reduce((sum, p) => sum + Number(p.amount), 0);

    return {
        totalPGs: propertyIds.length,
        totalRooms: (rooms || []).length,
        totalTenants: tenantIds.length,
        rentCollected,
        pendingRent,
        urgentComplaints: (complaints || []).filter(c => c.priority === 'urgent').length,
        normalComplaints: (complaints || []).filter(c => c.priority === 'normal').length,
    };
};

export const getTenantDashboardData = async () => {
    const user = await getCurrentUser();

    // Use SECURITY DEFINER RPC — gets tenant with full room+property info, bypasses RLS
    const { data: rows, error } = await supabase
        .rpc('get_tenant_by_user_id', { p_user_id: user.id });
    if (error) throw error;
    const tenant = rows?.[0] ?? null;
    if (!tenant) throw new Error('No active tenant record linked to your account.');

    // Get current month payment (tenant queries own payments — allowed by "Tenants can view own payments" policy)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const { data: currentPayment } = await supabase
        .from('payments')
        .select('*')
        .eq('tenant_id', tenant.id)
        .gte('due_date', monthStart)
        .lte('due_date', monthEnd)
        .order('due_date', { ascending: false })
        .limit(1)
        .maybeSingle();

    // Get active complaints count
    const { count: activeComplaints } = await supabase
        .from('complaints')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .neq('status', 'resolved');

    return {
        tenant,
        currentPayment,
        activeComplaints: activeComplaints || 0,
    };
};

// Link an unregistered tenant record to a new auth account by matching contact number
export const linkTenantToUser = async (contact) => {
    const user = await getCurrentUser();
    const { data, error } = await supabase.rpc('link_tenant_to_user', {
        p_user_id: user.id,
        p_contact: contact,
    });
    if (error) throw error;
    if (!data || data.length === 0) {
        throw new Error('No tenant record found for this contact number. Please contact your landlord.');
    }
    return data[0];
};

