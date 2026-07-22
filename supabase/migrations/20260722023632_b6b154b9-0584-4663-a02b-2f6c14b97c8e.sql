
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;

ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS position integer;
