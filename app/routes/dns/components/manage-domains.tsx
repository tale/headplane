import { ArrowDown, ArrowUp } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";

import ActionDialog from "~/components/action-dialog";
import Button from "~/components/button";
import Callout from "~/components/callout";
import cn from "~/utils/cn";
import type { ActionResult } from "~/utils/form";

import AddDomain from "../dialogs/add-domain";
import { type Direction, moveDomain } from "../search-domains";
import Section, { RemoveButton, Row, RowList } from "./section";

interface Props {
  searchDomains: string[];
  isDisabled: boolean;
  magic?: string;
}

export default function ManageDomains({ searchDomains, isDisabled, magic }: Props) {
  const fetcher = useFetcher<ActionResult>();
  const [focusTarget, setFocusTarget] = useState<{ domain: string; direction: Direction }>();
  const pending = fetcher.formData;
  const domains = pending
    ? moveDomain(
        searchDomains,
        String(pending.get("domain")),
        pending.get("direction") as Direction,
      )
    : searchDomains;

  function move(domain: string, direction: Direction) {
    setFocusTarget({ domain, direction });
    fetcher.submit({ intent: "move_domain", domain, direction }, { method: "POST" });
  }

  // Moving a row in the DOM drops focus, so the moved row's arrow takes it
  // back when it commits. At the end of the list that arrow is disabled and
  // the other one takes it instead.
  function focusRef(domain: string, index: number, direction: Direction) {
    if (focusTarget?.domain !== domain) {
      return undefined;
    }

    const isUp = focusTarget.direction === "up";
    const isEdge = isUp ? index === 0 : index === domains.length - 1;
    const opposite = isUp ? "down" : "up";
    const wanted = isEdge ? opposite : focusTarget.direction;
    return wanted === direction ? (el: HTMLButtonElement | null) => el?.focus() : undefined;
  }

  return (
    <Section
      action={isDisabled ? undefined : <AddDomain />}
      description="Devices try these suffixes, in order, when resolving a short name. With Magic DNS on, your tailnet domain always comes first."
      title="Search domains"
    >
      {fetcher.data?.ok === false && (
        <Callout className="mb-3" variant="error">
          {fetcher.data.errors.form ?? "Couldn't reorder the search domains."}
        </Callout>
      )}
      {!magic && domains.length === 0 ? (
        <p className="text-muted py-2.5 text-sm">No search domains</p>
      ) : (
        <RowList>
          {magic && (
            <Row action={<span className="text-muted px-2">Magic DNS</span>}>
              <span className="font-mono text-xs break-all">{magic}</span>
            </Row>
          )}
          {domains.map((domain, index) => (
            <Row
              action={
                <div className="flex items-center gap-1">
                  {!isDisabled && (
                    <div
                      className={cn(
                        "flex opacity-0 transition-opacity",
                        "group-hover/row:opacity-100 group-has-focus-visible/row:opacity-100",
                        "pointer-coarse:opacity-100",
                      )}
                    >
                      <Button
                        aria-label={`Move ${domain} up`}
                        disabled={index === 0}
                        onClick={() => move(domain, "up")}
                        onFocus={() => setFocusTarget(undefined)}
                        ref={focusRef(domain, index, "up")}
                        size="sm"
                        variant="icon"
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        aria-label={`Move ${domain} down`}
                        disabled={index === domains.length - 1}
                        onClick={() => move(domain, "down")}
                        onFocus={() => setFocusTarget(undefined)}
                        ref={focusRef(domain, index, "down")}
                        size="sm"
                        variant="icon"
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                    </div>
                  )}
                  <ActionDialog
                    description="Devices stop trying this suffix on short names."
                    fields={{ domain }}
                    intent="remove_domain"
                    isDestructive
                    submitLabel="Remove"
                    title={`Remove search domain ${domain}?`}
                    trigger={<RemoveButton disabled={isDisabled} />}
                  />
                </div>
              }
              className="group/row"
              key={domain}
            >
              <span className="font-mono text-xs break-all">{domain}</span>
            </Row>
          ))}
        </RowList>
      )}
    </Section>
  );
}
