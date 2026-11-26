import { Field as BaseField } from "@base-ui/react/field";

import Field, { controlClass } from "~/components/field";
import cn from "~/utils/cn";

interface DescriptionFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export default function DescriptionField({ value, onChange }: DescriptionFieldProps) {
  return (
    <Field
      description="Optional. Explain why this rule exists. This does not change access."
      label="Description"
    >
      <BaseField.Control
        className={cn(controlClass, "h-auto min-h-16 resize-y px-2.5 py-1.5")}
        onValueChange={onChange}
        render={<textarea rows={2} />}
        value={value}
      />
    </Field>
  );
}
