GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO anon, authenticated;
GRANT ALL ON public.conversations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO anon, authenticated;
GRANT ALL ON public.messages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO anon, authenticated;
GRANT ALL ON public.leads TO service_role;

DROP POLICY IF EXISTS "CRM mock conversations access" ON public.conversations;
CREATE POLICY "CRM mock conversations access"
  ON public.conversations
  FOR ALL
  TO anon
  USING (tenant_id::text = 'tenant-1')
  WITH CHECK (tenant_id::text = 'tenant-1');

DROP POLICY IF EXISTS "CRM mock messages access" ON public.messages;
CREATE POLICY "CRM mock messages access"
  ON public.messages
  FOR ALL
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND c.tenant_id::text = 'tenant-1'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND c.tenant_id::text = 'tenant-1'
    )
  );

DROP POLICY IF EXISTS "CRM mock leads access" ON public.leads;
CREATE POLICY "CRM mock leads access"
  ON public.leads
  FOR ALL
  TO anon
  USING (tenant_id::text = 'tenant-1')
  WITH CHECK (tenant_id::text = 'tenant-1');