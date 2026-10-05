-- Cyber News cache (public read, service writes)
CREATE TABLE public.cyber_news_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  region text NOT NULL DEFAULT 'global',
  title text NOT NULL,
  summary text,
  source text,
  url text,
  country text,
  published_at timestamptz DEFAULT now(),
  severity text NOT NULL DEFAULT 'info',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cyber_news_cache TO anon;
GRANT SELECT ON public.cyber_news_cache TO authenticated;
GRANT ALL ON public.cyber_news_cache TO service_role;
ALTER TABLE public.cyber_news_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cyber news is publicly readable" ON public.cyber_news_cache FOR SELECT USING (true);

-- Cyber news queries (session isolated)
CREATE TABLE public.cyber_news_queries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text,
  query text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.cyber_news_queries TO anon;
GRANT SELECT, INSERT ON public.cyber_news_queries TO authenticated;
GRANT ALL ON public.cyber_news_queries TO service_role;
ALTER TABLE public.cyber_news_queries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert news queries with session" ON public.cyber_news_queries FOR INSERT WITH CHECK (session_id = current_setting('app.session_id', true));
CREATE POLICY "Users can view their own session news queries" ON public.cyber_news_queries FOR SELECT USING (session_id = current_setting('app.session_id', true));

-- Cyber help resources (public reference data)
CREATE TABLE public.cyber_help_resources (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  phone text,
  email text,
  website text,
  category text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cyber_help_resources TO anon;
GRANT SELECT ON public.cyber_help_resources TO authenticated;
GRANT ALL ON public.cyber_help_resources TO service_role;
ALTER TABLE public.cyber_help_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Help resources are publicly readable" ON public.cyber_help_resources FOR SELECT USING (true);

-- Registered banking apps (session isolated)
CREATE TABLE public.banking_apps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text,
  package_name text NOT NULL,
  display_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.banking_apps TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.banking_apps TO authenticated;
GRANT ALL ON public.banking_apps TO service_role;
ALTER TABLE public.banking_apps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert banking apps with session" ON public.banking_apps FOR INSERT WITH CHECK (session_id = current_setting('app.session_id', true));
CREATE POLICY "Users can view their own session banking apps" ON public.banking_apps FOR SELECT USING (session_id = current_setting('app.session_id', true));
CREATE POLICY "Users can update their own session banking apps" ON public.banking_apps FOR UPDATE USING (session_id = current_setting('app.session_id', true));
CREATE POLICY "Users can delete their own session banking apps" ON public.banking_apps FOR DELETE USING (session_id = current_setting('app.session_id', true));

-- Secure banking sessions (session isolated)
CREATE TABLE public.secure_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text,
  app_name text NOT NULL,
  package_name text,
  verification_status text NOT NULL DEFAULT 'authorized',
  rfid_uid text,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  duration_seconds integer DEFAULT 300,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.secure_sessions TO anon;
GRANT SELECT, INSERT, UPDATE ON public.secure_sessions TO authenticated;
GRANT ALL ON public.secure_sessions TO service_role;
ALTER TABLE public.secure_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert secure sessions with session" ON public.secure_sessions FOR INSERT WITH CHECK (session_id = current_setting('app.session_id', true));
CREATE POLICY "Users can view their own secure sessions" ON public.secure_sessions FOR SELECT USING (session_id = current_setting('app.session_id', true));
CREATE POLICY "Users can update their own secure sessions" ON public.secure_sessions FOR UPDATE USING (session_id = current_setting('app.session_id', true));

-- Seed official Indian cyber help resources
INSERT INTO public.cyber_help_resources (title, description, phone, email, website, category) VALUES
('Cyber Crime Helpline 1930', 'National toll-free helpline for reporting financial cyber fraud. Report within the golden hour to freeze fraudulent transfers.', '1930', 'help-cybercell@nic.in', 'https://cybercrime.gov.in', 'emergency'),
('National Cyber Crime Reporting Portal', 'Official Government of India portal to report all categories of cyber crime, including online financial fraud.', NULL, NULL, 'https://cybercrime.gov.in', 'government'),
('RBI Banking Safety (Sachet)', 'Reserve Bank of India customer awareness and complaint platform for unauthorised banking activity.', '14440', NULL, 'https://sachet.rbi.org.in', 'government'),
('CERT-In', 'Indian Computer Emergency Response Team — report incidents, malware and vulnerabilities.', '1800-11-4949', 'incident@cert-in.org.in', 'https://www.cert-in.org.in', 'government'),
('Digital Payment Safety (NPCI)', 'NPCI guidance on safe UPI, IMPS and digital payment practices plus dispute redressal.', NULL, NULL, 'https://www.npci.org.in/what-we-do/upi/dispute-redressal-mechanism', 'government');