-- Tighten direct access to the role helper. RLS policies can still use it for
-- authenticated users, but anonymous clients should not be able to call it.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.increment_tracked_link_click(_link_id uuid)
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE public.tracked_links
  SET click_count = click_count + 1,
      last_clicked_at = now()
  WHERE id = _link_id;
$$;

CREATE OR REPLACE FUNCTION public.reserve_smtp_send(_user_id uuid, _cap integer)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.user_smtp_settings
  SET sent_today = sent_today + 1
  WHERE user_id = _user_id
    AND sent_today < _cap;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_smtp_send(_user_id uuid)
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE public.user_smtp_settings
  SET sent_today = GREATEST(sent_today - 1, 0)
  WHERE user_id = _user_id;
$$;
