
CREATE TABLE public.security_threats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  content TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',
  session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.security_threats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert security threats"
  ON public.security_threats
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Users can view their session threats"
  ON public.security_threats
  FOR SELECT
  TO public
  USING (session_id = current_setting('app.session_id', true));
