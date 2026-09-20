import { createFileRoute } from "@tanstack/react-router";
import {
  appOrigin,
  buildSessionRedirect,
  callbackUrl,
  exchangeCode,
  readCookie,
  setCookie,
} from "@/lib/egreed-id.server";

function clearCookies(secure: boolean) {
  return ["egreed_id_state", "egreed_id_verifier", "egreed_id_next"].map((n) =>
    setCookie(n, "", 0, secure),
  );
}

/** Completes the EGREED ID flow and signs the visitor into their platform account. */
export const Route = createFileRoute("/api/public/auth/egreed/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const secure = url.protocol === "https:";

        const fail = (message: string) => {
          const headers = new Headers({
            location: `/auth?egreed_error=${encodeURIComponent(message)}`,
          });
          for (const c of clearCookies(secure)) headers.append("set-cookie", c);
          return new Response(null, { status: 302, headers });
        };

        const providerError = url.searchParams.get("error");
        if (providerError) {
          return fail(
            url.searchParams.get("error_description") ?? `EGREED ID returned "${providerError}".`,
          );
        }

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const expectedState = readCookie(request, "egreed_id_state");
        const verifier = readCookie(request, "egreed_id_verifier");
        const nextCookie = readCookie(request, "egreed_id_next");
        const next = nextCookie ? decodeURIComponent(nextCookie) : "/dashboard";

        if (!code || !state || !expectedState || !verifier) {
          return fail("The EGREED ID sign-in expired. Please try again.");
        }
        if (state !== expectedState) {
          return fail("The EGREED ID sign-in could not be verified. Please try again.");
        }

        try {
          const identity = await exchangeCode({
            code,
            verifier,
            redirectUri: callbackUrl(request),
          });
          const redirectTo = new URL(
            next.startsWith("/") ? next : "/dashboard",
            appOrigin(request),
          ).toString();
          const action = await buildSessionRedirect(identity, redirectTo);

          const headers = new Headers({ location: action });
          for (const c of clearCookies(secure)) headers.append("set-cookie", c);
          return new Response(null, { status: 302, headers });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[egreed-id] callback failed", message);
          return fail(message);
        }
      },
    },
  },
});
