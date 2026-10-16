import { useFetcher } from "react-router";

import Button from "~/components/button";
import Callout from "~/components/callout";
import { Dialog, DialogActions, DialogClose, DialogTitle } from "~/components/dialog";
import Link from "~/components/link";
import { Row, RowList } from "~/components/section";
import Switch from "~/components/switch";
import type { ActionResult } from "~/utils/form";
import type { PopulatedNode } from "~/utils/node-info";

interface RoutesProps {
  node: PopulatedNode;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function Routes({ node, isOpen, setIsOpen }: RoutesProps) {
  const fetcher = useFetcher<ActionResult>();
  const subnets = [
    ...node.customRouting.subnetApprovedRoutes,
    ...node.customRouting.subnetWaitingRoutes,
  ];

  function submit(routes: string[], enabled: boolean) {
    const form = new FormData();
    form.set("intent", "update_routes");
    form.set("node_id", node.id);
    form.set("enabled", String(enabled));
    for (const route of routes) {
      form.append("routes", route);
    }

    fetcher.submit(form, { method: "POST" });
  }

  return (
    <Dialog onOpenChange={setIsOpen} open={isOpen}>
      <DialogTitle>Routes for {node.givenName}</DialogTitle>
      <section className="flex flex-col gap-2">
        <h3 className="font-medium">Subnet routes</h3>
        <p className="text-muted">
          Reach devices that can&apos;t run Tailscale through IP ranges this machine advertises.{" "}
          <Link external styled to="https://tailscale.com/kb/1019/subnets">
            Docs
          </Link>
        </p>
        {subnets.length === 0 ? (
          <p className="text-muted py-2.5 text-sm">
            This machine doesn&apos;t advertise any routes
          </p>
        ) : (
          <RowList>
            {subnets.map((route) => (
              <Row
                action={
                  <Switch
                    defaultChecked={node.approvedRoutes.includes(route)}
                    label={`Approve ${route}`}
                    onCheckedChange={(checked) => submit([route], checked)}
                  />
                }
                key={route}
              >
                <span className="font-mono text-xs break-all">{route}</span>
              </Row>
            ))}
          </RowList>
        )}
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="font-medium">Exit node</h3>
        <p className="text-muted">
          Let devices send their internet traffic through this machine.{" "}
          <Link external styled to="https://tailscale.com/kb/1103/exit-nodes">
            Docs
          </Link>
        </p>
        {node.customRouting.exitRoutes.length === 0 ? (
          <p className="text-muted py-2.5 text-sm">
            This machine isn&apos;t advertised as an exit node
          </p>
        ) : (
          <RowList>
            <Row
              action={
                <Switch
                  defaultChecked={node.customRouting.exitApproved}
                  label="Use as exit node"
                  onCheckedChange={(checked) => submit(node.customRouting.exitRoutes, checked)}
                />
              }
            >
              Use as exit node
            </Row>
          </RowList>
        )}
      </section>
      {fetcher.data?.ok === false && (
        <Callout variant="error">{fetcher.data.errors.form ?? "Couldn't update routes."}</Callout>
      )}
      <DialogActions>
        <DialogClose render={<Button>Done</Button>} />
      </DialogActions>
    </Dialog>
  );
}
