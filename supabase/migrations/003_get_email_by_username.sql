-- Single RPC that maps a username to an email for the login flow.
-- SECURITY DEFINER is required because the caller is not yet authenticated
-- and the profiles RLS policy blocks anon SELECT.
-- Returning NULL for an unknown username leaks no information beyond what
-- the subsequent signInWithPassword call would reveal anyway.
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT au.email INTO v_email
  FROM public.profiles p
  JOIN auth.users au ON au.id = p.id
  WHERE p.username = p_username
  LIMIT 1;
  RETURN v_email;
END;
$$;

-- Allow both anon (pre-login) and authenticated callers
GRANT EXECUTE ON FUNCTION public.get_email_by_username(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(TEXT) TO authenticated;
