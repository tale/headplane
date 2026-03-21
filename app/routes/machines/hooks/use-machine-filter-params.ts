import { useSearchParams } from "react-router";

export interface MachineFilterParams {
  filterUser: string | null;
  filterTag: string | null;
  filterStatus: "online" | "offline" | "expired" | null;
  filterRoute: "exit-node" | "subnet" | null;
  hasActiveFilters: boolean;
  setParam: (key: string, value: string | null) => void;
  clearFilters: () => void;
}

export function useMachineFilterParams(): MachineFilterParams {
  const [searchParams, setSearchParams] = useSearchParams();

  const filterUser = searchParams.get("user");
  const filterTag = searchParams.get("tag");
  const filterStatus = searchParams.get("status") as MachineFilterParams["filterStatus"];
  const filterRoute = searchParams.get("route") as MachineFilterParams["filterRoute"];

  const hasActiveFilters =
    filterUser !== null || filterTag !== null || filterStatus !== null || filterRoute !== null;

  const setParam = (key: string, value: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === null) next.delete(key);
      else next.set(key, value);
      return next;
    });
  };

  const clearFilters = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams();
      const q = prev.get("q");
      if (q) next.set("q", q);
      return next;
    });
  };

  return {
    filterUser,
    filterTag,
    filterStatus,
    filterRoute,
    hasActiveFilters,
    setParam,
    clearFilters,
  };
}
