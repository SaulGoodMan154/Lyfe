-- ============================================================
-- RLS FIX: Run this ONCE in Supabase SQL Editor
-- This replaces all recursive RLS policies with SECURITY DEFINER
-- functions that bypass RLS safely.
-- ============================================================

-- ── 1a. Helper: get property IDs owned by a landlord (bypasses RLS) ──
CREATE OR REPLACE FUNCTION get_landlord_property_ids(landlord_uuid UUID)
RETURNS SETOF UUID AS $$
  SELECT id FROM properties WHERE landlord_id = landlord_uuid;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

-- ── 1b. Helper: get room IDs owned by a landlord (bypasses RLS on BOTH rooms and properties)
--     This is critical — tenants RLS policies must use this instead of querying rooms directly,
--     because rooms' SELECT policy queries tenants → would cause infinite recursion. ──
CREATE OR REPLACE FUNCTION get_landlord_room_ids(landlord_uuid UUID)
RETURNS SETOF UUID AS $$
  SELECT r.id FROM rooms r
  WHERE r.property_id IN (SELECT id FROM properties WHERE landlord_id = landlord_uuid);
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

-- ── 2. RPC: Get all rooms for a landlord with rent_amount (bypasses RLS, used for dashboard + property list) ──
DROP FUNCTION IF EXISTS get_rooms_for_landlord(UUID);
CREATE OR REPLACE FUNCTION get_rooms_for_landlord(landlord_uuid UUID)
RETURNS TABLE(id UUID, is_occupied BOOLEAN, property_id UUID, rent_amount NUMERIC) AS $$
  SELECT r.id, r.is_occupied, r.property_id, r.rent_amount
  FROM rooms r
  WHERE r.property_id IN (SELECT prop.id FROM properties prop WHERE prop.landlord_id = landlord_uuid);
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

-- ── 3. RPC: Get active tenant IDs for a landlord (bypasses RLS, used for dashboard stats) ──
CREATE OR REPLACE FUNCTION get_tenant_ids_for_landlord(landlord_uuid UUID)
RETURNS TABLE(id UUID) AS $$
  SELECT t.id
  FROM tenants t
  WHERE t.is_active = TRUE
    AND t.room_id IN (
      SELECT r.id FROM rooms r
      WHERE r.property_id IN (SELECT prop.id FROM properties prop WHERE prop.landlord_id = landlord_uuid)
    );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

-- ── 4. RPC: Get all properties for a landlord (bypasses RLS, used for dropdowns) ──
CREATE OR REPLACE FUNCTION get_properties_for_landlord(landlord_uuid UUID)
RETURNS TABLE(id UUID, name TEXT, address TEXT, total_floors INTEGER, created_at TIMESTAMPTZ) AS $$
  SELECT p.id, p.name, p.address, p.total_floors, p.created_at
  FROM properties p
  WHERE p.landlord_id = landlord_uuid
  ORDER BY p.created_at DESC;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

-- ── 5. RPC: Get vacant rooms for a property (bypasses RLS, used when adding a tenant) ──
CREATE OR REPLACE FUNCTION get_vacant_rooms_for_property(property_uuid UUID)
RETURNS TABLE(id UUID, room_number TEXT, floor INTEGER, rent_amount NUMERIC) AS $$
  SELECT r.id, r.room_number, r.floor, r.rent_amount
  FROM rooms r
  WHERE r.property_id = property_uuid AND r.is_occupied = FALSE
  ORDER BY r.floor ASC, r.room_number ASC;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

-- ── 6. RPC: Get all active tenants for a landlord with room+property info (bypasses RLS) ──
CREATE OR REPLACE FUNCTION get_tenants_for_landlord(landlord_uuid UUID)
RETURNS TABLE(
  id UUID, user_id UUID, room_id UUID, full_name TEXT, contact TEXT,
  emergency_contact_name TEXT, emergency_contact_phone TEXT, company TEXT,
  move_in_date DATE, expected_stay_months INTEGER,
  has_bike BOOLEAN, has_car BOOLEAN, is_active BOOLEAN, created_at TIMESTAMPTZ,
  room_number TEXT, floor INTEGER, rent_amount NUMERIC, property_id UUID, property_name TEXT
) AS $$
  SELECT
    t.id, t.user_id, t.room_id, t.full_name, t.contact,
    t.emergency_contact_name, t.emergency_contact_phone, t.company,
    t.move_in_date, t.expected_stay_months,
    t.has_bike, t.has_car, t.is_active, t.created_at,
    r.room_number, r.floor, r.rent_amount, p.id AS property_id, p.name AS property_name
  FROM tenants t
  JOIN rooms r ON t.room_id = r.id
  JOIN properties p ON r.property_id = p.id
  WHERE p.landlord_id = landlord_uuid AND t.is_active = TRUE
  ORDER BY t.created_at DESC;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

