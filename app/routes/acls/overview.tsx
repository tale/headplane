import { Construction, Eye, FileX, FlaskConical, Pencil, Shield, TagsIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Suspense, lazy, useMemo, useState } from "react";
import { isRouteErrorResponse, useFetcher } from "react-router";

import Button from "~/components/button";
import Callout from "~/components/callout";
import Code from "~/components/code";
import Link from "~/components/link";
import PageError, { ErrorState } from "~/components/page-error";
import PageHeader from "~/components/page-header";
import { Tabs, TabsList, TabsPanel, TabsTab } from "~/components/tabs";
import { isApiError } from "~/server/headscale/api/error-client";
import {
  parsePolicy,
  policyDestinations,
  policySources,
  serializePolicy,
  type Policy,
} from "~/utils/acl-policy";
import type { ActionResult } from "~/utils/form";
import { toastClientAction } from "~/utils/toast";

import type { Route } from "./+types/overview";
import { aclAction } from "./acl-action";
import { aclLoader } from "./acl-loader";
import Fallback from "./components/fallback";
import RulesEditor from "./components/rules-editor";
import TagsGroupsEditor from "./components/tags-groups-editor";

const LazyEditor = lazy(() =>
  import("./components/cm.client").then((m) => ({ default: m.Editor })),
);
const LazyDiffer = lazy(() =>
  import("./components/cm.client").then((m) => ({ default: m.Differ })),
);

export const loader = aclLoader;
export const action = aclAction;
export const clientAction = toastClientAction;

export default function Page({
  loaderData: { access, writable, canEditGrants, policy, users, tagUsage },
}: Route.ComponentProps) {
  const [codePolicy, setCodePolicy] = useState(policy);
  const [savedPolicy, setSavedPolicy] = useState(policy);
  if (savedPolicy !== policy) {
    setSavedPolicy(policy);
    setCodePolicy(policy);
  }

  const fetcher = useFetcher<ActionResult>();
  const disabled = !access || !writable; // Disable if no permission or not writable

  const parsed = useMemo(() => parsePolicy(codePolicy), [codePolicy]);
  const sources = useMemo(
    () => (parsed.ok ? policySources(parsed.policy, users) : []),
    [parsed, users],
  );
  const destinations = useMemo(
    () => (parsed.ok ? policyDestinations(parsed.policy, users) : []),
    [parsed, users],
  );

  // The structured editors round-trip through the policy text, so the file
  // editor, the diff view and Save all work off one source of truth.
  function applyPolicy(next: Policy) {
    setCodePolicy(serializePolicy(next));
  }

  function structuredPanel(render: (value: Policy) => ReactNode) {
    if (!parsed.ok) {
      return (
        <div className="p-4">
          <Callout
            className="my-4 max-w-2xl"
            title="Policy cannot be edited visually"
            variant="error"
          >
            The policy could not be parsed ({parsed.error}). Fix it in the <Code>Edit file</Code>{" "}
            tab and the visual editor will come back.
          </Callout>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-4 p-4">
        {parsed.hasComments ? (
          <Callout className="my-4 max-w-2xl" title="Comments will be removed" variant="warning">
            This policy contains comments. Saving a change made in the visual editor rewrites the
            policy and drops them.
          </Callout>
        ) : null}
        {render(parsed.policy)}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        description={
          <>
            The ACL file is used to define the access control rules for your network. You can find
            more information about the ACL file in the{" "}
            <Link external styled to="https://tailscale.com/kb/1018/acls">
              Tailscale ACL guide
            </Link>{" "}
            and the{" "}
            <Link external styled to="https://headscale.net/stable/ref/acls/">
              Headscale docs
            </Link>
            .
          </>
        }
        title="Access Control List (ACL)"
      />
      {!access ? (
        <Callout className="my-4 max-w-2xl" title="ACL Policy restricted" variant="warning">
          You do not have the necessary permissions to edit the Access Control List policy. Please
          contact your administrator to request access or to make changes to the ACL policy.
        </Callout>
      ) : !writable ? (
        <Callout className="my-4 max-w-2xl" title="Read-only ACL Policy" variant="error">
          The ACL policy mode is most likely set to <Code>file</Code> in your Headscale
          configuration. This means that the ACL file cannot be edited through the web interface. In
          order to resolve this, you'll need to set <Code>policy.mode</Code> to{" "}
          <Code>database</Code> in your Headscale configuration.
        </Callout>
      ) : undefined}
      {fetcher.data?.ok === false && (
        <Callout className="my-4 max-w-2xl" title="Couldn't save the policy" variant="error">
          {fetcher.data.errors.form ?? fetcher.data.errors.policy}
        </Callout>
      )}
      <Tabs className="mb-4" label="ACL Editor" defaultValue="rules">
        <TabsList>
          <TabsTab value="rules">
            <div className="flex items-center gap-2">
              <Shield className="p-1" />
              <span>Rules</span>
            </div>
          </TabsTab>
          <TabsTab value="tags">
            <div className="flex items-center gap-2">
              <TagsIcon className="p-1" />
              <span>Tags &amp; Groups</span>
            </div>
          </TabsTab>
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
        </TabsList>
        <TabsPanel value="rules">
          {structuredPanel((value) => (
            <RulesEditor
              canEditGrants={canEditGrants}
              destinations={destinations}
              isDisabled={disabled}
              onChange={applyPolicy}
              policy={value}
              sources={sources}
            />
          ))}
        </TabsPanel>
        <TabsPanel value="tags">
          {structuredPanel((value) => (
            <TagsGroupsEditor
              isDisabled={disabled}
              onChange={applyPolicy}
              policy={value}
              tagUsage={tagUsage}
              users={users}
            />
          ))}
        </TabsPanel>
        <TabsPanel value="edit">
          <Suspense fallback={<Fallback />}>
            <LazyEditor isDisabled={disabled} onChange={setCodePolicy} value={codePolicy} />
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
      </Tabs>
      <Button
        className="mr-2"
        disabled={
          disabled ||
          fetcher.state !== "idle" ||
          codePolicy.trim().length === 0 ||
          !parsed.ok ||
          codePolicy === policy
        }
        onClick={() => {
          fetcher.submit({ intent: "save", policy: codePolicy }, { method: "POST" });
        }}
        variant="primary"
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
        Discard changes
      </Button>
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
      <ErrorState
        description={
          <>
            Headscale is set to read its policy from a file, and that file doesn't exist. Create it
            at the path in Headscale's config, or set <Code>policy.mode</Code> to{" "}
            <Code>database</Code> so Headplane can manage the policy here.
          </>
        }
        icon={<FileX />}
        title="The policy file is missing"
      />
    );
  }

  return <PageError error={error} page="the access control policy" />;
}
