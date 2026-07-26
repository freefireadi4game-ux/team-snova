
-- Make maps drawing fully public (no auth required)
ALTER TABLE public.map_paths ALTER COLUMN user_id DROP NOT NULL;

DROP POLICY IF EXISTS "Players and admins draw" ON public.map_paths;
DROP POLICY IF EXISTS "Own or admin delete paths" ON public.map_paths;

CREATE POLICY "Anyone can draw" ON public.map_paths FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can erase" ON public.map_paths FOR DELETE TO anon, authenticated USING (true);

GRANT SELECT, INSERT, DELETE ON public.map_paths TO anon;
