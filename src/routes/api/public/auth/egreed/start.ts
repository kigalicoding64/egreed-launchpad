import { createFileRoute } from "@tanstack/react-router";
import {
  callbackUrl,
  challengeFor,
  getClientCredentials,
  getDiscovery,
  randomToken,
  setCookie,
} from "@/lib/egreed-id.server";

/** Kicks off the EGREED ID (id.egreedtech.org) authorization code + PKCE flow. */
export const Route = createFileRoute("/api/public/auth/egreed/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const rawNext = url.searchParams.get("next") ?? "/dashboard";
        const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

        try {
          const { clientId } = getClientCredentials();
          const discovery = await getDiscovery();
          const redirectUri = callbackUrl(request);

          const state = randomToken();
          const verifier = randomToken(48);
          const challenge = await challengeFor(verifier);

          const authorize = new URL(discovery.authorization_endpoint);
          authorize.searchParams.set("response_type", "code");
          authorize.searchParams.set("client_id", clientId);
          authorize.searchParams.set("redirect_uri", redirectUri);
          authorize.searchParams.set("scope", "openid profile email");
          authorize.searchParams.set("state", state);
          authorize.searchParams.set("code_challenge", challenge);
          authorize.searchParams.set("code_challenge_method", "S256");

          const secure = url.protocol === "https:";
          const headers = new Headers({ location: authorize.toString() });
          headers.append("set-cookie", setCookie("egreed_id_state", state, 600, secure));
          headers.append("set-cookie", setCookie("egreed_id_verifier", verifier, 600, secure));
          headers.append(
            "set-cookie",
            setCookie("egreed_id_next", encodeURIComponent(next), 600, secure),
          );
          return new Response(null, { status: 302, headers });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return new Response(null, {
            status: 302,
            headers: { location: `/auth?egreed_error=${encodeURIComponent(message)}` },
          });
        }
      },
    },
  },
});
