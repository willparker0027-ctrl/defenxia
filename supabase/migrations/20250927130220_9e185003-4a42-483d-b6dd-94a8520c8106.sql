-- Create tables to store scan results from all features

-- QR Scanner results
CREATE TABLE public.qr_scan_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  qr_content TEXT NOT NULL,
  scan_type TEXT NOT NULL DEFAULT 'qr_code',
  threat_level TEXT DEFAULT 'safe',
  analysis_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Website scanner results
CREATE TABLE public.website_scan_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  website_url TEXT NOT NULL,
  scan_type TEXT NOT NULL DEFAULT 'website',
  threat_level TEXT DEFAULT 'safe',
  malware_detected BOOLEAN DEFAULT false,
  phishing_detected BOOLEAN DEFAULT false,
  analysis_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- WiFi security scan results
CREATE TABLE public.wifi_scan_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  network_name TEXT NOT NULL,
  security_type TEXT,
  signal_strength INTEGER,
  threat_level TEXT DEFAULT 'safe',
  vulnerabilities JSONB,
  analysis_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Virus scanner results
CREATE TABLE public.virus_scan_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  file_name TEXT,
  file_hash TEXT,
  scan_type TEXT NOT NULL DEFAULT 'virus_scan',
  threat_level TEXT DEFAULT 'safe',
  virus_detected BOOLEAN DEFAULT false,
  virus_names TEXT[],
  analysis_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- IP security check results
CREATE TABLE public.ip_scan_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT NOT NULL,
  scan_type TEXT NOT NULL DEFAULT 'ip_security',
  threat_level TEXT DEFAULT 'safe',
  is_malicious BOOLEAN DEFAULT false,
  country TEXT,
  isp TEXT,
  analysis_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Data breach check results
CREATE TABLE public.data_breach_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  email_checked TEXT,
  scan_type TEXT NOT NULL DEFAULT 'data_breach',
  breaches_found INTEGER DEFAULT 0,
  breach_details JSONB,
  analysis_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- App permissions check results
CREATE TABLE public.app_permission_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  app_name TEXT NOT NULL,
  permissions JSONB,
  risk_level TEXT DEFAULT 'low',
  suspicious_permissions TEXT[],
  analysis_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Firewall scan results
CREATE TABLE public.firewall_scan_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  scan_type TEXT NOT NULL DEFAULT 'firewall',
  ports_scanned JSONB,
  open_ports INTEGER[],
  blocked_attempts INTEGER DEFAULT 0,
  threat_level TEXT DEFAULT 'safe',
  analysis_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Antivirus scan results
CREATE TABLE public.antivirus_scan_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  scan_type TEXT NOT NULL DEFAULT 'antivirus',
  files_scanned INTEGER DEFAULT 0,
  threats_detected INTEGER DEFAULT 0,
  threat_details JSONB,
  analysis_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.qr_scan_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_scan_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wifi_scan_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.virus_scan_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_scan_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_breach_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_permission_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firewall_scan_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.antivirus_scan_results ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public access (since no authentication)
CREATE POLICY "Enable read access for all users" ON public.qr_scan_results FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.qr_scan_results FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON public.website_scan_results FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.website_scan_results FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON public.wifi_scan_results FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.wifi_scan_results FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON public.virus_scan_results FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.virus_scan_results FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON public.ip_scan_results FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.ip_scan_results FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON public.data_breach_results FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.data_breach_results FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON public.app_permission_results FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.app_permission_results FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON public.firewall_scan_results FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.firewall_scan_results FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON public.antivirus_scan_results FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.antivirus_scan_results FOR INSERT WITH CHECK (true);