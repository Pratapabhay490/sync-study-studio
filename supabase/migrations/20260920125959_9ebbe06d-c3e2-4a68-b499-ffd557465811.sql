
CREATE OR REPLACE FUNCTION public.list_partner_invites()
RETURNS TABLE(id uuid, direction text, other_id uuid, other_name text, other_email text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT i.id,
         CASE WHEN i.to_user = auth.uid() THEN 'incoming' ELSE 'outgoing' END AS direction,
         CASE WHEN i.to_user = auth.uid() THEN i.from_user ELSE i.to_user END AS other_id,
         COALESCE(p.name, 'Someone') AS other_name,
         COALESCE(p.email, '') AS other_email,
         i.created_at
  FROM public.partner_invites i
  LEFT JOIN public.profiles p
    ON p.id = CASE WHEN i.to_user = auth.uid() THEN i.from_user ELSE i.to_user END
  WHERE i.status = 'pending'
    AND (i.from_user = auth.uid() OR i.to_user = auth.uid())
  ORDER BY i.created_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.list_partner_invites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_partner_invites() TO authenticated;
