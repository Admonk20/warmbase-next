-- 1) Prevent self-modification of roles (defense in depth on top of RLS)
CREATE OR REPLACE FUNCTION public.prevent_self_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND COALESCE(NEW.user_id, OLD.user_id) = auth.uid() THEN
    RAISE EXCEPTION 'Users cannot modify their own roles';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_role_change_ins ON public.user_roles;
DROP TRIGGER IF EXISTS trg_prevent_self_role_change_upd ON public.user_roles;
DROP TRIGGER IF EXISTS trg_prevent_self_role_change_del ON public.user_roles;

CREATE TRIGGER trg_prevent_self_role_change_ins
BEFORE INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_change();

CREATE TRIGGER trg_prevent_self_role_change_upd
BEFORE UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_change();

CREATE TRIGGER trg_prevent_self_role_change_del
BEFORE DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_change();

-- 2) Enforce that user_api_keys.value_enc is always in encrypted format (v1:iv:ct)
CREATE OR REPLACE FUNCTION public.enforce_api_key_encryption()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.value_enc IS NULL OR NEW.value_enc !~ '^v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$' THEN
    RAISE EXCEPTION 'user_api_keys.value_enc must be stored encrypted (v1: prefix). Use the saveUserApiKey server function.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_api_key_encryption_ins ON public.user_api_keys;
DROP TRIGGER IF EXISTS trg_enforce_api_key_encryption_upd ON public.user_api_keys;

CREATE TRIGGER trg_enforce_api_key_encryption_ins
BEFORE INSERT ON public.user_api_keys
FOR EACH ROW EXECUTE FUNCTION public.enforce_api_key_encryption();

CREATE TRIGGER trg_enforce_api_key_encryption_upd
BEFORE UPDATE ON public.user_api_keys
FOR EACH ROW EXECUTE FUNCTION public.enforce_api_key_encryption();

-- 3) Purge any pre-existing plaintext rows so they are not readable.
DELETE FROM public.user_api_keys
WHERE value_enc IS NULL
   OR value_enc !~ '^v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$';