import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { action as logout } from "~/routes/auth/logout";
import { loader as oidcCallback } from "~/routes/auth/oidc-callback";
import { loader as oidcStart } from "~/routes/auth/oidc-start";
import { loader as home } from "~/routes/home";
import { userAction } from "~/routes/users/user-actions";
import { isUserPrincipal } from "~/server/web/auth";

import { HEADPLANE_URL, HEADSCALE_OIDC, startTailnetDex } from "../../harness/dex";
import { createTailnet, type Tailnet } from "../../harness/tailnet";
import { testedVersions } from "../../harness/versions";
import { waitFor } from "../../harness/wait";
import { statusOf, type TestApp } from "../../support/app";

describe.for(testedVersions())("single sign-on with Headscale %s", (version) => {
  let tailnet: Tailnet;
  let dex: Awaited<ReturnType<typeof startTailnetDex>>;
  let app: TestApp;
  let owner: string;

  beforeAll(async () => {
    tailnet = await createTailnet({ version, headscaleConfig: HEADSCALE_OIDC });
    dex = await startTailnetDex(tailnet);
    app = await headplane();
    owner = (await app.signIn("owner")).cookie;
  });

  afterAll(async () => {
    await dex?.stop();
    await tailnet?.dispose();
  });

  function headplane(oidc: Record<string, unknown> = {}) {
    return tailnet.headplane({
      config: {
        server: { base_url: HEADPLANE_URL },
        oidc: { ...dex.headplaneOidc, ...oidc },
      },
    });
  }

  // Signs in to Headplane through Dex, like a browser would.
  async function signIn(email: string, on = app) {
    const start = (await on.call(oidcStart, "/oidc/start")) as Response;
    const state = start.headers.get("Set-Cookie")!.split(";")[0];
    const back = await dex.signIn(start.headers.get("Location")!, email);
    const callback = new URL(back.location!);

    const result = (await on.call(oidcCallback, "/oidc/callback", {
      as: state,
      search: callback.search,
    })) as Response;

    const session = result.headers.getSetCookie().at(-1)!.split(";")[0];
    const principal = await on.ctx.auth.require(on.request("/", { as: session }));
    if (!isUserPrincipal(principal)) throw new Error("Expected a user session");

    return { location: result.headers.get("Location"), cookie: session, principal };
  }

  // Registers a device through Headscale's own sign-in, creating its user.
  async function registerDevice(name: string, email: string) {
    const pending = await tailnet.pendingNode({ name });
    await dex.signIn(pending.registerUrl, email);
    return (await (await pending.joined()).machine()).user!;
  }

  test("signing in links the account to the Headscale user from the same sign-in", async () => {
    const user = await registerDevice("alice-laptop", "alice@allowed.test");
    expect(user.provider).toBe("oidc");

    const session = await signIn("alice@allowed.test");
    expect(session.location).toBe("/");
    expect(session.principal.user.headscaleUserId).toBe(user.id);
  });

  test("an account is linked once its first device signs in to Headscale", async () => {
    const session = await signIn("mallory@other.test");
    expect(session.location).toBe("/link");
    expect(session.principal.user.headscaleUserId).toBeFalsy();
    expect(await app.call(home, "/", { as: session.cookie })).toMatchObject({ isLinked: false });

    const user = await registerDevice("mallory-phone", "mallory@other.test");

    // The users list is cached for a few seconds, like for a reloading page.
    await waitFor("the account to link", async () => {
      expect(statusOf(await app.call(home, "/", { as: session.cookie }))).toBe(302);
    });
    expect(await app.call(home, "/", { as: session.cookie })).toMatchObject({
      isLinked: true,
      linkedName: user.name,
    });
  });

  test("a user Headscale manages through SSO can't be renamed", async () => {
    const user = await registerDevice("alice-desktop", "alice@allowed.test");
    const result = await app.call(userAction, "/users", {
      as: owner,
      form: { intent: "rename", headscale_user_id: user.id, name: "renamed" },
    });

    expect(statusOf(result)).toBe(403);
    expect(result).toMatchObject({
      data: { errors: { form: "Users managed by OIDC can't be renamed." } },
    });
    expect((await tailnet.api.users.list({ id: user.id }))[0].name).toBe(user.name);
  });

  test("signing out ends the session here and at the provider when asked to", async () => {
    const endSession = `${HEADPLANE_URL}/provider-logout`;
    const withEndSession = await headplane({
      use_end_session: true,
      end_session_endpoint: endSession,
    });

    const { cookie, principal } = await signIn("alice@allowed.test", withEndSession);
    const result = (await withEndSession.call(logout, "/logout", {
      as: cookie,
      form: {},
    })) as Response;

    const location = new URL(result.headers.get("Location")!);
    expect(location.href.startsWith(endSession)).toBe(true);
    const hint = location.searchParams.get("id_token_hint")!;
    const claims = JSON.parse(Buffer.from(hint.split(".")[1], "base64url").toString());
    expect(claims).toMatchObject({ sub: principal.user.subject, aud: "headplane" });

    await expect(
      withEndSession.ctx.auth.require(withEndSession.request("/", { as: cookie })),
    ).rejects.toThrow();
  });
});
