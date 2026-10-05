-- Add session_id column to all scan result tables for session-based isolation
ALTER TABLE public.wifi_scan_results ADD COLUMN session_id text;
ALTER TABLE public.qr_scan_results ADD COLUMN session_id text;
ALTER TABLE public.antivirus_scan_results ADD COLUMN session_id text;
ALTER TABLE public.firewall_scan_results ADD COLUMN session_id text;
ALTER TABLE public.virus_scan_results ADD COLUMN session_id text;
ALTER TABLE public.app_permission_results ADD COLUMN session_id text;
ALTER TABLE public.ip_scan_results ADD COLUMN session_id text;
ALTER TABLE public.data_breach_results ADD COLUMN session_id text;
ALTER TABLE public.website_scan_results ADD COLUMN session_id text;

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.wifi_scan_results;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.wifi_scan_results;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.qr_scan_results;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.qr_scan_results;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.antivirus_scan_results;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.antivirus_scan_results;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.firewall_scan_results;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.firewall_scan_results;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.virus_scan_results;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.virus_scan_results;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.app_permission_results;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.app_permission_results;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.ip_scan_results;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.ip_scan_results;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.data_breach_results;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.data_breach_results;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.website_scan_results;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.website_scan_results;

-- Create session-based RLS policies for wifi_scan_results
CREATE POLICY "Users can view their own session wifi scans"
ON public.wifi_scan_results FOR SELECT
USING (session_id = current_setting('app.session_id', true));

CREATE POLICY "Users can insert wifi scans with session"
ON public.wifi_scan_results FOR INSERT
WITH CHECK (session_id = current_setting('app.session_id', true));

-- Create session-based RLS policies for qr_scan_results
CREATE POLICY "Users can view their own session qr scans"
ON public.qr_scan_results FOR SELECT
USING (session_id = current_setting('app.session_id', true));

CREATE POLICY "Users can insert qr scans with session"
ON public.qr_scan_results FOR INSERT
WITH CHECK (session_id = current_setting('app.session_id', true));

-- Create session-based RLS policies for antivirus_scan_results
CREATE POLICY "Users can view their own session antivirus scans"
ON public.antivirus_scan_results FOR SELECT
USING (session_id = current_setting('app.session_id', true));

CREATE POLICY "Users can insert antivirus scans with session"
ON public.antivirus_scan_results FOR INSERT
WITH CHECK (session_id = current_setting('app.session_id', true));

-- Create session-based RLS policies for firewall_scan_results
CREATE POLICY "Users can view their own session firewall scans"
ON public.firewall_scan_results FOR SELECT
USING (session_id = current_setting('app.session_id', true));

CREATE POLICY "Users can insert firewall scans with session"
ON public.firewall_scan_results FOR INSERT
WITH CHECK (session_id = current_setting('app.session_id', true));

-- Create session-based RLS policies for virus_scan_results
CREATE POLICY "Users can view their own session virus scans"
ON public.virus_scan_results FOR SELECT
USING (session_id = current_setting('app.session_id', true));

CREATE POLICY "Users can insert virus scans with session"
ON public.virus_scan_results FOR INSERT
WITH CHECK (session_id = current_setting('app.session_id', true));

-- Create session-based RLS policies for app_permission_results
CREATE POLICY "Users can view their own session app permission scans"
ON public.app_permission_results FOR SELECT
USING (session_id = current_setting('app.session_id', true));

CREATE POLICY "Users can insert app permission scans with session"
ON public.app_permission_results FOR INSERT
WITH CHECK (session_id = current_setting('app.session_id', true));

-- Create session-based RLS policies for ip_scan_results
CREATE POLICY "Users can view their own session ip scans"
ON public.ip_scan_results FOR SELECT
USING (session_id = current_setting('app.session_id', true));

CREATE POLICY "Users can insert ip scans with session"
ON public.ip_scan_results FOR INSERT
WITH CHECK (session_id = current_setting('app.session_id', true));

-- Create session-based RLS policies for data_breach_results
CREATE POLICY "Users can view their own session breach checks"
ON public.data_breach_results FOR SELECT
USING (session_id = current_setting('app.session_id', true));

CREATE POLICY "Users can insert breach checks with session"
ON public.data_breach_results FOR INSERT
WITH CHECK (session_id = current_setting('app.session_id', true));

-- Create session-based RLS policies for website_scan_results
CREATE POLICY "Users can view their own session website scans"
ON public.website_scan_results FOR SELECT
USING (session_id = current_setting('app.session_id', true));

CREATE POLICY "Users can insert website scans with session"
ON public.website_scan_results FOR INSERT
WITH CHECK (session_id = current_setting('app.session_id', true));