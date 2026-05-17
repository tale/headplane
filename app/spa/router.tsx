import { Link, Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { useState, useTransition } from "react";
import {
  useFateClient,
  useLiveListView,
  useLiveView,
  useRequest,
  view,
  type ViewRef,
} from "react-fate";

import type { FateMachine, FateUser } from "../server/fate";

const UserView = view<FateUser>()({
  displayName: true,
  email: true,
  id: true,
  name: true,
});

const MachineView = view<FateMachine>()({
  expiry: true,
  givenName: true,
  id: true,
  ipAddresses: true,
  lastSeen: true,
  name: true,
  online: true,
  tags: true,
  user: {
    displayName: true,
    id: true,
    name: true,
  },
});

const MachineConnectionView = {
  args: { first: 100 },
  items: {
    cursor: true,
    node: MachineView,
  },
  pagination: {
    hasNext: true,
    hasPrevious: true,
    nextCursor: true,
    previousCursor: true,
  },
};

const UserConnectionView = {
  args: { first: 100 },
  items: {
    cursor: true,
    node: UserView,
  },
  pagination: {
    hasNext: true,
    hasPrevious: true,
    nextCursor: true,
    previousCursor: true,
  },
};

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const machinesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/machines",
  component: MachinesPage,
});

const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/users",
  component: UsersPage,
});

const routeTree = rootRoute.addChildren([indexRoute, machinesRoute, usersRoute]);

export const router = createRouter({
  basepath: __PREFIX__,
  routeTree,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function RootLayout() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="border-b border-white/10 px-6 py-4">
        <nav className="flex gap-4 text-sm">
          <Link to="/">Home</Link>
          <Link to="/machines">Machines</Link>
          <Link to="/users">Users</Link>
        </nav>
      </header>

      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}

function HomePage() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">Headplane SPA</h1>
      <p className="text-neutral-400">
        This is the one-way SPA shell. Data should move to raw Fate views and actions.
      </p>
    </section>
  );
}

function MachinesPage() {
  const { machines } = useRequest({ machines: { list: MachineConnectionView } });
  const [machineItems, loadNext] = useLiveListView(MachineConnectionView, machines);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Machines</h1>

      {machineItems.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-white/5 p-4 text-neutral-400">
          No machines returned from Headscale.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-white/5 text-xs tracking-wide text-neutral-400 uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Machine</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Addresses</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {machineItems.map(({ node: machine }) => (
                <MachineRow key={machine.id} machine={machine} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {loadNext ? (
        <button
          className="rounded-lg border border-white/10 px-3 py-2 text-sm text-neutral-200 hover:bg-white/10"
          onClick={() => void loadNext()}
          type="button"
        >
          Load more machines
        </button>
      ) : null}
    </section>
  );
}

function MachineRow({ machine: machineRef }: { machine: ViewRef<"Machine"> }) {
  const fate = useFateClient();
  const machine = useLiveView(MachineView, machineRef);
  const currentName = machine.givenName || machine.name;
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const rename = () => {
    const nextName = name.trim();
    if (!nextName || nextName === currentName) {
      return;
    }

    startTransition(() => {
      void (async () => {
        setError(null);
        const result = await fate.mutations.machine.rename({
          input: { id: machine.id, name: nextName },
          view: MachineView,
        });

        if (result.error) {
          setError(result.error.message);
          return;
        }

        setName(nextName);
      })();
    });
  };

  return (
    <tr className="bg-neutral-950/80">
      <td className="px-4 py-3 align-top">
        <div className="font-medium text-white">{currentName}</div>
        <div className="text-xs text-neutral-500">{machine.id}</div>
        <form
          className="mt-2 flex max-w-sm gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            rename();
          }}
        >
          <input
            className="min-w-0 flex-1 rounded-md border border-white/10 bg-neutral-900 px-2 py-1 text-xs text-white outline-none focus:border-cyan-400"
            disabled={isPending}
            onChange={(event) => setName(event.currentTarget.value)}
            value={name}
          />
          <button
            className="rounded-md border border-white/10 px-2 py-1 text-xs text-neutral-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isPending || !name.trim() || name.trim() === currentName}
            type="submit"
          >
            {isPending ? "Saving" : "Rename"}
          </button>
        </form>
        {error ? <div className="mt-1 text-xs text-red-300">{error}</div> : null}
        {machine.tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {machine.tags.map((tag) => (
              <span
                className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-xs text-cyan-200"
                key={tag}
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </td>
      <td className="px-4 py-3 align-top text-neutral-300">
        {machine.user ? machine.user.displayName || machine.user.name : "Tag-owned"}
      </td>
      <td className="px-4 py-3 align-top text-neutral-300">
        <div className="flex flex-col gap-1 font-mono text-xs">
          {machine.ipAddresses.map((ip) => (
            <span key={ip}>{ip}</span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <span
          className={
            machine.online
              ? "rounded-full bg-green-400/10 px-2 py-1 text-xs text-green-200"
              : "rounded-full bg-neutral-700 px-2 py-1 text-xs text-neutral-300"
          }
        >
          {machine.online ? "Online" : "Offline"}
        </span>
      </td>
      <td className="px-4 py-3 align-top text-neutral-300">{formatDate(machine.lastSeen)}</td>
    </tr>
  );
}

function UsersPage() {
  const { users } = useRequest({ users: { list: UserConnectionView } });
  const [userItems, loadNext] = useLiveListView(UserConnectionView, users);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Users</h1>

      {userItems.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-white/5 p-4 text-neutral-400">
          No users returned from Headscale.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {userItems.map(({ node: user }) => (
            <UserCard key={user.id} user={user} />
          ))}
        </div>
      )}

      {loadNext ? (
        <button
          className="rounded-lg border border-white/10 px-3 py-2 text-sm text-neutral-200 hover:bg-white/10"
          onClick={() => void loadNext()}
          type="button"
        >
          Load more users
        </button>
      ) : null}
    </section>
  );
}

function UserCard({ user: userRef }: { user: ViewRef<"User"> }) {
  const user = useLiveView(UserView, userRef);

  return (
    <article className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="font-medium text-white">{user.displayName || user.name}</div>
      <div className="text-sm text-neutral-400">{user.name}</div>
      {user.email ? <div className="mt-2 text-sm text-neutral-300">{user.email}</div> : null}
      <div className="mt-3 font-mono text-xs text-neutral-500">{user.id}</div>
    </article>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Never";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}
