/**
 * EGREED ID (id.egreedtech.org) OpenID Connect helpers.
 *
 * This is an ADDITIONAL sign-in path — the existing email/password and Google
 * flows are untouched. After a successful EGREED ID authorization we map the
 * verified email onto the platform account (creating one on first use) and
 * hand the browser a normal backend session.
 */

export const EGREED_ID_ISSUER = "https://id.egreedtech.org";

const DISCOVERY_URL = `${EGREED_ID_ISSUER}/.well-known/openid-configuration`;

export type Discovery = {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
};

let cached: { at: number; doc: Discovery } | null = null;

export async function getDiscovery(): Promise<Discovery> {
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached.doc;
  const res = await fetch(DISCOVERY_URL, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(
      `EGREED ID is not reachable right now (${res.status} from ${DISCOVERY_URL}).`,
    );
  }
  const doc = (await res.json()) as Discovery;
  if (!doc.authorization_endpoint || !doc.token_endpoint) {
    throw new Error("EGREED ID returned an incomplete sign-in configuration.");
  }
  cached = { at: Date.now(), doc };
  return doc;
}

export function getClientCredentials() {
  const clientId = process.env["EGREED_ID_CLIENT_ID"];
  const clientSecret = process.env["EGREED_ID_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    throw new Error(
      "EGREED ID sign-in is not configured yet — the app ID and secret from id.egreedtech.org are missing.",
    );
  }
  return { clientId, clientSecret };
}

export function callbackUrl(request: Request) {
  const configured = process.env["EGREED_ID_REDIRECT_URI"];
  if (configured) return configured;
  return new URL("/api/public/auth/egreed/callback", new URL(request.url).origin).toString();
}

export function appOrigin(request: Request) {
  return new URL(request.url).origin;
}

/* ------------------------------- PKCE utils ------------------------------- */

function base64url(bytes: Uint8Array) {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomToken(size = 32) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

export async function challengeFor(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

/* -------------------------------- cookies -------------------------------- */

export function setCookie(name: string, value: string, maxAge: number, secure: boolean) {
  const parts = [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

/* ------------------------------ token + user ------------------------------ */

export type EgreedIdentity = {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
};

export async function exchangeCode(opts: {
  code: string;
  verifier: string;
  redirectUri: string;
}): Promise<EgreedIdentity> {
  const { clientId, clientSecret } = getClientCredentials();
  const discovery = await getDiscovery();

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: opts.redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: opts.verifier,
  });

  const tokenRes = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body,
  });
  const tokenText = await tokenRes.text();
  if (!tokenRes.ok) {
    throw new Error(
      `EGREED ID rejected the sign-in (${tokenRes.status}). ${tokenText.slice(0, 300)}`,
    );
  }
  const tokens = JSON.parse(tokenText) as { access_token?: string; id_token?: string };
  if (!tokens.access_token) throw new Error("EGREED ID did not return an access token.");

  const userRes = await fetch(discovery.userinfo_endpoint, {
    headers: { authorization: `Bearer ${tokens.access_token}`, accept: "application/json" },
  });
  if (!userRes.ok) {
    throw new Error(`EGREED ID could not share the account profile (${userRes.status}).`);
  }
  const profile = (await userRes.json()) as Record<string, unknown>;
  const email = typeof profile["email"] === "string" ? (profile["email"] as string) : "";
  if (!email) {
    throw new Error(
      "This EGREED ID account has no email address, so it cannot be matched to a platform account.",
    );
  }
  const identity: EgreedIdentity = {
    sub: String(profile["sub"] ?? email),
    email: email.toLowerCase(),
  };
  const name = profile["name"] ?? profile["preferred_username"];
  if (typeof name === "string") identity.name = name;
  if (typeof profile["picture"] === "string") identity.picture = profile["picture"] as string;
  return identity;
}

/**
 * Links the EGREED ID account to a platform account by verified email and
 * returns a one-time URL that signs the browser in.
 */
export async function buildSessionRedirect(identity: EgreedIdentity, redirectTo: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const metadata = {
    name: identity.name ?? identity.email.split("@")[0],
    avatar_url: identity.picture,
    egreed_id_sub: identity.sub,
    provider: "egreed-id",
  };

  let link = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: identity.email,
    options: { redirectTo },
  });

  if (link.error) {
    // No platform account for this email yet — create one, then retry.
    const created = await supabaseAdmin.auth.admin.createUser({
      email: identity.email,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (created.error) {
      throw new Error(`Could not create an account for ${identity.email}: ${created.error.message}`);
    }
    link = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: identity.email,
      options: { redirectTo },
    });
  } else if (link.data.user) {
    await supabaseAdmin.auth.admin.updateUserById(link.data.user.id, {
      user_metadata: { ...link.data.user.user_metadata, ...metadata },
    });
  }

  if (link.error || !link.data?.properties?.action_link) {
    throw new Error(
      link.error?.message ?? "Could not start a session for this EGREED ID account.",
    );
  }
  return link.data.properties.action_link;
}
