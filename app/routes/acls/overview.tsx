import {
  AlertCircle,
  CircleX,
  Construction,
  Eye,
  FlaskConical,
  Pencil,
  Share2,
} from "lucide-react";
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
// Aliased: this module also exports a route-level ErrorBoundary, which is the
// thing we are specifically trying not to reach.
import { ErrorBoundary as RenderErrorBoundary } from "react-error-boundary";
import {
  isRouteErrorResponse,
  type ShouldRevalidateFunction,
  useFetcher,
  useRevalidator,
  useSearchParams,
} from "react-router";

import Button from "~/components/button";
import Card from "~/components/card";
import Code from "~/components/code";
import Link from "~/components/link";
import Notice from "~/components/notice";
import PageError from "~/components/page-error";
import { Tabs, TabsList, TabsPanel, TabsTab } from "~/components/tabs";
import { isApiError } from "~/server/headscale/api/error-client";
import { locateRules, locateRuleToken } from "~/utils/acl/locate";
import toast from "~/utils/toast";

import type { Route } from "./+types/overview";
import { aclAction } from "./acl-action";
import { aclLoader } from "./acl-loader";
import Fallback from "./components/fallback";

const LazyEditor = lazy(() =>
  import("./components/cm.client").then((m) => ({ default: m.Editor })),
);
const LazyDiffer = lazy(() =>
  import("./components/cm.client").then((m) => ({ default: m.Differ })),
);
const LazyMap = lazy(() =>
  import("./components/map.client").then((m) => ({ default: m.ReachabilityMap })),
);

export const loader = aclLoader;
export const action = aclAction;

/** Must list every <TabsTab value>, or that tab cannot be selected. */
const TAB_VALUES = ["edit", "diff", "preview", "map"] as const;
type TabValue = (typeof TAB_VALUES)[number];

function isTabValue(value: string | null): value is TabValue {
  return value !== null && (TAB_VALUES as readonly string[]).includes(value);
}

/**
 * The reachability map stores its selection in the URL so browser back/forward
 * navigate between focused nodes. Those params are purely client-side, so a
 * node click must not refetch the policy and machine list — and must not
 * disturb the unsaved editor buffer. Anything else (including the explicit
 * revalidation after a save) still goes through as normal.
 */
export const shouldRevalidate: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}) => {
  if (formMethod !== undefined) return defaultShouldRevalidate;

  const uiParams = ["node", "flow", "edge", "tab", "rule", "token", "only", "hide", "qoff", "anim"];
  const mapParamsChanged = uiParams.some(
    (param) => currentUrl.searchParams.get(param) !== nextUrl.searchParams.get(param),
  );
  if (!mapParamsChanged) return defaultShouldRevalidate;

  // Only skip when those client-side params are the *only* thing that changed.
  const withoutMapParams = (url: URL) => {
    const params = new URLSearchParams(url.searchParams);
    for (const param of uiParams) params.delete(param);
    return `${url.pathname}?${params.toString()}`;
  };

  return withoutMapParams(currentUrl) !== withoutMapParams(nextUrl);
};

