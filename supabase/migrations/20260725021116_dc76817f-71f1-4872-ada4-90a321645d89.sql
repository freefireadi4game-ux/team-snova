
ALTER TABLE public.match_stats ADD COLUMN IF NOT EXISTS assists integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.player_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT ON public.player_invites TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.player_invites TO authenticated;
GRANT ALL ON public.player_invites TO service_role;
ALTER TABLE public.player_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read invites" ON public.player_invites FOR SELECT USING (true);
CREATE POLICY "Admins manage invites" ON public.player_invites FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.claim_player_role(_token text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.player_invites WHERE token = _token) THEN
    RETURN false;
  END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (_uid, 'player'::public.app_role)
    ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_player_role(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_player_role(text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT ON public.maps TO anon, authenticated;
GRANT ALL ON public.maps TO service_role;
ALTER TABLE public.maps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read maps" ON public.maps FOR SELECT USING (true);
CREATE POLICY "Admins manage maps" ON public.maps FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.map_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id uuid NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  color text NOT NULL DEFAULT '#f59e0b',
  points jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.map_paths TO anon, authenticated;
GRANT INSERT, DELETE ON public.map_paths TO authenticated;
GRANT ALL ON public.map_paths TO service_role;
ALTER TABLE public.map_paths ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read paths" ON public.map_paths FOR SELECT USING (true);
CREATE POLICY "Players and admins draw" ON public.map_paths FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'player'));
CREATE POLICY "Own or admin delete paths" ON public.map_paths FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.map_paths;
