-- Create the four storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars',    'avatars',    false, 5242880,  ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('policies',   'policies',   false, 52428800, ARRAY['application/pdf','image/jpeg','image/png']),
  ('exports',    'exports',    false, 52428800, ARRAY['text/csv','application/pdf']),
  ('org-assets', 'org-assets', true,  5242880,  ARRAY['image/jpeg','image/png','image/webp','image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────
-- avatars: org members read; owner or admin/manager write
-- Path convention: {org_id}/{user_id}/filename
-- ─────────────────────────────────────────
CREATE POLICY "avatars_select" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = public.my_organization_id()::text
  );

CREATE POLICY "avatars_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = public.my_organization_id()::text
    AND (
      (storage.foldername(name))[2] = auth.uid()::text
      OR public.my_role() IN ('admin', 'manager')
    )
  );

CREATE POLICY "avatars_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = public.my_organization_id()::text
    AND (
      (storage.foldername(name))[2] = auth.uid()::text
      OR public.my_role() IN ('admin', 'manager')
    )
  );

CREATE POLICY "avatars_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = public.my_organization_id()::text
    AND (
      (storage.foldername(name))[2] = auth.uid()::text
      OR public.my_role() IN ('admin', 'manager')
    )
  );

-- ─────────────────────────────────────────
-- policies: all org members read; admin only write
-- Path convention: {org_id}/filename
-- ─────────────────────────────────────────
CREATE POLICY "policies_select" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'policies'
    AND (storage.foldername(name))[1] = public.my_organization_id()::text
  );

CREATE POLICY "policies_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'policies'
    AND (storage.foldername(name))[1] = public.my_organization_id()::text
    AND public.my_role() = 'admin'
  );

CREATE POLICY "policies_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'policies'
    AND (storage.foldername(name))[1] = public.my_organization_id()::text
    AND public.my_role() = 'admin'
  );

CREATE POLICY "policies_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'policies'
    AND (storage.foldername(name))[1] = public.my_organization_id()::text
    AND public.my_role() = 'admin'
  );

-- ─────────────────────────────────────────
-- exports: owner reads own exports; admin/manager write
-- Path convention: {org_id}/{user_id}/filename
-- ─────────────────────────────────────────
CREATE POLICY "exports_select" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'exports'
    AND (storage.foldername(name))[1] = public.my_organization_id()::text
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "exports_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'exports'
    AND (storage.foldername(name))[1] = public.my_organization_id()::text
    AND public.my_role() IN ('admin', 'manager')
  );

CREATE POLICY "exports_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'exports'
    AND (storage.foldername(name))[1] = public.my_organization_id()::text
    AND public.my_role() IN ('admin', 'manager')
  );

-- ─────────────────────────────────────────
-- org-assets: public read (no auth); admin only write
-- Path convention: {org_id}/filename
-- ─────────────────────────────────────────
CREATE POLICY "org_assets_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'org-assets'
    AND (storage.foldername(name))[1] = public.my_organization_id()::text
    AND public.my_role() = 'admin'
  );

CREATE POLICY "org_assets_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'org-assets'
    AND (storage.foldername(name))[1] = public.my_organization_id()::text
    AND public.my_role() = 'admin'
  );

CREATE POLICY "org_assets_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'org-assets'
    AND (storage.foldername(name))[1] = public.my_organization_id()::text
    AND public.my_role() = 'admin'
  );
