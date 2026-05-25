-- 1. user_roles: block self-privilege-escalation. Only admins may write.
CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. email_unsub_tokens: writes only by the owning user.
CREATE POLICY "Users can insert their own unsub tokens"
ON public.email_unsub_tokens FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own unsub tokens"
ON public.email_unsub_tokens FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own unsub tokens"
ON public.email_unsub_tokens FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- 3. has_role: revoke direct EXECUTE from client roles. RLS policies still
-- invoke it because SECURITY DEFINER runs as the function owner.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
