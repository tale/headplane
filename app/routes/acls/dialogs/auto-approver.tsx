import { useState } from "react";

import Input from "~/components/input";
import Select from "~/components/select";
import TokenList from "~/components/token-list";
import { isValidRoute } from "~/utils/acl-policy";

import EditorDialog from "./editor-dialog";

// `null` stands for exit nodes, anything else is a route prefix.
export type ApproverTarget = string | null;

interface AutoApproverDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  // Absent when creating a new entry.
  target?: ApproverTarget;
  approvers?: string[];
  existingRoutes: string[];
  exitNodeApprovers: string[];
  suggestions: string[];
  onSave: (target: ApproverTarget, approvers: string[]) => void;
}

export default function AutoApproverDialog({
  isOpen,
  setIsOpen,
  target,
  approvers,
  existingRoutes,
  exitNodeApprovers,
  suggestions,
  onSave,
}: AutoApproverDialogProps) {
  const isNew = target === undefined;
  const [isExitNode, setIsExitNode] = useState(target === null);
  const [route, setRoute] = useState(target ?? "");
  const [draft, setDraft] = useState<string[]>(() => [...(approvers ?? [])]);

  const trimmedRoute = route.trim();
  const isDuplicate = trimmedRoute !== target && existingRoutes.includes(trimmedRoute);
  const routeIsInvalid = !isValidRoute(trimmedRoute) || isDuplicate;
  const isInvalid = draft.length === 0 || (!isExitNode && routeIsInvalid);

  return (
    <EditorDialog
      description="Routes and exit nodes advertised by these users, groups or tags are approved without manual review."
      isDisabled={isInvalid}
      isOpen={isOpen}
      onSubmit={() => onSave(isExitNode ? null : trimmedRoute, draft)}
      setIsOpen={setIsOpen}
      submitLabel={isNew ? "Add approvers" : "Update approvers"}
      title={isNew ? "New auto approver" : "Edit auto approver"}
    >
      {isNew ? (
        <Select
          items={[
            { value: "route", label: "Subnet route" },
            { value: "exit", label: "Exit node" },
          ]}
          label="Approve"
          onValueChange={(value) => {
            const exit = value === "exit";
            setIsExitNode(exit);
            // There is only one exit node list, so start from what is there.
            if (exit) setDraft([...exitNodeApprovers]);
          }}
          value={isExitNode ? "exit" : "route"}
        />
      ) : null}
      {isExitNode ? null : (
        <Input
          errorMessage={
            isDuplicate
              ? "This route already has approvers."
              : "Enter an IPv4 or IPv6 prefix, for example 10.0.0.0/8."
          }
          invalid={trimmedRoute.length > 0 && routeIsInvalid}
          label="Route"
          onChange={setRoute}
          placeholder="10.0.0.0/8"
          value={route}
        />
      )}
      <TokenList
        description="Users, groups or tags whose machines are approved."
        emptyText="No approvers yet"
        label="Approvers"
        onChange={setDraft}
        placeholder="tag:router"
        suggestions={suggestions}
        values={draft}
      />
    </EditorDialog>
  );
}
