-- ============================================================
-- PG App - Supabase Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES TABLE (extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('landlord', 'tenant')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'tenant')
  );
  RETURN NEW;
END;
-- SET search_path is required by Supabase for SECURITY DEFINER functions
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- PROPERTIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS properties (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  landlord_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  total_floors INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROOMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS rooms (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  room_number TEXT NOT NULL,
  floor INTEGER NOT NULL DEFAULT 1,
  rent_amount DECIMAL(10, 2) NOT NULL,
  is_occupied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, room_number)
);

-- ============================================================
-- TENANTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL NOT NULL,
  full_name TEXT NOT NULL,
  contact TEXT NOT NULL,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  company TEXT,
  move_in_date DATE NOT NULL,
  expected_stay_months INTEGER,
  has_bike BOOLEAN DEFAULT FALSE,
  has_car BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PAYMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  payment_method TEXT,
  transaction_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COMPLAINTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS complaints (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
-- INSERT: allow the trigger (handle_new_user) to create profiles on signup
CREATE POLICY "Service role can insert profiles"
  ON profiles FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- PROPERTIES policies (landlord only)
CREATE POLICY "Landlords can view own properties"
  ON properties FOR SELECT USING (landlord_id = auth.uid());

CREATE POLICY "Landlords can insert own properties"
  ON properties FOR INSERT WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Landlords can update own properties"
  ON properties FOR UPDATE USING (landlord_id = auth.uid());

CREATE POLICY "Landlords can delete own properties"
  ON properties FOR DELETE USING (landlord_id = auth.uid());

-- ============================================================
-- HELPER FUNCTION: bypass RLS when checking property ownership
-- SECURITY DEFINER means it runs as the function owner (bypasses RLS)
-- This prevents infinite recursion in RLS policies
-- ============================================================
CREATE OR REPLACE FUNCTION get_landlord_property_ids(landlord_uuid UUID)
RETURNS SETOF UUID AS $$
  SELECT id FROM properties WHERE landlord_id = landlord_uuid;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

-- ROOMS policies
CREATE POLICY "Landlords can view rooms of own properties"
  ON rooms FOR SELECT USING (
    property_id IN (SELECT get_landlord_property_ids(auth.uid()))
  );

CREATE POLICY "Tenants can view their own room"
  ON rooms FOR SELECT USING (
    id IN (SELECT room_id FROM tenants WHERE user_id = auth.uid() AND is_active = TRUE)
  );

CREATE POLICY "Landlords can insert rooms"
  ON rooms FOR INSERT WITH CHECK (
    property_id IN (SELECT get_landlord_property_ids(auth.uid()))
  );

CREATE POLICY "Landlords can update rooms"
  ON rooms FOR UPDATE USING (
    property_id IN (SELECT get_landlord_property_ids(auth.uid()))
  );

CREATE POLICY "Landlords can delete rooms"
  ON rooms FOR DELETE USING (
    property_id IN (SELECT get_landlord_property_ids(auth.uid()))
  );


-- TENANTS policies
CREATE POLICY "Landlords can view tenants in own properties"
  ON tenants FOR SELECT USING (
    room_id IN (
      SELECT id FROM rooms WHERE property_id IN (SELECT get_landlord_property_ids(auth.uid()))
    )
  );

CREATE POLICY "Tenants can view own record"
  ON tenants FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Landlords can insert tenants"
  ON tenants FOR INSERT WITH CHECK (
    room_id IN (
      SELECT id FROM rooms WHERE property_id IN (SELECT get_landlord_property_ids(auth.uid()))
    )
  );

CREATE POLICY "Landlords can update tenants"
  ON tenants FOR UPDATE USING (
    room_id IN (
      SELECT id FROM rooms WHERE property_id IN (SELECT get_landlord_property_ids(auth.uid()))
    )
  );

-- PAYMENTS policies
CREATE POLICY "Landlords can view payments of own tenants"
  ON payments FOR SELECT USING (
    tenant_id IN (
      SELECT t.id FROM tenants t
      JOIN rooms r ON t.room_id = r.id
      WHERE r.property_id IN (SELECT get_landlord_property_ids(auth.uid()))
    )
  );

CREATE POLICY "Tenants can view own payments"
  ON payments FOR SELECT USING (
    tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid())
  );

CREATE POLICY "Landlords can insert payments"
  ON payments FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT t.id FROM tenants t
      JOIN rooms r ON t.room_id = r.id
      WHERE r.property_id IN (SELECT get_landlord_property_ids(auth.uid()))
    )
  );

CREATE POLICY "Landlords can update payments"
  ON payments FOR UPDATE USING (
    tenant_id IN (
      SELECT t.id FROM tenants t
      JOIN rooms r ON t.room_id = r.id
      WHERE r.property_id IN (SELECT get_landlord_property_ids(auth.uid()))
    )
  );

-- COMPLAINTS policies
CREATE POLICY "Landlords can view complaints of own properties"
  ON complaints FOR SELECT USING (
    property_id IN (SELECT get_landlord_property_ids(auth.uid()))
  );

CREATE POLICY "Tenants can view own complaints"
  ON complaints FOR SELECT USING (
    tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid())
  );

CREATE POLICY "Tenants can insert complaints"
  ON complaints FOR INSERT WITH CHECK (
    tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid())
  );

CREATE POLICY "Landlords can update complaint status"
  ON complaints FOR UPDATE USING (
    property_id IN (SELECT get_landlord_property_ids(auth.uid()))
  );

-- ============================================================
-- HELPER VIEWS
-- ============================================================

-- View: tenants with room and property info (for landlord)
CREATE OR REPLACE VIEW tenant_details AS
SELECT
  t.*,
  r.room_number,
  r.rent_amount,
  r.floor,
  p.id AS property_id,
  p.name AS property_name,
  p.landlord_id
FROM tenants t
JOIN rooms r ON t.room_id = r.id
JOIN properties p ON r.property_id = p.id;

-- View: payment summary per tenant
CREATE OR REPLACE VIEW payment_summary AS
SELECT
  t.id AS tenant_id,
  t.full_name,
  r.room_number,
  p.name AS property_name,
  p.landlord_id,
  COUNT(pay.id) FILTER (WHERE pay.status = 'paid') AS paid_count,
  COUNT(pay.id) FILTER (WHERE pay.status = 'pending') AS pending_count,
  COUNT(pay.id) FILTER (WHERE pay.status = 'overdue') AS overdue_count,
  SUM(pay.amount) FILTER (WHERE pay.status = 'paid') AS total_collected,
  SUM(pay.amount) FILTER (WHERE pay.status IN ('pending', 'overdue')) AS total_pending
FROM tenants t
JOIN rooms r ON t.room_id = r.id
JOIN properties p ON r.property_id = p.id
LEFT JOIN payments pay ON pay.tenant_id = t.id
WHERE t.is_active = TRUE
GROUP BY t.id, t.full_name, r.room_number, p.name, p.landlord_id;
