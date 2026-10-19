import { formatTimeDelta } from "~/utils/time";

interface MachinesSeenProps {
  machines: { online: boolean; lastSeen: string }[];
}

export default function MachinesSeen({ machines }: MachinesSeenProps) {
  if (machines.length === 0) {
    return <span className="text-muted">No machines</span>;
  }

  if (machines.some((machine) => machine.online)) {
    return <span className="text-ok">Connected</span>;
  }

  const lastSeen = new Date(Math.max(...machines.map((m) => new Date(m.lastSeen).getTime())));
  return (
    <span className="text-muted" suppressHydrationWarning title={lastSeen.toLocaleString()}>
      {formatTimeDelta(lastSeen)}
    </span>
  );
}
