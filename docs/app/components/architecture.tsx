import { ChevronRight } from "lucide-react";

const channelList = [
  {
    via: "API key",
    target: "Headscale's API",
    powers: "Machines, users, auth keys and ACLs",
    need: "Required",
  },
  {
    via: "Shared file",
    target: "Headscale's config file",
    powers: "DNS and sign-in restrictions",
    need: "Optional",
  },
  {
    via: "Agent",
    target: "The tailnet",
    powers: "Machine versions and Browser SSH",
    need: "Optional",
  },
];

export default function Architecture() {
  return (
    <figure className="not-prose border-line bg-subtle my-6 grid gap-3 rounded-lg border p-4 sm:grid-cols-[7rem_1fr] sm:p-5">
      <div className="border-line-strong bg-surface text-fg flex items-center justify-center rounded-md border py-3 text-sm font-semibold">
        Headplane
      </div>
      <ul className="grid gap-3">
        {channelList.map((channel) => (
          <li
            key={channel.via}
            className="grid items-center gap-1 sm:grid-cols-[6.5rem_1fr] sm:gap-3"
          >
            <div className="text-muted flex items-center gap-1.5 text-xs">
              <span className="bg-line-strong hidden h-px flex-1 sm:block" />
              <span>{channel.via}</span>
              <span className="bg-line-strong hidden h-px flex-1 sm:block" />
              <ChevronRight className="text-faint -ml-2.5 hidden size-3.5 sm:block" />
            </div>
            <div className="border-line bg-surface flex items-start justify-between gap-3 rounded-md border px-3 py-2">
              <div>
                <div className="text-fg text-sm font-medium">{channel.target}</div>
                <div className="text-muted text-xs">{channel.powers}</div>
              </div>
              <span className="text-faint shrink-0 text-xs">{channel.need}</span>
            </div>
          </li>
        ))}
      </ul>
    </figure>
  );
}
