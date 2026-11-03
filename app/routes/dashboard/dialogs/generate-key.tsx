import ActionDialog from "~/components/action-dialog";
import CodeBlock from "~/components/code-block";
import NumberInput from "~/components/number-input";
import { SwitchField } from "~/components/switch";

interface GenerateKeyProps {
  isDisabled?: boolean;
}

export default function GenerateKey({ isDisabled }: GenerateKeyProps) {
  return (
    <ActionDialog
      action="/dashboard"
      intent="create_key"
      isDisabled={isDisabled}
      submitLabel="Generate"
      title="Generate pre-auth key"
      description="Use this key to connect a device to your tailnet without signing in manually."
      success={({ key }) => (
        <div className="flex flex-col gap-3">
          <p className="text-muted text-sm">
            Copy this key now — it won't be shown again. Use it with{" "}
            <code className="text-fg">tailscale up --authkey=&lt;key&gt;</code>.
          </p>
          <CodeBlock>{key}</CodeBlock>
        </div>
      )}
    >
      <NumberInput
        defaultValue={90}
        description="The key stops working after this many days."
        label="Expires after (days)"
        min={1}
        max={365000}
        name="expiry"
        required
      />
      <SwitchField
        description="Allow this key to be used more than once."
        label="Reusable"
        name="reusable"
      />
      <SwitchField
        description="Devices registered with this key are removed when they go offline."
        label="Ephemeral"
        name="ephemeral"
      />
    </ActionDialog>
  );
}
