
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_first_admin() FROM PUBLIC, anon, authenticated;

-- Storage policies (buckets are private, but we allow public read + admin write)
CREATE POLICY "Public read player-photos" ON storage.objects FOR SELECT USING (bucket_id = 'player-photos');
CREATE POLICY "Admins manage player-photos" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'player-photos' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'player-photos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public read tournament-media" ON storage.objects FOR SELECT USING (bucket_id = 'tournament-media');
CREATE POLICY "Admins manage tournament-media" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'tournament-media' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'tournament-media' AND public.has_role(auth.uid(), 'admin'));
