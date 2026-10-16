import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import Button from "~/components/button";
import Input from "~/components/input";
import { RemoveButton, Row, RowList } from "~/components/section";

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

// A small chip editor shared by the ACL and user dialogs, modelled on the
// machine tag dialog: current values, a field to add one, and suggestions.
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
        <p className="text-fg text-sm font-medium">{label}</p>
        {description ? <p className="text-muted text-xs">{description}</p> : null}
      </div>
      {values.length === 0 ? (
        <p className="text-muted py-2.5 text-sm">{emptyText}</p>
      ) : (
        <RowList>
          {values.map((value) => (
            <Row
              action={
                <RemoveButton
                  aria-label={`Remove ${value}`}
                  disabled={isDisabled}
                  onClick={() => onChange(values.filter((entry) => entry !== value))}
                  type="button"
                />
              }
              key={value}
            >
              <span className="font-mono text-xs break-all">{value}</span>
            </Row>
          ))}
        </RowList>
      )}
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
        <Button disabled={isDisabled || draftIsInvalid} onClick={() => add(draft)} type="button">
          <Plus className="size-4" />
          Add
        </Button>
      </div>
      {available.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {available.map((suggestion) => (
            <Button
              className="font-mono text-xs"
              disabled={isDisabled}
              key={suggestion}
              onClick={() => add(suggestion)}
              size="sm"
              type="button"
            >
              {suggestion}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
