REVOKE EXECUTE ON FUNCTION public.prevent_self_role_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_api_key_encryption() FROM PUBLIC, anon, authenticated;