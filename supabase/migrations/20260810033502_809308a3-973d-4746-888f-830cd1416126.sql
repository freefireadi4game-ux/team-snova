-- POIs
CREATE TABLE public.map_pois (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id uuid NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'location',
  x double precision NOT NULL,
  y double precision NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.map_pois TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.map_pois TO authenticated;
GRANT ALL ON public.map_pois TO service_role;
ALTER TABLE public.map_pois ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read pois" ON public.map_pois FOR SELECT USING (true);
CREATE POLICY "Admins manage pois" ON public.map_pois FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_map_pois_updated_at BEFORE UPDATE ON public.map_pois
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX map_pois_map_id_idx ON public.map_pois(map_id);

-- POI images
CREATE TABLE public.map_poi_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poi_id uuid NOT NULL REFERENCES public.map_pois(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  title text,
  sort_order integer NOT NULL DEFAULT 0,
  is_thumbnail boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.map_poi_images TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.map_poi_images TO authenticated;
GRANT ALL ON public.map_poi_images TO service_role;
ALTER TABLE public.map_poi_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read poi images" ON public.map_poi_images FOR SELECT USING (true);
CREATE POLICY "Admins manage poi images" ON public.map_poi_images FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_map_poi_images_updated_at BEFORE UPDATE ON public.map_poi_images
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX map_poi_images_poi_id_idx ON public.map_poi_images(poi_id, sort_order);

-- Tactical annotations (map layer + per-POI-image layers)
CREATE TABLE public.tactical_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,
  map_id uuid REFERENCES public.maps(id) ON DELETE CASCADE,
  poi_image_id uuid REFERENCES public.map_poi_images(id) ON DELETE CASCADE,
  kind text NOT NULL,
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  color text NOT NULL DEFAULT '#38bdf8',
  points jsonb NOT NULL DEFAULT '[]'::jsonb,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tactical_annotations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tactical_annotations TO authenticated;
GRANT ALL ON public.tactical_annotations TO service_role;
ALTER TABLE public.tactical_annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read annotations" ON public.tactical_annotations FOR SELECT USING (true);
CREATE POLICY "Anyone can add annotations" ON public.tactical_annotations FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can edit annotations" ON public.tactical_annotations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can remove annotations" ON public.tactical_annotations FOR DELETE TO anon, authenticated USING (true);
CREATE TRIGGER update_tactical_annotations_updated_at BEFORE UPDATE ON public.tactical_annotations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX tactical_annotations_map_idx ON public.tactical_annotations(map_id);
CREATE INDEX tactical_annotations_poi_image_idx ON public.tactical_annotations(poi_image_id);