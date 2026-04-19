-- Fix storage RLS policies: add exports_update policy and WITH CHECK on UPDATE policies

-- Fix exports_update policy (was missing)
CREATE POLICY "exports_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'exports'
    AND (storage.foldername(name))[1] = public.my_organization_id()::text
    AND public.my_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    bucket_id = 'exports'
    AND (storage.foldername(name))[1] = public.my_organization_id()::text
    AND public.my_role() IN ('admin', 'manager')
  );

-- Add WITH CHECK to existing UPDATE policies
DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
CREATE POLICY "avatars_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = public.my_organization_id()::text
    AND (
      (storage.foldername(name))[2] = auth.uid()::text
      OR public.my_role() IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = public.my_organization_id()::text
    AND (
      (storage.foldername(name))[2] = auth.uid()::text
      OR public.my_role() IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "policies_update" ON storage.objects;
CREATE POLICY "policies_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'policies'
    AND (storage.foldername(name))[1] = public.my_organization_id()::text
    AND public.my_role() = 'admin'
  )
  WITH CHECK (
    bucket_id = 'policies'
    AND (storage.foldername(name))[1] = public.my_organization_id()::text
    AND public.my_role() = 'admin'
  );

DROP POLICY IF EXISTS "org_assets_update" ON storage.objects;
CREATE POLICY "org_assets_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'org-assets'
    AND (storage.foldername(name))[1] = public.my_organization_id()::text
    AND public.my_role() = 'admin'
  )
  WITH CHECK (
    bucket_id = 'org-assets'
    AND (storage.foldername(name))[1] = public.my_organization_id()::text
    AND public.my_role() = 'admin'
  );
