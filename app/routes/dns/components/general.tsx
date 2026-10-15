import { useFetcher } from "react-router";

import Callout from "~/components/callout";
import Section, { SettingList, SettingRow } from "~/components/section";
import Switch from "~/components/switch";
import type { ActionResult } from "~/utils/form";

import RenameTailnet from "./rename-tailnet";

interface Props {
  baseDomain: string;
  isMagicDns: boolean;
  isOverrideDns: boolean;
  isDisabled: boolean;
}

export default function General({ baseDomain, isMagicDns, isOverrideDns, isDisabled }: Props) {
  const magic = useToggle("toggle_magic", isMagicDns);
  const override = useToggle("override_dns", isOverrideDns);
  const error = magic.error ?? override.error;

  return (
    <Section description="Your tailnet domain and how devices pick a DNS server." title="General">
      <SettingList>
        <SettingRow
          action={<RenameTailnet isDisabled={isDisabled} name={baseDomain} />}
          label="Tailnet name"
        >
          <span className="font-mono text-xs">{baseDomain}</span>
        </SettingRow>
        <SettingRow
          action={
            <Switch
              checked={magic.isEnabled}
              disabled={isDisabled}
              label="Magic DNS"
              onCheckedChange={magic.submit}
            />
          }
          label="Magic DNS"
        >
          {magic.isEnabled ? (
            <span className="font-mono text-xs">[device].{baseDomain}</span>
          ) : (
            <span className="text-muted">Devices are only reachable by IP</span>
          )}
        </SettingRow>
        <SettingRow
          action={
            <Switch
              checked={override.isEnabled}
              disabled={isDisabled}
              label="Override local DNS"
              onCheckedChange={override.submit}
            />
          }
          label="Override local DNS"
        >
          <span className="text-muted">
            {override.isEnabled
              ? "Devices send all queries to the nameservers below"
              : "Devices keep their own DNS settings"}
          </span>
        </SettingRow>
      </SettingList>
      {error && (
        <Callout className="mt-3" variant="error">
          {error}
        </Callout>
      )}
    </Section>
  );
}

// Each switch gets its own fetcher so flipping both quickly doesn't cancel
// the first submit.
function useToggle(intent: string, isSaved: boolean) {
  const fetcher = useFetcher<ActionResult>();
  const pending = fetcher.formData?.get("enabled");

  return {
    isEnabled: pending ? pending === "true" : isSaved,
    error:
      fetcher.data?.ok === false
        ? (fetcher.data.errors.form ?? "Couldn't save the setting.")
        : undefined,
    submit: (checked: boolean) => {
      fetcher.submit({ intent, enabled: String(checked) }, { method: "POST" });
    },
  };
}
