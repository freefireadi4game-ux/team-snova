CREATE TABLE public.player_aliases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  alias text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX player_aliases_alias_lower_idx ON public.player_aliases (lower(alias));

GRANT SELECT ON public.player_aliases TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_aliases TO authenticated;
GRANT ALL ON public.player_aliases TO service_role;

ALTER TABLE public.player_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read aliases" ON public.player_aliases FOR SELECT USING (true);
CREATE POLICY "Admins manage aliases" ON public.player_aliases FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_player_aliases_updated_at BEFORE UPDATE ON public.player_aliases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();