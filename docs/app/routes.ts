import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("api/search", "routes/search.ts"),
  route("changelog", "routes/changelog.tsx"),
  route("*", "routes/docs.tsx"),
] satisfies RouteConfig;
