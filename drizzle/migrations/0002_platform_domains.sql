CREATE TABLE public.platform_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  zone_id text,
  status text NOT NULL DEFAULT 'pending',
  nameservers text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT false,
  last_error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_domains TO anon, authenticated;
GRANT ALL ON public.platform_domains TO service_role;
ALTER TABLE public.platform_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read platform domains" ON public.platform_domains FOR SELECT TO anon, authenticated USING (true);
CREATE UNIQUE INDEX platform_domains_one_active ON public.platform_domains (is_active) WHERE is_active;
INSERT INTO public.platform_domains (domain, status, is_active) VALUES ('egreedtech.org', 'active', true);