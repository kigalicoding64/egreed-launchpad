-- 1. DNS status enum
DO $$ BEGIN
  CREATE TYPE public.dns_status AS ENUM ('pending', 'active', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. domains: DNS + SSL tracking
ALTER TABLE public.domains
  ADD COLUMN IF NOT EXISTS dns_status public.dns_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS cloudflare_record_id text,
  ADD COLUMN IF NOT EXISTS dns_type text NOT NULL DEFAULT 'CNAME',
  ADD COLUMN IF NOT EXISTS dns_target text,
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS ssl_provisioned_at timestamptz,
  ADD COLUMN IF NOT EXISTS ssl_renewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS ssl_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS update_domains_updated_at ON public.domains;
CREATE TRIGGER update_domains_updated_at BEFORE UPDATE ON public.domains
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. deployments: job progress + trigger metadata
ALTER TABLE public.deployments
  ADD COLUMN IF NOT EXISTS progress integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS github_event text,
  ADD COLUMN IF NOT EXISTS deploy_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS update_deployments_updated_at ON public.deployments;
CREATE TRIGGER update_deployments_updated_at BEFORE UPDATE ON public.deployments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. webhook_events log
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'github',
  event_type text NOT NULL,
  delivery_id text,
  signature_valid boolean NOT NULL DEFAULT false,
  processed boolean NOT NULL DEFAULT false,
  error text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.webhook_events TO authenticated;
GRANT ALL ON public.webhook_events TO service_role;

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own webhook events"
  ON public.webhook_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_webhook_events_user ON public.webhook_events(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_project ON public.webhook_events(project_id);

-- 5. Realtime for live status streaming
ALTER TABLE public.deployments REPLICA IDENTITY FULL;
ALTER TABLE public.domains REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.deployments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.domains;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;