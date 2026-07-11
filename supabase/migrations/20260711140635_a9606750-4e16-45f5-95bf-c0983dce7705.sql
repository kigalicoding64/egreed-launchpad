UPDATE public.domains
SET dns_target = COALESCE(dns_target, 'ingress.egreedtech.org'),
    ssl_provisioned_at = COALESCE(ssl_provisioned_at, last_checked_at, now())
WHERE ssl_status = 'active' AND (dns_target IS NULL OR ssl_provisioned_at IS NULL);