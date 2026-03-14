import { GlobeLock, RouteOff } from "lucide-react";
import { useFetcher } from "react-router";

import Dialog, { DialogPanel } from "~/components/Dialog";
import Link from "~/components/link";
import Switch from "~/components/Switch";
import TableList from "~/components/TableList";
import Text from "~/components/Text";
import Title from "~/components/Title";
import { PopulatedNode } from "~/utils/node-info";

interface RoutesProps {
  node: PopulatedNode;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

// TODO: Support deleting routes
export default function Routes({ node, isOpen, setIsOpen }: RoutesProps) {
  const fetcher = useFetcher();

  const subnets = [
    ...node.customRouting.subnetApprovedRoutes,
    ...node.customRouting.subnetWaitingRoutes,
  ];

  return (
    <Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
      <DialogPanel variant="unactionable">
        <Title>Edit route settings of {node.givenName}</Title>
        <Text className="font-bold">Subnet routes</Text>
        <Text>
          Connect to devices you can&apos;t install Tailscale on by advertising IP ranges as subnet
          routes.{" "}
          <Link external styled to="https://tailscale.com/kb/1019/subnets">
            Learn More
          </Link>
        </Text>
        <TableList className="mt-4">
          {subnets.length === 0 ? (
            <TableList.Item className="flex flex-col items-center gap-2.5 py-4 opacity-70">
              <RouteOff />
              <p className="font-semibold">No routes are advertised by this machine</p>
            </TableList.Item>
          ) : undefined}
          {subnets.map((route) => (
            <TableList.Item key={route}>
              <p>{route}</p>
              <Switch
                defaultSelected={node.approvedRoutes.includes(route)}
                label="Enabled"
                onChange={(checked) => {
                  const form = new FormData();
                  form.set("action_id", "update_routes");
                  form.set("node_id", node.id);
                  form.set("routes", [route].join(","));

                  form.set("enabled", String(checked));
                  fetcher.submit(form, {
                    method: "POST",
                  });
                }}
              />
            </TableList.Item>
          ))}
        </TableList>
        <Text className="mt-8 font-bold">Exit nodes</Text>
        <Text>
          Allow your network to route internet traffic through this machine.{" "}
          <Link external styled to="https://tailscale.com/kb/1103/exit-nodes">
            Learn More
          </Link>
        </Text>
        <TableList className="mt-4">
          {node.customRouting.exitRoutes.length === 0 ? (
            <TableList.Item className="flex flex-col items-center gap-2.5 py-4 opacity-70">
              <GlobeLock />
              <p className="font-semibold">This machine is not an exit node</p>
            </TableList.Item>
          ) : (
            <TableList.Item>
              <p>Use as exit node</p>
              <Switch
                defaultSelected={node.customRouting.exitApproved}
                label="Enabled"
                onChange={(checked) => {
                  const form = new FormData();
                  form.set("action_id", "update_routes");
                  form.set("node_id", node.id);
                  form.set("routes", node.customRouting.exitRoutes.map((route) => route).join(","));

                  form.set("enabled", String(checked));
                  fetcher.submit(form, {
                    method: "POST",
                  });
                }}
              />
            </TableList.Item>
          )}
        </TableList>
      </DialogPanel>
    </Dialog>
  );
}
