import * as v from "valibot";

export const guestEmail = v.pipe(
  v.string(),
  v.trim(),
  v.toLowerCase(),
  v.maxLength(254, "Use at most 254 characters."),
  v.email("Enter a valid email address."),
);

function optionalText(max: number) {
  return v.pipe(
    v.optional(v.string(), ""),
    v.trim(),
    v.maxLength(max, `Use at most ${max} characters.`),
    v.check(
      (value) => ![...value].some((char) => char.charCodeAt(0) < 32 && !"\n\r\t".includes(char)),
      "Remove control characters.",
    ),
  );
}

export const durationItems = [
  { value: "86400", label: "24 hours" },
  { value: "172800", label: "48 hours" },
  { value: "604800", label: "7 days" },
  { value: "custom", label: "Custom date" },
];

// datetime-local is explicitly labelled UTC in the form. Round-tripping also
// rejects impossible calendar dates, which Date.parse otherwise normalizes.
export function validPlannedDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
  const date = new Date(`${value}Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 16) === value;
}

export const plannedExpiry = v.pipe(
  v.optional(v.string(), ""),
  v.check((value) => value === "" || validPlannedDate(value), "Enter a valid UTC date and time."),
);

export const guestFields = {
  email: guestEmail,
  display_name: optionalText(100),
  notes: optionalText(4000),
  duration: v.picklist(["86400", "172800", "604800", "custom"], "Choose an access duration."),
  requested_expires_at: plannedExpiry,
};

export const guestId = v.pipe(v.string(), v.ulid("Choose a valid guest."));
export const guestRevision = v.pipe(
  v.string(),
  v.regex(/^[1-9]\d{0,9}$/, "Reload this guest before making changes."),
  v.transform(Number),
);

export const guestQuery = v.object({
  q: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(254)), ""),
  status: v.optional(v.picklist(["all", "draft", "revoked"]), "all"),
  sort: v.optional(
    v.picklist(["created-desc", "created-asc", "updated-desc", "updated-asc"]),
    "created-desc",
  ),
  page: v.optional(v.pipe(v.string(), v.regex(/^[1-9]\d{0,5}$/), v.transform(Number)), "1"),
});

export type GuestQuery = v.InferOutput<typeof guestQuery>;
