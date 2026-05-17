import { Link, Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";

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

const routeTree = rootRoute.addChildren([indexRoute, machinesRoute]);

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
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">Machines</h1>
      <p className="text-neutral-400">
        First migration target: replace the React Router loader/action/SSE model with raw Fate.
      </p>
    </section>
  );
}