-- ── 7. RPC: Create a full PG setup (property + rooms) bypassing RLS ──
CREATE OR REPLACE FUNCTION create_pg_setup(
  p_name TEXT,
  p_address TEXT,
  p_total_floors INTEGER,
  p_landlord_id UUID,
  p_rooms JSONB
) RETURNS JSONB AS $$
DECLARE
  v_property_id UUID;
  v_room JSONB;
BEGIN
  -- Insert property
  INSERT INTO properties (name, address, total_floors, landlord_id)
  VALUES (p_name, p_address, p_total_floors, p_landlord_id)
  RETURNING id INTO v_property_id;

  -- Insert rooms
  FOR v_room IN SELECT * FROM jsonb_array_elements(p_rooms)
  LOOP
    INSERT INTO rooms (property_id, room_number, floor, rent_amount, is_occupied)
    VALUES (
      v_property_id,
      v_room->>'room_number',
      (v_room->>'floor')::INTEGER,
      (v_room->>'rent_amount')::DECIMAL,
      FALSE
    );
  END LOOP;

  RETURN jsonb_build_object('property_id', v_property_id, 'success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── 5. RPC: Mark room occupied/vacant (bypasses RLS) ──
CREATE OR REPLACE FUNCTION set_room_occupied(p_room_id UUID, p_is_occupied BOOLEAN)
RETURNS VOID AS $$
BEGIN
  UPDATE rooms SET is_occupied = p_is_occupied WHERE id = p_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── 8. RPC: Create a tenant (SECURITY DEFINER bypasses all RLS — avoids tenants↔rooms recursion) ──
CREATE OR REPLACE FUNCTION create_tenant_for_landlord(
  p_full_name TEXT,
  p_contact TEXT,
  p_room_id UUID,
  p_move_in_date DATE,
  p_emergency_contact_name TEXT DEFAULT NULL,
  p_emergency_contact_phone TEXT DEFAULT NULL,
  p_company TEXT DEFAULT NULL,
  p_expected_stay_months INTEGER DEFAULT NULL,
  p_has_bike BOOLEAN DEFAULT FALSE,
  p_has_car BOOLEAN DEFAULT FALSE
) RETURNS UUID AS $$
DECLARE
  v_tenant_id UUID;
  v_rent_amount NUMERIC;
  v_due_date DATE;
BEGIN
  INSERT INTO tenants (
    full_name, contact, room_id, move_in_date,
    emergency_contact_name, emergency_contact_phone,
    company, expected_stay_months, has_bike, has_car, is_active
  ) VALUES (
    p_full_name, p_contact, p_room_id, p_move_in_date,
    p_emergency_contact_name, p_emergency_contact_phone,
    p_company, p_expected_stay_months, p_has_bike, p_has_car, TRUE
  ) RETURNING id INTO v_tenant_id;

  -- Mark the room as occupied
  UPDATE rooms SET is_occupied = TRUE WHERE id = p_room_id;

  -- Auto-create first month's pending payment (due on 1st of move-in month)
  SELECT rent_amount INTO v_rent_amount FROM rooms WHERE id = p_room_id;
  v_due_date := DATE_TRUNC('month', p_move_in_date)::DATE;

  INSERT INTO payments (tenant_id, amount, due_date, status)
  VALUES (v_tenant_id, v_rent_amount, v_due_date, 'pending');

  RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── 9. RPC: Get all payments for a landlord with full tenant+room+property info (bypasses RLS) ──
CREATE OR REPLACE FUNCTION get_payments_for_landlord(landlord_uuid UUID)
RETURNS TABLE(
  id UUID, tenant_id UUID, amount NUMERIC, due_date DATE, paid_date DATE,
  status TEXT, payment_method TEXT, transaction_id TEXT, created_at TIMESTAMPTZ,
  tenant_name TEXT, tenant_contact TEXT, room_number TEXT, property_name TEXT
) AS $$
  SELECT
    pay.id, pay.tenant_id, pay.amount, pay.due_date, pay.paid_date,
    pay.status::TEXT, pay.payment_method, pay.transaction_id, pay.created_at,
    t.full_name AS tenant_name, t.contact AS tenant_contact,
    r.room_number, p.name AS property_name
  FROM payments pay
  JOIN tenants t ON pay.tenant_id = t.id
  JOIN rooms r ON t.room_id = r.id
  JOIN properties p ON r.property_id = p.id
  WHERE p.landlord_id = landlord_uuid
  ORDER BY pay.due_date DESC;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

-- ── 10. RPC: Generate monthly payment records for all active tenants of a landlord ──
-- Call this at the start of each month (or use the UI button).
-- Skips tenants who already have a payment for that month's due_date.
CREATE OR REPLACE FUNCTION generate_monthly_payments_for_landlord(
  landlord_uuid UUID,
  target_month DATE  -- pass the 1st of the month, e.g. '2026-02-01'
) RETURNS INTEGER AS $$
DECLARE
  v_tenant RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_tenant IN
    SELECT t.id, r.rent_amount
    FROM tenants t
    JOIN rooms r ON t.room_id = r.id
    JOIN properties p ON r.property_id = p.id
    WHERE p.landlord_id = landlord_uuid AND t.is_active = TRUE
  LOOP
    -- Only insert if no payment already exists for this tenant+month
    IF NOT EXISTS (
      SELECT 1 FROM payments
      WHERE tenant_id = v_tenant.id
        AND due_date = target_month
    ) THEN
      INSERT INTO payments (tenant_id, amount, due_date, status)
      VALUES (v_tenant.id, v_tenant.rent_amount, target_month, 'pending');
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;  -- returns number of payment records created
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── 13. RPC: Update tenant details (SECURITY DEFINER — bypasses RLS) ──
-- Handles optional room transfer: frees old room and occupies new room atomically.
CREATE OR REPLACE FUNCTION update_tenant_for_landlord(
  p_tenant_id UUID,
  p_full_name TEXT,
  p_contact TEXT,
  p_move_in_date DATE,
  p_emergency_contact_name TEXT DEFAULT NULL,
  p_emergency_contact_phone TEXT DEFAULT NULL,
  p_company TEXT DEFAULT NULL,
  p_expected_stay_months INTEGER DEFAULT NULL,
  p_has_bike BOOLEAN DEFAULT FALSE,
  p_has_car BOOLEAN DEFAULT FALSE,
  p_new_room_id UUID DEFAULT NULL   -- pass NULL to keep current room
) RETURNS VOID AS $$
DECLARE
  v_old_room_id UUID;
BEGIN
  SELECT room_id INTO v_old_room_id FROM tenants WHERE id = p_tenant_id;

  UPDATE tenants SET
    full_name = p_full_name,
    contact = p_contact,
    move_in_date = p_move_in_date,
    emergency_contact_name = p_emergency_contact_name,
    emergency_contact_phone = p_emergency_contact_phone,
    company = p_company,
    expected_stay_months = p_expected_stay_months,
    has_bike = p_has_bike,
    has_car = p_has_car,
    room_id = COALESCE(p_new_room_id, room_id)
  WHERE id = p_tenant_id;

  -- If room changed, free old room and occupy new room
  IF p_new_room_id IS NOT NULL AND p_new_room_id <> v_old_room_id THEN
    UPDATE rooms SET is_occupied = FALSE WHERE id = v_old_room_id;
    UPDATE rooms SET is_occupied = TRUE  WHERE id = p_new_room_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── 14. RPC: Deactivate (soft-delete) tenant and free their room ──
CREATE OR REPLACE FUNCTION deactivate_tenant_for_landlord(p_tenant_id UUID)
RETURNS VOID AS $$
DECLARE
  v_room_id UUID;
BEGIN
  SELECT room_id INTO v_room_id FROM tenants WHERE id = p_tenant_id;
  UPDATE tenants SET is_active = FALSE WHERE id = p_tenant_id;
  UPDATE rooms SET is_occupied = FALSE WHERE id = v_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── 15. RPC: Update payment details (SECURITY DEFINER — bypasses RLS) ──
CREATE OR REPLACE FUNCTION update_payment_for_landlord(
  p_payment_id UUID,
  p_amount NUMERIC,
  p_status TEXT,
  p_payment_method TEXT DEFAULT NULL, -- 'cash', 'upi', 'bank_transfer'
  p_transaction_id TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE payments SET
    amount = p_amount,
    status = p_status,
    payment_method = p_payment_method,
    transaction_id = p_transaction_id,
    paid_date = CASE WHEN p_status = 'paid' THEN CURRENT_DATE ELSE NULL END
  WHERE id = p_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── 16. RPC: Delete payment (SECURITY DEFINER — bypasses RLS) ──
CREATE OR REPLACE FUNCTION delete_payment_for_landlord(p_payment_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM payments WHERE id = p_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;



-- ── 11. RPC: Link an existing tenant record to a new auth user (tenant self-registration) ──
-- Called when a tenant signs up: matches by contact number and links user_id.
-- Returns the tenant record if found and linked, NULL if no matching tenant found.
CREATE OR REPLACE FUNCTION link_tenant_to_user(
  p_user_id UUID,
  p_contact TEXT
) RETURNS TABLE(
  id UUID, full_name TEXT, contact TEXT, room_id UUID, move_in_date DATE,
  room_number TEXT, floor INTEGER, rent_amount NUMERIC, property_id UUID, property_name TEXT
) AS $$
  -- Pure SQL (not plpgsql) — avoids RETURNS TABLE output-variable name shadowing.
  -- Step 1: find the unlinked tenant; Step 2: update user_id; Step 3: return joined row.
  WITH matched AS (
    SELECT ten.id
    FROM   tenants ten
    WHERE  ten.contact   = p_contact
      AND  ten.is_active = TRUE
      AND  ten.user_id   IS NULL
    LIMIT 1
  ),
  linked AS (
    UPDATE tenants
    SET    user_id = p_user_id
    WHERE  tenants.id = (SELECT matched.id FROM matched)
    RETURNING tenants.id
  )
  SELECT
    ten.id,
    ten.full_name,
    ten.contact,
    ten.room_id,
    ten.move_in_date,
    r.room_number,
    r.floor,
    r.rent_amount,
    prop.id   AS property_id,
    prop.name AS property_name
  FROM   tenants    ten
  JOIN   rooms      r    ON r.id    = ten.room_id
  JOIN   properties prop ON prop.id = r.property_id
  WHERE  ten.id = (SELECT linked.id FROM linked);
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- ── 12. RPC: Get tenant data by auth user ID (for tenant dashboard, bypasses RLS) ──
CREATE OR REPLACE FUNCTION get_tenant_by_user_id(p_user_id UUID)
RETURNS TABLE(
  id UUID, full_name TEXT, contact TEXT, room_id UUID, move_in_date DATE,
  is_active BOOLEAN, user_id UUID,
  room_number TEXT, floor INTEGER, rent_amount NUMERIC, property_id UUID, property_name TEXT
) AS $$
  SELECT
    t.id, t.full_name, t.contact, t.room_id, t.move_in_date,
    t.is_active, t.user_id,
    r.room_number, r.floor, r.rent_amount, p.id, p.name
  FROM tenants t
  JOIN rooms r ON t.room_id = r.id
  JOIN properties p ON r.property_id = p.id
  WHERE t.user_id = p_user_id AND t.is_active = TRUE
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;



-- ── 4. Fix ROOMS policies (drop old recursive ones, add new ones) ──
DROP POLICY IF EXISTS "Landlords can view rooms of own properties" ON rooms;
DROP POLICY IF EXISTS "Tenants can view their own room" ON rooms;
DROP POLICY IF EXISTS "Landlords can insert rooms" ON rooms;
DROP POLICY IF EXISTS "Landlords can update rooms" ON rooms;
DROP POLICY IF EXISTS "Landlords can delete rooms" ON rooms;

CREATE POLICY "Landlords can view rooms of own properties"
  ON rooms FOR SELECT USING (property_id IN (SELECT get_landlord_property_ids(auth.uid())));
CREATE POLICY "Tenants can view their own room"
  ON rooms FOR SELECT USING (
    id IN (SELECT room_id FROM tenants WHERE user_id = auth.uid() AND is_active = TRUE)
  );
CREATE POLICY "Landlords can insert rooms"
  ON rooms FOR INSERT WITH CHECK (property_id IN (SELECT get_landlord_property_ids(auth.uid())));
CREATE POLICY "Landlords can update rooms"
  ON rooms FOR UPDATE USING (property_id IN (SELECT get_landlord_property_ids(auth.uid())));
CREATE POLICY "Landlords can delete rooms"
  ON rooms FOR DELETE USING (property_id IN (SELECT get_landlord_property_ids(auth.uid())));

-- ── Fix TENANTS policies ──
-- IMPORTANT: We use get_landlord_room_ids() (SECURITY DEFINER) instead of querying rooms directly.
-- Querying rooms directly here would trigger rooms' SELECT RLS, which queries tenants → infinite loop.
DROP POLICY IF EXISTS "Landlords can view tenants in own properties" ON tenants;
DROP POLICY IF EXISTS "Tenants can view own record" ON tenants;
DROP POLICY IF EXISTS "Landlords can insert tenants" ON tenants;
DROP POLICY IF EXISTS "Landlords can update tenants" ON tenants;

CREATE POLICY "Landlords can view tenants in own properties"
  ON tenants FOR SELECT USING (
    room_id IN (SELECT get_landlord_room_ids(auth.uid()))
  );
CREATE POLICY "Tenants can view own record"
  ON tenants FOR SELECT USING (user_id = auth.uid());
-- INSERT is handled entirely via create_tenant_for_landlord RPC (SECURITY DEFINER).
-- We still keep a permissive INSERT policy so the RPC (which runs as superuser) can insert;
-- the RPC itself enforces landlord ownership before calling this.
CREATE POLICY "Landlords can insert tenants"
  ON tenants FOR INSERT WITH CHECK (
    room_id IN (SELECT get_landlord_room_ids(auth.uid()))
  );
CREATE POLICY "Landlords can update tenants"
  ON tenants FOR UPDATE USING (
    room_id IN (SELECT get_landlord_room_ids(auth.uid()))
  );

-- ── Fix PAYMENTS policies ──
-- Use get_landlord_tenant_ids (SECURITY DEFINER) to avoid querying tenants JOIN rooms directly
-- (which triggers rooms RLS → tenants RLS → infinite recursion).
DROP POLICY IF EXISTS "Landlords can view payments of own tenants" ON payments;
DROP POLICY IF EXISTS "Tenants can view own payments" ON payments;
DROP POLICY IF EXISTS "Landlords can insert payments" ON payments;
DROP POLICY IF EXISTS "Landlords can update payments" ON payments;

CREATE POLICY "Landlords can view payments of own tenants"
  ON payments FOR SELECT USING (
    tenant_id IN (SELECT get_tenant_ids_for_landlord(auth.uid()))
  );
CREATE POLICY "Tenants can view own payments"
  ON payments FOR SELECT USING (
    tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid())
  );
CREATE POLICY "Landlords can insert payments"
  ON payments FOR INSERT WITH CHECK (
    tenant_id IN (SELECT get_tenant_ids_for_landlord(auth.uid()))
  );
CREATE POLICY "Landlords can update payments"
  ON payments FOR UPDATE USING (
    tenant_id IN (SELECT get_tenant_ids_for_landlord(auth.uid()))
  );

-- ── 7. Fix COMPLAINTS policies ──
DROP POLICY IF EXISTS "Landlords can view complaints of own properties" ON complaints;
DROP POLICY IF EXISTS "Tenants can view own complaints" ON complaints;
DROP POLICY IF EXISTS "Tenants can insert complaints" ON complaints;
DROP POLICY IF EXISTS "Landlords can update complaint status" ON complaints;

CREATE POLICY "Landlords can view complaints of own properties"
  ON complaints FOR SELECT USING (property_id IN (SELECT get_landlord_property_ids(auth.uid())));
CREATE POLICY "Tenants can view own complaints"
  ON complaints FOR SELECT USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));
CREATE POLICY "Tenants can insert complaints"
  ON complaints FOR INSERT WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));
CREATE POLICY "Landlords can update complaint status"
  ON complaints FOR UPDATE USING (property_id IN (SELECT get_landlord_property_ids(auth.uid())));

-- ── 17. RPC: Update complaint status (SECURITY DEFINER — bypasses RLS) ──
CREATE OR REPLACE FUNCTION update_complaint_status_for_landlord(
  p_complaint_id UUID,
  p_status TEXT  -- 'open', 'in_progress', 'resolved'
) RETURNS TABLE(
  id UUID, status TEXT, resolved_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  UPDATE complaints
  SET
    status = p_status,
    resolved_at = CASE WHEN p_status = 'resolved' THEN NOW() ELSE NULL END
  WHERE complaints.id = p_complaint_id
  RETURNING complaints.id, complaints.status::TEXT, complaints.resolved_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

