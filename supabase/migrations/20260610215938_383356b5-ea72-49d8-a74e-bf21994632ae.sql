
-- 1) Cria profile faltante para o usuário existente
INSERT INTO public.profiles (id, tenant_id, full_name, role, status)
SELECT u.id,
       '00000000-0000-0000-0000-000000000001'::uuid,
       COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
       'admin'::public.user_role,
       'active'
FROM auth.users u
WHERE u.email = 'adilielson@gmail.com'
ON CONFLICT (id) DO UPDATE
   SET status = 'active',
       tenant_id = COALESCE(public.profiles.tenant_id, EXCLUDED.tenant_id),
       role = COALESCE(public.profiles.role, EXCLUDED.role);

-- 2) Trigger para criar profile automaticamente em novos signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, tenant_id, full_name, role, status)
  VALUES (
    NEW.id,
    '00000000-0000-0000-0000-000000000001'::uuid,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'attendant'::public.user_role,
    'active'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
