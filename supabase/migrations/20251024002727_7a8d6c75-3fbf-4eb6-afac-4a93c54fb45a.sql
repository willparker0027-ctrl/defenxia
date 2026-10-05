-- Create a function to set session configuration for RLS
CREATE OR REPLACE FUNCTION public.set_session_id(session_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.session_id', session_id, false);
END;
$$;