export default function Page({
  loaderData: { access, writable, policy, nodes },
}: Route.ComponentProps) {
  const [codePolicy, setCodePolicy] = useState(policy);
  const fetcher = useFetcher<typeof action>();
  const { revalidate } = useRevalidator();
  const [searchParams, setSearchParams] = useSearchParams();
  const disabled = !access || !writable; // Disable if no permission or not writable

  // The tab lives in the URL so that "show this rule in the file" is a real
  // history entry: Back returns to the map tab with its selection intact.
  // Every tab value must round-trip — treating anything that is not "map" as
  // "edit" made the diff and preview tabs unselectable.
  const tabParam = searchParams.get("tab");
  const tab: TabValue = isTabValue(tabParam) ? tabParam : "edit";

  // Ranges are scanned from the LIVE buffer, not the saved policy — unsaved
  // edits shift every offset, and highlighting the wrong rule is worse than
  // not highlighting at all.
  //
  // The buffer is deliberately read through a ref rather than being a
  // dependency: locateRules walks the whole policy, the result is consumed
  // once per jump, and depending on the text would rescan on every keystroke
  // for as long as the params stayed in the URL.
  const bufferRef = useRef(codePolicy);
  bufferRef.current = codePolicy;

  const ruleRaw = searchParams.get("rule");
  const tokenParam = searchParams.get("token");
  const ruleParam = Number(ruleRaw);
  const highlight = useMemo(() => {
    if (ruleRaw === null || !Number.isInteger(ruleParam)) return undefined;
    const buffer = bufferRef.current;
    try {
      const rule = locateRules(buffer).find((range) => range.index === ruleParam);
      if (!rule) return undefined;
      // Narrow to the offending token when one was named; fall back to the
      // whole rule if it cannot be found, e.g. after an edit moved it.
      if (tokenParam) return locateRuleToken(buffer, rule, tokenParam) ?? rule;
      return rule;
    } catch {
      // Scanning someone else's policy should never take the page down.
      return undefined;
    }
  }, [ruleRaw, ruleParam, tokenParam]);

  const selectTab = (next: string | number) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        // "edit" is the default, so it stays out of the URL.
        if (next === "edit") params.delete("tab");
        else params.set("tab", String(next));
        // A highlight belongs to one visit to the editor, not to the tab.
        params.delete("rule");
        params.delete("token");
        return params;
      },
      // Replace: switching tabs by hand is not a step worth retracing.
      { preventScrollReset: true, replace: true },
    );
  };

  useEffect(() => {
    // Update the codePolicy when the loader data changes
    if (policy !== codePolicy) {
      setCodePolicy(policy);
    }
  }, [policy]);

  useEffect(() => {
    if (!fetcher.data) {
      // No data yet, return
      return;
    }

    if (fetcher.data.success === true) {
      toast("Updated policy");
      revalidate();
    }
  }, [fetcher.data]);

  return (
    <div>
      {!access ? (
        <Notice title="ACL Policy restricted" variant="warning">
          You do not have the necessary permissions to edit the Access Control List policy. Please
          contact your administrator to request access or to make changes to the ACL policy.
        </Notice>
      ) : !writable ? (
        <Notice title="Read-only ACL Policy" variant="error">
          The ACL policy mode is most likely set to <Code>file</Code> in your Headscale
          configuration. This means that the ACL file cannot be edited through the web interface. In
          order to resolve this, you'll need to set <Code>policy.mode</Code> to{" "}
          <Code>database</Code> in your Headscale configuration.
        </Notice>
      ) : undefined}
      <h1 className="mb-4 text-2xl font-medium">Access Control List (ACL)</h1>
      <p className="mb-4 max-w-prose">
        The ACL file is used to define the access control rules for your network. You can find more
        information about the ACL file in the{" "}
        <Link external styled to="https://tailscale.com/kb/1018/acls">
          Tailscale ACL guide
        </Link>{" "}
        and the{" "}
        <Link external styled to="https://headscale.net/stable/ref/acls/">
          Headscale docs
        </Link>
        .
      </p>
      {fetcher.data?.error !== undefined ? (
        <Notice title={fetcher.data.error.split(":")[0] ?? "Error"} variant="error">
          {fetcher.data.error.split(":").slice(1).join(": ") ??
            "An unknown error occurred while trying to update the ACL policy."}
        </Notice>
      ) : undefined}
      <Tabs className="mb-4" label="ACL Editor" onValueChange={selectTab} value={tab}>
        <TabsList>
          <TabsTab value="edit">
            <div className="flex items-center gap-2">
              <Pencil className="p-1" />
              <span>Edit file</span>
            </div>
          </TabsTab>
          <TabsTab value="diff">
            <div className="flex items-center gap-2">
              <Eye className="p-1" />
              <span>Preview changes</span>
            </div>
          </TabsTab>
          <TabsTab value="preview">
            <div className="flex items-center gap-2">
              <FlaskConical className="p-1" />
              <span>Preview rules</span>
            </div>
          </TabsTab>
          <TabsTab value="map">
            <div className="flex items-center gap-2">
              <Share2 className="p-1" />
              <span>Reachability map</span>
            </div>
          </TabsTab>
        </TabsList>
        <TabsPanel value="edit">
          <Suspense fallback={<Fallback />}>
            <LazyEditor
              highlight={highlight}
              // Identifies the jump itself: it changes when you ask for a
              // different rule or token, and not when you edit the buffer.
              highlightKey={`${ruleRaw ?? ""}:${tokenParam ?? ""}`}
              isDisabled={disabled}
              onChange={setCodePolicy}
              value={codePolicy}
            />
          </Suspense>
        </TabsPanel>
        <TabsPanel value="diff">
          <Suspense fallback={<Fallback />}>
            <LazyDiffer left={policy} right={codePolicy} />
          </Suspense>
        </TabsPanel>
        <TabsPanel value="preview">
          <div className="flex flex-col items-center py-8">
            <Construction />
            <p className="mt-4 w-1/2 text-center">
              Previewing rules is not available yet. This feature is still in development and is
              pretty complicated to implement. Hopefully I will be able to get to it soon.
            </p>
          </div>
        </TabsPanel>
        <TabsPanel value="map">
          {/*
            The map is a read-only view built on a lot of assumptions about
            policy shape, and it has only been exercised against a handful of
            real ones. If it fails it must fail alone: the editor on the other
            tab may be holding unsaved changes, and the route-level
            ErrorBoundary would replace the entire page.
          */}
          <RenderErrorBoundary
            fallback={
              <div className="flex flex-col items-center gap-2.5 py-8">
                <CircleX />
                <p className="text-lg font-semibold">Failed to render the reachability map.</p>
                <p className="max-w-prose text-center text-sm text-mist-500">
                  Your policy is untouched and still editable on the other tabs. If this keeps
                  happening, the policy shape is worth reporting.
                </p>
              </div>
            }
          >
            <Suspense fallback={<Fallback />}>
              {/*
                Fed the SAVED policy, not the editor buffer: this map describes
                what Headscale is actually enforcing right now. `unsaved` lets
                it say so when the buffer has diverged, rather than quietly
                showing something other than your draft.
              */}
              <LazyMap nodes={nodes} policy={policy} unsaved={codePolicy !== policy} />
            </Suspense>
          </RenderErrorBoundary>
        </TabsPanel>
      </Tabs>
      {/*
        Editing controls, so they only belong to the editing tabs. The map is a
        read-only view of the same buffer — showing Save under it implies the
        map is something you are composing.
      */}
      {tab === "map" ? undefined : (
        <>
          <Button
            className="mr-2"
            disabled={
              disabled ||
              fetcher.state !== "idle" ||
              codePolicy.length === 0 ||
              codePolicy === policy
            }
            onClick={() => {
              const formData = new FormData();
              formData.append("policy", codePolicy);
              fetcher.submit(formData, { method: "PATCH" });
            }}
            variant="heavy"
          >
            Save
          </Button>
          <Button
            disabled={disabled || fetcher.state !== "idle" || codePolicy === policy}
            onClick={() => {
              // Reset the editor to the original policy
              setCodePolicy(policy);
            }}
          >
            Discard Changes
          </Button>
        </>
      )}
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (
    isRouteErrorResponse(error) &&
    isApiError(error.data) &&
    error.data.rawData.includes("reading policy from path") &&
    error.data.rawData.includes("no such file or directory")
  ) {
    return (
      <div className="flex flex-col gap-4">
        <Card className="max-w-2xl" variant="flat">
          <div className="flex items-center justify-between gap-4">
            <Card.Title>ACL Policy Unavailable</Card.Title>
            <AlertCircle className="mb-2 h-6 w-6 text-red-500" />
          </div>
          <Card.Text>
            The ACL policy is currently unavailable because the policy file does not exist on the
            server. This usually indicates that Headscale is running in <Code>file</Code> mode for
            ACLs, and the specified policy file is missing.
          </Card.Text>
        </Card>
        <Card className="max-w-2xl" variant="flat">
          <Card.Text>
            In order to resolve this issue, there are two possible actions you can take:
          </Card.Text>
          <ul className="mt-2 ml-4 list-outside list-disc space-y-1 text-sm">
            <li>
              Create the ACL policy file at the specified path in your Headscale configuration.
            </li>
            <li>
              Alternatively, you can switch Headscale to use <Code>database</Code> mode for ACLs by
              updating your Headscale configuration. This will allow Headplane to manage the ACL
              policy directly through the web interface.
            </li>
          </ul>
        </Card>
      </div>
    );
  }

  return <PageError error={error} page="Access Control" />;
}
