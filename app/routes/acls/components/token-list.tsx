import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";

import Button from "~/components/button";
import Input from "~/components/input";
import TableList from "~/components/table-list";
import cn from "~/utils/cn";

interface TokenListProps {
  label: string;
  description?: string;
  values: string[];
  onChange: (values: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  emptyText: string;
  isDisabled?: boolean;
  validate?: (value: string) => boolean;
  // Rewrites a value before it is added, e.g. appending a default port.
  normalize?: (value: string) => string;
}

// A small chip editor used across the ACL dialogs. It mirrors the machine tag
// dialog: a list of the current values, a text field to add a new one, and a
// row of one-click suggestions pulled from the policy.
export default function TokenList({
  label,
  description,
  values,
  onChange,
  suggestions,
  placeholder,
  emptyText,
  isDisabled,
  validate,
  normalize,
}: TokenListProps) {
  const [draft, setDraft] = useState("");

  const prepare = useMemo(
    () => (value: string) => (normalize ? normalize(value.trim()) : value.trim()),
    [normalize],
  );

  // Suggestions are compared in their normalized form, otherwise picking
  // `tag:web` after it was added as `tag:web:*` would duplicate it.
  const available = useMemo(
    () => (suggestions ?? []).filter((suggestion) => !values.includes(prepare(suggestion))),
    [suggestions, values, prepare],
  );

  const draftIsInvalid = useMemo(() => {
    const prepared = prepare(draft);
    if (prepared.length === 0) return true;
    if (values.includes(prepared)) return true;
    return validate ? !validate(prepared) : false;
  }, [draft, values, validate, prepare]);

  function add(value: string) {
    const prepared = prepare(value);
    if (prepared.length === 0 || values.includes(prepared)) {
      return;
    }
    onChange([...values, prepared]);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-sm font-medium text-mist-700 dark:text-mist-200">{label}</p>
        {description ? (
          <p className="text-xs text-mist-500 dark:text-mist-400">{description}</p>
        ) : null}
      </div>
      <TableList>
        {values.length === 0 ? (
          <TableList.Item className="justify-center py-3 text-sm opacity-70">
            {emptyText}
          </TableList.Item>
        ) : (
          values.map((value) => (
            <TableList.Item className="font-mono text-sm" id={value} key={value}>
              {value}
              <Button
                className="rounded-md p-0.5"
                disabled={isDisabled}
                onClick={() => onChange(values.filter((entry) => entry !== value))}
                type="button"
              >
                <X className="p-1" />
              </Button>
            </TableList.Item>
          ))
        )}
      </TableList>
      <div className="flex items-center gap-2">
        <Input
          aria-label={`Add to ${label}`}
          className="w-full"
          disabled={isDisabled}
          invalid={draft.length > 0 && draftIsInvalid}
          label={label}
          labelHidden
          onChange={setDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (!draftIsInvalid) add(draft);
            }
          }}
          placeholder={placeholder}
          value={draft}
        />
        <Button
          className={cn("rounded-md p-1", draftIsInvalid && "cursor-not-allowed opacity-50")}
          disabled={isDisabled || draftIsInvalid}
          onClick={() => add(draft)}
          type="button"
        >
          <Plus className="p-1" size={30} />
        </Button>
      </div>
      {available.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {available.map((suggestion) => (
            <Button
              className="px-2 py-1 font-mono text-xs"
              disabled={isDisabled}
              key={suggestion}
              onClick={() => add(suggestion)}
              type="button"
              variant="ghost"
            >
              {suggestion}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
