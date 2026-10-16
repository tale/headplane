import { ArrowDown, ArrowUp } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";

import Button from "~/components/button";
import cn from "~/utils/cn";
import type { ActionResult } from "~/utils/form";

import { type Direction, moveItem } from "../reorder";

type Scope = Record<string, string>;

/**
 * Optimistic up/down reordering for one or more lists that share an intent.
 * `field` names the moved item in the submit; `scope` holds the extra fields
 * that tell lists apart, such as the split DNS domain.
 */
export function useReorder(intent: string, field: string) {
  const fetcher = useFetcher<ActionResult>();
  const [focusTarget, setFocusTarget] = useState<{ id: string; direction: Direction }>();
  const pending = fetcher.formData;

  function isPendingFor(scope: Scope) {
    return Object.entries(scope).every(([key, value]) => (pending?.get(key) ?? "") === value);
  }

  function order(list: string[], scope: Scope = {}) {
    if (!pending || !isPendingFor(scope)) {
      return list;
    }

    return moveItem(list, String(pending.get(field)), pending.get("direction") as Direction);
  }

  function move(item: string, direction: Direction, scope: Scope) {
    setFocusTarget({ id: idOf(item, scope), direction });
    fetcher.submit({ intent, [field]: item, direction, ...scope }, { method: "POST" });
  }

  // Moving a row in the DOM drops focus, so the moved row's arrow takes it
  // back when it commits. At the end of the list that arrow is disabled and
  // the other one takes it instead.
  function focusRef(id: string, isEdge: (dir: Direction) => boolean, direction: Direction) {
    if (focusTarget?.id !== id) {
      return undefined;
    }

    const opposite = focusTarget.direction === "up" ? "down" : "up";
    const wanted = isEdge(focusTarget.direction) ? opposite : focusTarget.direction;
    return wanted === direction ? (el: HTMLButtonElement | null) => el?.focus() : undefined;
  }

  function controls(list: string[], index: number, scope: Scope = {}) {
    const item = list[index];
    const id = idOf(item, scope);
    const isEdge = (dir: Direction) => (dir === "up" ? index === 0 : index === list.length - 1);

    return (
      <div
        className={cn(
          "flex opacity-0 transition-opacity",
          "group-hover/row:opacity-100 group-has-focus-visible/row:opacity-100",
          "pointer-coarse:opacity-100",
        )}
      >
        <Button
          aria-label={`Move ${item} up`}
          disabled={isEdge("up")}
          onClick={() => move(item, "up", scope)}
          onFocus={() => setFocusTarget(undefined)}
          ref={focusRef(id, isEdge, "up")}
          size="sm"
          variant="icon"
        >
          <ArrowUp className="size-4" />
        </Button>
        <Button
          aria-label={`Move ${item} down`}
          disabled={isEdge("down")}
          onClick={() => move(item, "down", scope)}
          onFocus={() => setFocusTarget(undefined)}
          ref={focusRef(id, isEdge, "down")}
          size="sm"
          variant="icon"
        >
          <ArrowDown className="size-4" />
        </Button>
      </div>
    );
  }

  return {
    order,
    controls,
    error:
      fetcher.data?.ok === false ? (fetcher.data.errors.form ?? "Couldn't reorder.") : undefined,
  };
}

function idOf(item: string, scope: Scope) {
  return JSON.stringify([item, scope]);
}
