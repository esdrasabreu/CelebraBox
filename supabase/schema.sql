-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS hosts (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for all tables
ALTER TABLE hosts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS event_details (
  host_id UUID PRIMARY KEY REFERENCES hosts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  location_name TEXT,
  location_address TEXT,
  location_city TEXT,
  location_state TEXT,
  location_maps_link TEXT,
  location_latitude TEXT,
  location_longitude TEXT,
  story TEXT,
  cover_image TEXT,
  theme_color TEXT
);

ALTER TABLE event_details ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS payment_settings (
  host_id UUID PRIMARY KEY REFERENCES hosts(id) ON DELETE CASCADE,
  pix_key_type TEXT,
  pix_key TEXT,
  receiver_name TEXT,
  city TEXT,
  gateway_provider TEXT,
  gateway_public_key TEXT,
  gateway_access_token TEXT,
  gateway_environment TEXT,
  gateway_webhook_url TEXT
);

ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID REFERENCES hosts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  image_url TEXT,
  category TEXT,
  quantity INTEGER
);

ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID REFERENCES hosts(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID REFERENCES hosts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL
);

ALTER TABLE guests ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID REFERENCES hosts(id) ON DELETE CASCADE,
  gift_title TEXT NOT NULL,
  donor_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  method TEXT NOT NULL,
  date TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID REFERENCES hosts(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT,
  display_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE gallery ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID REFERENCES hosts(id) ON DELETE CASCADE,
  time TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT
);

ALTER TABLE schedule ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID REFERENCES hosts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Note: we use display_order for gallery as order is a reserved keyword in SQL.

-- Secure function to get access token for backend processing (bypasses RLS)
CREATE OR REPLACE FUNCTION get_host_access_token(host_id_param UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  token TEXT;
BEGIN
  SELECT gateway_access_token INTO token FROM payment_settings WHERE host_id = host_id_param;
  RETURN token;
END;
$$;

-- Set up RLS Policies

-- Public Read Access Policies (accessible without login)
CREATE POLICY "Public profiles are viewable by everyone." ON hosts FOR SELECT USING (true);
CREATE POLICY "Event details are viewable by everyone." ON event_details FOR SELECT USING (true);
CREATE POLICY "Gifts are viewable by everyone." ON gifts FOR SELECT USING (true);
CREATE POLICY "Messages are viewable by everyone." ON messages FOR SELECT USING (true);
CREATE POLICY "Gallery is viewable by everyone." ON gallery FOR SELECT USING (true);
CREATE POLICY "Schedule is viewable by everyone." ON schedule FOR SELECT USING (true);
CREATE POLICY "Public can insert messages." ON messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can insert transactions." ON transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update guest status." ON guests FOR UPDATE USING (true) WITH CHECK (true);

-- Authenticated Users Policies (Owner access)
-- Note: payment_settings, expenses, transactions, guests are NOT public for select by default (except specific operations above)
CREATE POLICY "Users can update own host record." ON hosts FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own event details." ON event_details FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Users can update own event details." ON event_details FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "Users can delete own event details." ON event_details FOR DELETE USING (auth.uid() = host_id);

CREATE POLICY "Users can view own payment settings." ON payment_settings FOR SELECT USING (auth.uid() = host_id);
CREATE POLICY "Users can insert own payment settings." ON payment_settings FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Users can update own payment settings." ON payment_settings FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "Users can delete own payment settings." ON payment_settings FOR DELETE USING (auth.uid() = host_id);

CREATE POLICY "Users can insert own gifts." ON gifts FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Users can update own gifts." ON gifts FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "Users can delete own gifts." ON gifts FOR DELETE USING (auth.uid() = host_id);

CREATE POLICY "Users can view own messages." ON messages FOR SELECT USING (auth.uid() = host_id);
CREATE POLICY "Users can delete own messages." ON messages FOR DELETE USING (auth.uid() = host_id);

CREATE POLICY "Users can view own guests." ON guests FOR SELECT USING (auth.uid() = host_id);
CREATE POLICY "Users can insert own guests." ON guests FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Users can update own guests." ON guests FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "Users can delete own guests." ON guests FOR DELETE USING (auth.uid() = host_id);

CREATE POLICY "Users can view own transactions." ON transactions FOR SELECT USING (auth.uid() = host_id);
CREATE POLICY "Users can delete own transactions." ON transactions FOR DELETE USING (auth.uid() = host_id);
CREATE POLICY "Users can update own transactions." ON transactions FOR UPDATE USING (auth.uid() = host_id);

CREATE POLICY "Users can insert own gallery." ON gallery FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Users can update own gallery." ON gallery FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "Users can delete own gallery." ON gallery FOR DELETE USING (auth.uid() = host_id);

CREATE POLICY "Users can insert own schedule." ON schedule FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Users can update own schedule." ON schedule FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "Users can delete own schedule." ON schedule FOR DELETE USING (auth.uid() = host_id);

CREATE POLICY "Users can view own expenses." ON expenses FOR SELECT USING (auth.uid() = host_id);
CREATE POLICY "Users can insert own expenses." ON expenses FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Users can update own expenses." ON expenses FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "Users can delete own expenses." ON expenses FOR DELETE USING (auth.uid() = host_id);

-- Optional: trigger to automatically create host profile after signup
-- (Requires Superuser permissions in Supabase)
-- CREATE OR REPLACE FUNCTION public.handle_new_user()
-- RETURNS trigger AS $$
-- BEGIN
--   INSERT INTO public.hosts (id, name, email)
--   VALUES (new.id, new.raw_user_meta_data->>'name', new.email);
--   RETURN new;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;
-- 
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();