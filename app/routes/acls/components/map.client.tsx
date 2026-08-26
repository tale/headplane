import {
  Background,
  BaseEdge,
  Controls,
  type Edge,
  type EdgeProps,
  getBezierPath,
  getStraightPath,
  Handle,
  type InternalNode,
  MarkerType,
  type Node,
  type NodeProps,
  Panel,
  Position,
  ReactFlow,
  type ReactFlowInstance,
  useEdgesState,
  useInternalNode,
  useNodesState,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import {
  CircleAlert,
  Eye,
  EyeOff,
  Focus,
  FunnelX,
  ListFilter,
  Search,
  ToggleLeft,
  ToggleRight,
  X,
} from "lucide-react";
import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router";

import Tooltip from "~/components/tooltip";
import { evaluatePolicy } from "~/utils/acl/evaluate";
import {
  type AclEdge,
  type AclEvaluation,
  type AclNode,
  type EdgeRule,
  INTERNET,
  isSubnetNodeId,
  type PortRange,
} from "~/utils/acl/model";
import { portTokens, summarisePorts } from "~/utils/acl/ports";
import cn from "~/utils/cn";

interface ReachabilityMapProps {
  nodes: AclNode[];
  /** The SAVED policy — the map shows what is actually being enforced. */
  policy: string;
  /** The editor buffer has diverged from it, so the map is not your draft. */
  unsaved?: boolean;
}

// Accent colours chosen to read on both the light and dark themes, rather than
// tied to the mist palette (which flips between them).
const ACCENT = {
  selected: "#6366f1", // indigo — the node you clicked
  out: "#10b981", // emerald — it can reach these
  in: "#f59e0b", // amber — these can reach it
  both: "#d946ef", // magenta — traffic flows both ways (kept clear of indigo)
  idle: "#94a3b8", // slate — no selection
} as const;

type Role = keyof typeof ACCENT;
type Direction = "all" | "in" | "out";

/**
 * How far a filtered-out thing recedes. Shared by nodes and the lines running
 * to them: a full-strength line into a greyed node reads as a live flow to a
 * machine that is not there.
 */
const DIMMED_OPACITY = 0.2;

/** Stable identity, so passing "no filter" is not a new object every render. */
const EMPTY_SET = new Set<string>();

const COLUMN_GAP = 340;
const ROW_GAP = 72;

/**
 * Fallback only, used for the frame before the real height is measured and for
 * the empty states. A constant cannot be correct in every state: the unsaved
 * banner and the warnings block both change how much room is left, so
 * `useAvailableHeight` measures instead. See there for why.
 */
const MAP_HEIGHT = "calc(var(--height-editor) - 5.5rem)";

const MIN_MAP_HEIGHT = 320;

/**
 * Asymmetric on purpose: the canvas has overlays in two corners, and fitting
 * the graph edge-to-edge parks nodes underneath them. Extra room at the bottom
 * clears the legend (bottom-right) and the zoom controls (bottom-left), with a
 * little more on the left for the controls' width.
 */
const FIT_PADDING = (() => {
  return {
    // Clears the collapsed filter button at top-left. The expanded picker is
    // deliberately NOT reserved for: it is a popover you are interacting with,
    // and reflowing the whole graph every time it opens would be worse than
    // it briefly covering a node.
    top: "64px",
    right: "24px",
    bottom: "96px",
    left: "56px",
  } as const;
})();

/**
 * A two-way pair is drawn as two real edges rather than one line wearing two
 * decorative dash streams: each leg then has its own arrowhead, its own
 * animation direction, and — the point — its own hit area, so the two can be
 * clicked apart. Each steps this far off the centre line, in flow units.
 */
const LANE_SPREAD = 5;

/**
 * React Flow gives every edge an invisible band for clicking, 20 units wide by
 * default. Two lanes 10 units apart would have almost entirely overlapping
 * bands, so a click would land on whichever edge rendered last rather than the
 * one aimed at. Narrowing it to match the separation keeps them distinct.
 */
const LANE_INTERACTION = 10;

/** Layout positions are node centres; see the `nodeOrigin` prop for why. */
const NODE_ORIGIN: [number, number] = [0.5, 0.5];

/**
 * How far the dash streams stop short of each end, so a dash ends where the
 * arrow begins. React Flow's ArrowClosed reaches back 5 viewBox units of a
 * `-10 -10 20 20` box at markerWidth 12.5, scaled again by the stroke width.
 */
function arrowLength(strokeWidth: number): number {
  return 5 * (12.5 / 20) * strokeWidth;
}

/**
 * Size the map so the page fills the viewport exactly and does not scroll.
 *
 * Measured, not computed from the parts: enumerating every contributor (tabs,
 * toolbar, warnings, `<main>`'s 96px margin, the fixed footer) mis-sizes the
 * canvas silently when one is missed. Shrinking the map shrinks the document
 * one-for-one, so adjusting by the measured overflow converges in one pass,
 * and slack reads as a negative overflow so the map grows into it.
 */
function useAvailableHeight(ref: RefObject<HTMLElement | null>, watch: unknown[]): number | null {
  const [height, setHeight] = useState<number | null>(null);

  // Layout effect, not effect: this runs before paint, so the canvas is
  // already its final size when React Flow initialises. Measuring afterwards
  // meant a resize on every arrival, and React Flow keeps its viewport
  // transform across resizes. Safe here — this module is client-only.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => {
      const current = element.getBoundingClientRect().height;
      if (current === 0) return; // not laid out yet; a later pass will catch it

      // The page's real content bottom, in document space. `scrollHeight` is
      // no use here: it never reports less than the viewport height, so a page
      // SHORTER than the viewport looks like a perfect fit and the map could
      // only ever shrink — which is how it ended up small with a large gap
      // beneath it. Deriving the bottom from rects reports slack as a negative
      // overflow, so the map grows into it.
      const container = element.closest("main") ?? document.body;
      const documentTop = document.documentElement.getBoundingClientRect().top;
      const marginBottom = Number.parseFloat(getComputedStyle(container).marginBottom) || 0;
      const contentBottom = container.getBoundingClientRect().bottom - documentTop + marginBottom;

      const overflow = contentBottom - window.innerHeight;
      if (Math.abs(overflow) <= 1) return; // already exact, ignore rounding

      const next = Math.max(MIN_MAP_HEIGHT, Math.round(current - overflow));
      setHeight((previous) => (previous === next ? previous : next));
    };

    // A couple of settling passes: the first runs before paint, the rest after
    // scrollbars, fonts and scroll clamping have resolved. Bounded, so it can
    // never spin.
    let frame = 0;
    const settle = (remaining: number) => {
      measure();
      if (remaining > 0) frame = requestAnimationFrame(() => settle(remaining - 1));
    };

    const onResize = () => settle(1);
    settle(2);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, watch);

  return height;
}

/** URL search params backing the map's selection. Kept in sync with overview.tsx. */
const PARAM = {
  node: "node",
  flow: "flow",
  edge: "edge",
  tab: "tab",
  rule: "rule",
  token: "token",
  only: "only",
  hide: "hide",
  suspend: "qoff",
  animate: "anim",
} as const;

/** The view settings the filter panel owns, all backed by search params. */
type FilterKey = "only" | "hide" | "suspend" | "animate";

// Handle ids. The layout runs left-to-right, so nodes anchor left and right;
// React Flow's default node only has top/bottom, which sends every edge diving
// out of the bottom and looping back across the graph.
const HANDLE = { target: "t", source: "s" } as const;

export function ReachabilityMap({ nodes, policy, unsaved = false }: ReachabilityMapProps) {
  // This has only ever been exercised against one real policy. Anything the
  // evaluator chokes on degrades to an empty map with the reason shown, rather
  // than throwing through render and taking the whole ACL page — including the
  // editor holding unsaved changes — down with it.
  const evaluation = useMemo((): AclEvaluation => {
    try {
      return evaluatePolicy(policy, nodes);
    } catch (error) {
      return {
        edges: [],
        rules: [],
        subnets: [],
        reachOut: new Map(),
        reachIn: new Map(),
        expansions: new Map(),
        warnings: [
          {
            message: `Could not evaluate this policy: ${
              error instanceof Error ? error.message : String(error)
            }. The editor is unaffected — please report the policy shape that caused this.`,
          },
        ],
      };
    }
  }, [policy, nodes]);
  // Overview-only, and deliberately not in the URL: hovering is transient and
  // must not create history entries.
  const [hovered, setHovered] = useState<string | null>(null);
  // Which flow the cursor is over, so you can see what a click would select.
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  // Lifted out of FilterPanel so that clicking the canvas can close it.
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const flowRef = useRef<ReactFlowInstance<Node, Edge> | null>(null);
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const colorMode = useColorMode();
  // Re-measured when the chrome above the map changes size: the unsaved banner
  // and the warnings block are the two things that move it.
  const mapHeight = useAvailableHeight(layoutRef, [unsaved, evaluation.warnings.length]);

  // Selection lives in the URL rather than component state, so the browser's
  // own history gives back/forward for free. See `shouldRevalidate` in
  // overview.tsx — these params must not trigger a loader refetch.
  const knownIds = useMemo(() => {
    const ids = new Set<string>(nodes.map((n) => n.id));
    ids.add(INTERNET);
    for (const subnet of evaluation.subnets) ids.add(subnet.id);
    return ids;
  }, [nodes, evaluation]);

  // A stale or hand-edited id (a machine since deleted, say) falls back to the
  // overview instead of focusing on a node that is not there.
  const nodeParam = searchParams.get(PARAM.node);
  const selectedNode = nodeParam !== null && knownIds.has(nodeParam) ? nodeParam : null;
  // The filter is sticky across history moves. An entry created before the
  // filter was chosen carries no `flow` param, so reading the URL alone would
  // silently reset to "all" on Back. The URL still wins when it has a value,
  // which keeps a shared link honest.
  const [lastFlow, setLastFlow] = useState<Direction>("all");
  const flowParam = searchParams.get(PARAM.flow);
  const direction: Direction = flowParam === "in" || flowParam === "out" ? flowParam : lastFlow;

  const focusOn = (node: string | null, flow: Direction, alsoClearFilter = false) => {
    // Every change of focus is its own history entry, so Back and Forward walk
    // the trail of nodes you inspected. Switching the direction filter is a
    // change of view rather than of subject, so it replaces instead — it would
    // otherwise double the entries for no navigational gain.
    const nodeChanged = (searchParams.get(PARAM.node) ?? null) !== node;

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (node === null) next.delete(PARAM.node);
        else next.set(PARAM.node, node);
        if (flow === "all") next.delete(PARAM.flow);
        else next.set(PARAM.flow, flow);
        if (alsoClearFilter) {
          next.delete(PARAM.only);
          next.delete(PARAM.suspend);
          next.delete(PARAM.hide);
        }
        // Changing the node or the filter invalidates any selected flow: it
        // may not even be drawn in the new view.
        next.delete(PARAM.edge);
        return next;
      },
      // preventScrollReset stops the page jumping to the top on every click.
      { preventScrollReset: true, replace: !nodeChanged },
    );
  };

  // Opening a rule in the editor PUSHES, unlike the map's own state changes:
  // it is a different view, and Back should land back on the map exactly as it
  // was. The map params ride along untouched so that entry restores them.
  const jumpToRule = (ruleIndex: number, token?: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set(PARAM.tab, "edit");
        next.set(PARAM.rule, String(ruleIndex));
        if (token) next.set(PARAM.token, token);
        else next.delete(PARAM.token);
        return next;
      },
      { preventScrollReset: true },
    );
  };

  const labels = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of nodes) map.set(node.id, node.name);
    map.set(INTERNET, "Internet");
    for (const subnet of evaluation.subnets) map.set(subnet.id, subnet.cidr);
    return map;
  }, [nodes, evaluation]);

  const edgesById = useMemo(() => {
    const map = new Map<string, AclEdge>();
    for (const edge of evaluation.edges) map.set(edgeId(edge), edge);
    return map;
  }, [evaluation]);

  // --- Node filter --------------------------------------------------------
  // An explicit set of chosen nodes, not a live text match: the search box in
  // the picker narrows the list only, so a node stays chosen after the term is
  // cleared. Empty means no filter, which is also what "select all" means.
  const onlyParam = searchParams.get(PARAM.only) ?? "";
  const suspended = searchParams.get(PARAM.suspend) === "1";
  const hideOthers = searchParams.get(PARAM.hide) === "1";
  // Off by default: motion draws the eye, so the idle graph stays still and
  // only what you point at or pick moves. Ticking this runs every line at once,
  // for reading the tailnet's traffic as a whole rather than one flow at a time.
  const animateAll = searchParams.get(PARAM.animate) === "1";

  const chosen = useMemo(
    () => new Set(onlyParam.split(",").filter((id) => id.length > 0)),
    [onlyParam],
  );

  const filterActive = !suspended && chosen.size > 0;

  /**
   * What reads as "in scope", or null when nothing is filtered. The map
   * changes mode at two, and so does the rules panel beside it:
   *
   * - **one chosen** — that machine and everyone it talks to ("its world").
   * - **two or more** — exactly the chosen; their other peers become
   *   background, since the question is now what passes between them.
   */
  const litSet = useMemo(() => {
    if (!filterActive) return null;
    if (chosen.size > 1) return new Set(chosen);
    const ids = new Set(chosen);
    for (const id of chosen) {
      for (const peer of evaluation.reachOut.get(id) ?? []) ids.add(peer);
      for (const peer of evaluation.reachIn.get(id) ?? []) ids.add(peer);
    }
    return ids;
  }, [filterActive, chosen, evaluation]);

  // The node under inspection is always exempt: greying the subject of the view
  // because it was left out of a later selection would be disorienting.
  const isMatch = (id: string) =>
    litSet === null || litSet.has(id) || (selectedNode !== null && id === selectedNode);

  /** Everything the picker can offer, machines first, then the pseudo-nodes. */
  const roster = useMemo(() => {
    const machines: FilterItem[] = nodes.map((node) => ({
      id: node.id,
      label: node.name,
      detail: [node.user, ...node.tags].filter(Boolean).join(" · "),
      haystack: [node.name, node.user ?? "", ...node.tags, ...node.ips].join(" ").toLowerCase(),
    }));

    const extras: FilterItem[] = [];
    if (evaluation.edges.some((edge) => edge.dst === INTERNET)) {
      extras.push({ id: INTERNET, label: "Internet", detail: "", haystack: "internet" });
    }
    for (const subnet of evaluation.subnets) {
      extras.push({
        id: subnet.id,
        label: subnet.cidr,
        detail: "subnet",
        haystack: (subnet.cidr + " subnet").toLowerCase(),
      });
    }

    return { machines, extras };
  }, [nodes, evaluation]);

  const setFilter = (updates: Partial<Record<FilterKey, string | null>>) => {
    // Changing what the map shows drops any selected flow, as changing the
    // node or direction already does: a selection narrows every view to its
    // two ends, greying out the change just asked for. "Animate all flows" is
    // excluded — it draws the same map, differently.
    const changesWhatIsShown = Object.keys(updates).some((key) => key !== "animate");

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(updates)) {
          const param = PARAM[key as FilterKey];
          if (value === null || value === "") next.delete(param);
          else next.set(param, value);
        }
        if (changesWhatIsShown) next.delete(PARAM.edge);
        return next;
      },
      // A view setting, not a step worth retracing.
      { preventScrollReset: true, replace: true },
    );
  };

  const toggleChosen = (id: string) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFilter({ only: [...next].join(",") });
  };

  const toggleMany = (ids: string[], selected: boolean) => {
    const next = new Set(chosen);
    for (const id of ids) {
      if (selected) next.add(id);
      else next.delete(id);
    }
    setFilter({ only: [...next].join(",") });
  };

  // One navigation, not two: consecutive setSearchParams calls both build from
  // the same `prev` and the second would drop the first. Memoised because it
  // rides in node data, which the graph memo depends on.
  const inspect = useCallback(
    (id: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const ids = new Set(chosen);
          ids.add(id);
          next.set(PARAM.only, [...ids].join(","));
          next.set(PARAM.node, id);
          // The flow you had open belongs to the view you are leaving.
          next.delete(PARAM.edge);
          return next;
        },
        // A change of subject, so it joins the trail Back walks.
        { preventScrollReset: true },
      );
    },
    [chosen, setSearchParams],
  );

  // --- Selected flow ------------------------------------------------------
  // Read after the filter, since whether a selection still stands depends on
  // it. Kept in the URL because opening a rule unmounts this panel, so local
  // state would not survive coming Back; an id that no longer resolves falls
  // back to no selection.
  const edgeParam = searchParams.get(PARAM.edge);
  const resolvedEdge = edgeParam === null ? null : (edgesById.get(edgeParam) ?? null);

  /**
   * A flow with an end the filter has hidden or greyed is not a selection: it
   * would narrow every view to its two ends on behalf of a line that is not
   * even drawn, dimming the whole map. Reachable by selecting a flow while
   * suspended and then resuming.
   */
  const selectionHidden =
    resolvedEdge !== null && (!isMatch(resolvedEdge.src) || !isMatch(resolvedEdge.dst));
  const selectedEdge = selectionHidden ? null : resolvedEdge;

  // Each direction is its own line now, so a click selects that leg alone and
  // the panel describes exactly it. The return leg is one lane over, and one
  // click away.
  const selectedFlows = useMemo(() => {
    if (selectedEdge === null) return [];
    // The overview draws each leg as its own line, so a click there means
    // exactly the leg clicked. The focused view collapses a two-way pair into
    // ONE line, so clicking it has to mean both — otherwise half the rules go
    // missing. Under a direction filter only one leg is drawn either way.
    if (selectedNode === null || direction !== "all") return [selectedEdge];
    const reverse = edgesById.get(`${selectedEdge.dst}->${selectedEdge.src}`);
    return reverse ? [selectedEdge, reverse] : [selectedEdge];
  }, [selectedEdge, edgesById, selectedNode, direction]);

  const selectedId = selectedEdge === null ? null : edgeId(selectedEdge);

  const selectEdge = (id: string | null) => {
    // Picking a flow is a selection too, so it joins the trail: Back closes
    // the flow and leaves you on the node you were inspecting.
    const changed = (searchParams.get(PARAM.edge) ?? null) !== id;

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id === null) next.delete(PARAM.edge);
        else next.set(PARAM.edge, id);
        return next;
      },
      { preventScrollReset: true, replace: !changed },
    );
  };

  // Drop it from the URL as well, so suspending the filter later does not
  // resurrect a selection the user has long since moved on from. REPLACE, not
  // push: this is the app correcting its own state rather than the user
  // navigating, and Back must not step into the broken view again.
  useEffect(() => {
    if (!selectionHidden) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(PARAM.edge);
        return next;
      },
      { preventScrollReset: true, replace: true },
    );
  }, [selectionHidden, setSearchParams]);

  const graph = useMemo(() => {
    // Hovering a greyed line previews what clicking it would bring in: its two
    // machines lift out of the grey. Without that the click is a leap — the
    // line runs off to somewhere you cannot see.
    const hoveredFlow = hoveredEdge === null ? null : (edgesById.get(hoveredEdge) ?? null);
    const previewIds =
      hoveredFlow !== null && (!isMatch(hoveredFlow.src) || !isMatch(hoveredFlow.dst))
        ? new Set([hoveredFlow.src, hoveredFlow.dst])
        : null;

    const usesInternet = evaluation.edges.some((e) => e.dst === INTERNET);
    const allIds = [
      ...nodes.map((n) => n.id),
      ...(usesInternet ? [INTERNET] : []),
      ...evaluation.subnets.map((s) => s.id),
    ];

    // --- Overview: everything on a ring ---------------------------------
    if (selectedNode === null) {
      const radius = Math.max(220, allIds.length * 30);
      // With nothing selected, the hovered node is the reference point that
      // the direction filter measures from.
      const hoverOut = hovered === null ? [] : (evaluation.reachOut.get(hovered) ?? []);
      const hoverIn = hovered === null ? [] : (evaluation.reachIn.get(hovered) ?? []);
      const neighbours =
        hovered === null
          ? null
          : new Set(
              direction === "out"
                ? hoverOut
                : direction === "in"
                  ? hoverIn
                  : [...hoverOut, ...hoverIn],
            );

      // A clicked flow stays emphasised here too, not just under the cursor,
      // and its two ends read as the conversation the panel is describing.
      const selectedEnds =
        selectedEdge === null ? null : new Set([selectedEdge.src, selectedEdge.dst]);

      // Under a direction filter, only nodes that actually participate in that
      // direction stay connected. Internet is never a source, so it keeps no
      // lines at all in the outbound view. BOTH endpoints must participate,
      // otherwise a line would reappear through its other end.
      const participating = new Set(
        direction === "all"
          ? allIds
          : allIds.filter((id) =>
              direction === "out"
                ? (evaluation.reachOut.get(id)?.length ?? 0) > 0
                : (evaluation.reachIn.get(id)?.length ?? 0) > 0,
            ),
      );

      // Every leg is its own edge, offset onto its own lane, so a two-way pair
      // carries two arrowheads and can be clicked apart rather than stacking
      // invisibly. Hiding drops nodes from the ring so the rest re-pack.
      const ringIds = hideOthers ? allIds.filter(isMatch) : allIds;
      const onRing = new Set(ringIds);
      // What hiding would remove from THIS view, counted before it is applied
      // so the control still reports a number while active and can be undone.
      // Zero below two chosen, where hiding would strand a lone box.
      const hideableCount = chosen.size < 2 ? 0 : allIds.length - allIds.filter(isMatch).length;

      /**
       * Which legs belong in this view. With machines chosen, direction is
       * measured FROM them; without one there is no reference point, so it
       * falls back to participation — which is what keeps Internet, never a
       * source, out of the outbound view. At least one end must be chosen
       * either way: a line between two peers is somebody else's conversation.
       */
      const inThisView = (edge: AclEdge) => {
        if (!filterActive) {
          return (
            direction === "all" || (participating.has(edge.src) && participating.has(edge.dst))
          );
        }
        if (direction === "out") return chosen.has(edge.src);
        if (direction === "in") return chosen.has(edge.dst);
        return chosen.has(edge.src) || chosen.has(edge.dst);
      };

      const drawn = evaluation.edges.filter(
        (edge) => onRing.has(edge.src) && onRing.has(edge.dst) && inThisView(edge),
      );

      /**
       * A node belongs here when it has a line drawn — greyed has to mean "no
       * traffic in this view". Participation is the wrong test: an agent that
       * only initiates has no inbound flows of its own yet its leg into a
       * chosen machine is the point, and an outbound-only peer participates
       * inbound elsewhere while nothing is drawn for it here.
       */
      const connected = new Set<string>();
      for (const edge of drawn) {
        connected.add(edge.src);
        connected.add(edge.dst);
      }

      const inView = (id: string) =>
        isMatch(id) &&
        (connected.has(id) ||
          // A machine picked by hand stays lit even when this direction leaves
          // it without lines: it is the subject of the view, not a bystander.
          chosen.has(id) ||
          // Nothing filtered and no direction to measure against, so there is
          // nothing to be outside of — an isolated machine still belongs.
          (!filterActive && direction === "all"));

      const legsPerPair = new Map<string, number>();
      for (const edge of drawn) {
        const key = pairKey(edge.src, edge.dst);
        legsPerPair.set(key, (legsPerPair.get(key) ?? 0) + 1);
      }

      /**
       * Hover lifts what it touches out of the grey — `!inView` is part of the
       * dim, so without this the pointer does nothing at all on a node outside
       * the filter. Far ends come from the lines actually DRAWN: lifting a
       * machine with no visible connection would claim a relationship the map
       * is not showing.
       */
      // The machine a line's direction is measured against, so it can wear the
      // legend's colours. One pick, or — with no filter at all — whatever is
      // under the cursor, so hovering reads the same way as picking. `null`
      // past one pick, where a line can be outbound for one and inbound for
      // another and no single colour is honest.
      const colourRef = filterActive ? (chosen.size === 1 ? [...chosen][0] : null) : hovered;
      const drawnKeys = new Set(drawn.map((edge) => `${edge.src}->${edge.dst}`));

      const hoverEnds = new Set<string>();
      if (hovered !== null) {
        hoverEnds.add(hovered);
        for (const edge of drawn) {
          if (edge.src === hovered) hoverEnds.add(edge.dst);
          else if (edge.dst === hovered) hoverEnds.add(edge.src);
        }
      }

      return {
        hiddenCount: 0,
        // The ring is laid out from its membership and nothing else, so this is
        // the whole of what can move a node here. Notably absent: the direction
        // filter, which restyles lines without touching a single position.
        layoutId: `ring:${ringIds.join(",")}`,
        drawnIds: new Set(drawn.map(edgeId)),
        hideableCount,
        rfEdges: drawn.map((edge): Edge => {
          // Dimmed rather than hidden: still drawn, but unreachable until the
          // filter is cleared or suspended.
          const muted = !isMatch(edge.src) || !isMatch(edge.dst);
          const selected = selectedId === edgeId(edge);
          const underCursor = hoveredEdge === edgeId(edge);
          // A leg is lit when the hovered node is at the end the filter cares
          // about — its source under Outbound, its target under Inbound.
          const underHoveredNode =
            hovered !== null &&
            (direction === "out"
              ? edge.src === hovered
              : direction === "in"
                ? edge.dst === hovered
                : edge.src === hovered || edge.dst === hovered);

          // A picked machine's traffic stays lit, not just while the cursor is
          // on it. Which lines those are falls out of `muted` for free, and so
          // follows the same one-versus-many rule as the panel.
          const lit = underHoveredNode || (filterActive && !muted);

          // Only lines that touch the reference machine have a direction
          // relative to it; with nothing filtered the whole ring is drawn, so
          // most of it does not.
          // `lit` as well, or under a direction filter a line the view is not
          // emphasising would still take a colour and read as a faint stray.
          const touchesRef =
            lit && colourRef !== null && (edge.src === colourRef || edge.dst === colourRef);
          const roleColour =
            !touchesRef || muted || selected
              ? undefined
              : drawnKeys.has(`${edge.dst}->${edge.src}`)
                ? ACCENT.both
                : edge.src === colourRef
                  ? ACCENT.out
                  : ACCENT.in;

          return overviewEdge(edge, {
            alwaysAnimate: animateAll,
            // Always: each line is one directed leg, so a line without a
            // head would be ambiguous. Showing them only on emphasis made
            // sense when a line was a collapsed undirected pair.
            arrowEnd: true,
            colour: roleColour,
            // Greyed lines answer the cursor too: hovering a greyed node has
            // to show which lines it would bring in, or the highlight stops
            // exactly where the interesting part starts.
            hovered: underCursor,
            idle: hovered === null,
            lit,
            muted,
            lane: (legsPerPair.get(pairKey(edge.src, edge.dst)) ?? 1) > 1 ? LANE_SPREAD : 0,
            otherHovered: hoveredEdge !== null && !underCursor,
            selected,
            someSelected: selectedId !== null,
          });
        }),
        rfNodes: ringIds.map((id, i) => {
          // -90° so the first node sits at the top of the circle.
          const angle = (i / ringIds.length) * 2 * Math.PI - Math.PI / 2;
          const related = hovered === null || id === hovered || (neighbours?.has(id) ?? false);
          const onSelectedFlow = selectedEnds?.has(id) ?? false;
          const preview = (previewIds?.has(id) ?? false) || hoverEnds.has(id);
          return buildNode(
            id,
            labels,
            // A chosen machine keeps the accent for as long as it is chosen.
            // Its peers stay neutral: they are in scope, not picked.
            chosen.has(id) || id === hovered || onSelectedFlow || preview ? "selected" : "idle",
            { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius },
            {
              // A selected flow narrows the view to its two ends, the same way
              // it does in the focused view. A previewed end always wins.
              dim:
                !preview && (!related || !inView(id) || (selectedEnds !== null && !onSelectedFlow)),
              onInspect: inspect,
              selectable: !suspended,
            },
          );
        }),
      };
    }

    // --- Focus: only the selection and its direct peers, in lanes -------
    const reachOut = new Set(evaluation.reachOut.get(selectedNode) ?? []);
    const reachIn = new Set(evaluation.reachIn.get(selectedNode) ?? []);

    // In a filtered view each lane owns its bidirectional peers outright; in
    // the combined view they sit on the right so an all-to-all policy does not
    // pile every node into a single column.
    const inLane = (ids: string[]) => (hideOthers ? ids.filter(isMatch) : ids);
    const rawRight = direction === "in" ? [] : [...reachOut];
    const rawLeft =
      direction === "out"
        ? []
        : direction === "in"
          ? [...reachIn]
          : [...reachIn].filter((id) => !reachOut.has(id));
    const rightLane = inLane(rawRight);
    const leftLane = inLane(rawLeft);

    // Counted from the unfiltered lanes, so it is what hiding WOULD remove.
    // Zero below two chosen machines, where the lanes are all lit by
    // definition — inspecting puts its subject in the filter, and at one
    // machine everyone it talks to is lit alongside it.
    const hideableCount =
      chosen.size < 2 ? 0 : [...rawRight, ...rawLeft].filter((id) => !isMatch(id)).length;

    // Under a filter the view is one-way, so a peer takes that direction's
    // colour even if it also talks back — matching the single arrow drawn.
    const roleOf = (id: string): Role => {
      if (direction === "out") return "out";
      if (direction === "in") return "in";
      return reachOut.has(id) && reachIn.has(id) ? "both" : reachOut.has(id) ? "out" : "in";
    };

    // Picking a flow narrows the view to that one conversation, the same way
    // hovering does on the overview: its two ends stay lit and everything else
    // recedes.
    const litEnds = selectedEdge === null ? null : new Set([selectedEdge.src, selectedEdge.dst]);
    const dimmed = (id: string): boolean => litEnds !== null && !litEnds.has(id);

    const laneNodes = (ids: string[], x: number): Node[] =>
      ids.map((id, i) => {
        const preview = previewIds?.has(id) ?? false;
        return buildNode(
          id,
          labels,
          roleOf(id),
          {
            x,
            // Centre each lane vertically on the selected node.
            y: (i - (ids.length - 1) / 2) * ROW_GAP,
          },
          {
            dim: !preview && (dimmed(id) || !isMatch(id)),
            onInspect: inspect,
            selectable: !suspended,
          },
        );
      });

    const visible = new Set([selectedNode, ...rightLane, ...leftLane]);
    const focusEdges = evaluation.edges.filter((e) => {
      if (e.src === selectedNode) return visible.has(e.dst) && direction !== "in";
      if (e.dst === selectedNode) return visible.has(e.src) && direction !== "out";
      return false;
    });

    // Fold the legs of each conversation together. The focused layout is fixed
    // columns with source-on-right, target-on-left anchors, so a return leg
    // drawn as its own edge would leave the peer's right face and wrap all the
    // way back. One line with a head at each end avoids that; the overview,
    // which picks nearest border points, uses real per-leg lanes instead.
    const focusPairs = new Map<string, { edge: AclEdge; outbound: boolean; inbound: boolean }>();
    for (const edge of focusEdges) {
      const key = pairKey(edge.src, edge.dst);
      const outbound = edge.src === selectedNode;
      const existing = focusPairs.get(key);
      if (!existing) {
        focusPairs.set(key, { edge, outbound, inbound: !outbound });
        continue;
      }
      // Prefer the outbound leg as the one drawn, so the line runs into a
      // right-lane peer rather than back out of it.
      if (outbound) {
        existing.edge = edge;
        existing.outbound = true;
      } else {
        existing.inbound = true;
      }
    }

    return {
      hiddenCount: allIds.length - visible.size,
      // Here the direction filter DOES rearrange things — it empties a lane —
      // so the lane contents carry it rather than the filter being named.
      layoutId: `focus:${selectedNode}|${leftLane.join(",")}|${rightLane.join(",")}`,
      // Every leg this view accounts for, not just the one line drawn per
      // conversation: a two-way pair collapses onto its outbound leg, but the
      // return leg is still represented by that line and selecting it is valid.
      drawnIds: new Set(focusEdges.map(edgeId)),
      hideableCount,
      rfNodes: [
        buildNode(
          selectedNode,
          labels,
          "selected",
          { x: 0, y: 0 },
          {
            dim: dimmed(selectedNode),
            interactive: false,
          },
        ),
        ...laneNodes(leftLane, -COLUMN_GAP),
        ...laneNodes(rightLane, COLUMN_GAP),
      ],
      rfEdges: [...focusPairs.values()].map(({ edge, outbound, inbound }) => {
        const both = outbound && inbound;
        const isSelected = selectedId === edgeId(edge);
        const isHovered = hoveredEdge === edgeId(edge);
        // The peer at the far end is filtered out, so this line recedes to
        // match it. Only reachable without "hide all others": that drops the
        // node from the lane and takes its line with it.
        const isMuted = !isMatch(edge.src) || !isMatch(edge.dst);

        return buildEdge(edge, {
          muted: isMuted,
          colour: isSelected
            ? ACCENT.selected
            : both
              ? ACCENT.both
              : outbound
                ? ACCENT.out
                : ACCENT.in,
          // Same switch as the overview: the panel is on screen in this view
          // too, so a tick that did nothing here would read as broken.
          animated: animateAll || isSelected || isHovered,
          // Unselected flows fade well back once one is picked, so the chosen
          // conversation reads on its own. Hovering lifts a flow back out of
          // that fade — including out of a selection's shadow — and pushes the
          // rest down, so the line under the cursor is unambiguous.
          opacity: isSelected
            ? 1
            : isHovered
              ? 0.95
              : litEnds !== null
                ? 0.08
                : hoveredEdge !== null
                  ? 0.12
                  : 0.75,
          strokeWidth: isSelected ? 3 : isHovered ? 2.5 : 1.5,
          arrowEnd: true,
          arrowStart: both,
          dual: both,
        });
      }),
    };
  }, [
    nodes,
    evaluation,
    labels,
    selectedNode,
    selectedEdge,
    direction,
    hovered,
    hoveredEdge,
    // Without these the map read the filter but never recomputed when it
    // changed: the panel and the URL updated, and nothing moved. `chosen` is
    // reachable through `litSet` today, but only while the filter is active —
    // listing it directly keeps that from mattering.
    litSet,
    filterActive,
    // Reachable through `filterActive` for every state that can actually be
    // toggled, but listed anyway: the last time this memo read something the
    // deps only implied, the panel and the URL updated and the map did not.
    suspended,
    chosen,
    hideOthers,
    animateAll,
    edgesById,
    inspect,
  ]);

  const { hiddenCount, layoutId, drawnIds, hideableCount } = graph;

  /**
   * Adds a node to the filter, or takes it out if already in. Membership only
   * — never what merely looks lit, since at one chosen machine its peers are
   * lit too and treating a click on one as "remove" inverts the gesture.
   */
  const clickNode = (id: string) => {
    // Clicking what you are already inspecting does nothing; the background
    // click and Escape are how you leave.
    if (id === selectedNode) return;
    // Suspending freezes the selection. The map ignores the filter entirely in
    // that state, so a click rewrote the URL while nothing on screen moved —
    // no greying to gain or lose, no lines to change. The picker's checkboxes
    // stay live because ticking one is its own feedback; a node click has none.
    if (suspended) return;
    toggleChosen(id);
  };

  // The other half of the same rule: a selection can survive into a view that
  // does not draw it at all, with both ends still passing the filter, so
  // `isMatch` cannot see it. Post-render, because only the memo knows what it
  // drew — testing against its own output during would be circular.
  useEffect(() => {
    if (selectedId === null || drawnIds.has(selectedId)) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(PARAM.edge);
        return next;
      },
      { preventScrollReset: true, replace: true },
    );
  }, [selectedId, drawnIds, setSearchParams]);
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // React Flow writes measured sizes back through onNodesChange, and the
  // floating edges depend on them — handing it a wholesale-new array (as every
  // hover does) discards them and the edges collapse to node centres. Reusing
  // the previous object per id keeps the measurement while style and position
  // update. The key comes from the arrangement the graph produced, not from
  // the inputs that feed it, or a direction change counts as a re-layout.
  const previousLayout = useRef(layoutId);

  useEffect(() => {
    // Only re-position when the layout itself changed (ring ↔ lanes, or a
    // different focus). Otherwise keep where each node currently sits, so a
    // hover — or a node the user dragged to untangle things — does not snap
    // everything back to the generated position.
    const sameLayout = previousLayout.current === layoutId;
    previousLayout.current = layoutId;

    setRfNodes((previous) => {
      const byId = new Map(previous.map((node) => [node.id, node]));
      return graph.rfNodes.map((node) => {
        const existing = byId.get(node.id);
        if (!existing) return node;
        return {
          ...existing,
          ...node,
          measured: existing.measured,
          position: sameLayout ? existing.position : node.position,
        };
      });
    });
    setRfEdges(graph.rfEdges);
  }, [graph, layoutId, setRfNodes, setRfEdges]);

  // Re-frame when the arrangement changes — not when the settings feeding it
  // do, or switching inbound to outbound re-centres a ring that never moved
  // and throws away the user's pan and zoom. `mapHeight` belongs here too:
  // React Flow keeps its viewport transform across a resize, so the canvas
  // being measured after mount would otherwise leave the graph framed for the
  // pre-measurement height.
  useEffect(() => {
    const frame = requestAnimationFrame(() => flowRef.current?.fitView({ padding: FIT_PADDING }));
    return () => cancelAnimationFrame(frame);
  }, [layoutId, mapHeight]);

  /**
   * Back out one level at a time: an open flow first, then the focused node.
   * Shared by Escape and by clicking empty space so the two cannot drift —
   * closing a flow should never cost you the node you were inspecting.
   */
  const stepBack = () => {
    setHovered(null);
    setHoveredEdge(null);
    // Dismiss the picker first and stop there. Clicking away from an open
    // panel is a "close this" gesture, and it should not also cost you the
    // selection you were looking at — a second click does that.
    if (filterOpen) {
      setFilterOpen(false);
      return;
    }
    if (selectedEdge !== null) {
      selectEdge(null);
      return;
    }
    if (selectedNode !== null) {
      // Inspecting is one gesture that sets two things — the focus and the
      // filter membership — so undoing it has to unwind both, or leaving the
      // focused view takes a second Escape to finish what one action started.
      // Only when that machine is all the filter holds: picks made before you
      // inspected are yours, and predate this gesture.
      const inspectPutItThere = chosen.size === 1 && chosen.has(selectedNode);
      focusOn(null, direction, inspectPutItThere);
      return;
    }
    // Last level: the filter itself. Leaving the overview with machines still
    // picked and no way to drop them but the toolbar made the background click
    // feel broken, since every other level answers it.
    if (chosen.size > 0) setFilter({ only: null, suspend: null, hide: null });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") stepBack();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  if (nodes.length === 0) {
    return (
      <Empty>
        No machines to map. The map needs machine data — check that you have permission to view
        machines and that Headscale is reachable.
      </Empty>
    );
  }

  if (policy.trim().length === 0) {
    return <Empty>The policy is empty, so nothing is reachable yet.</Empty>;
  }

  return (
    <div className="flex flex-col gap-3">
      {/*
        Said plainly, because a map that silently showed neither the saved
        policy nor the draft would be worse than either.
      */}
      {unsaved ? (
        <p className="rounded-md border border-yellow-500/40 bg-yellow-500/5 px-3 py-2 text-xs">
          You have unsaved changes. This map shows the <strong>saved</strong> policy — what
          Headscale is enforcing now. Save to see your edits reflected here.
        </p>
      ) : undefined}

      <div className="flex items-center gap-1">
        {(["all", "in", "out"] as const).map((value) => {
          // "in" and "out" are ACCENT keys, so an active direction wears the
          // same colour the legend gives its flows. "All flows" has no legend
          // entry of its own — it is the absence of a direction, not a third
          // one — so it keeps the neutral active styling.
          const accent = value === "all" ? undefined : ACCENT[value];
          const active = direction === value;

          return (
            <button
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs transition-colors",
                active
                  ? cn(
                      "font-medium",
                      accent
                        ? undefined
                        : "border-mist-400 bg-mist-100 dark:border-mist-600 dark:bg-mist-800",
                    )
                  : "border-transparent text-mist-500 hover:bg-mist-100 dark:hover:bg-mist-900",
              )}
              key={value}
              onClick={() => {
                setLastFlow(value);
                focusOn(selectedNode, value);
              }}
              style={
                active && accent
                  ? { borderColor: accent, color: accent, background: `${accent}1a` }
                  : undefined
              }
              type="button"
            >
              {value === "all" ? "All flows" : value === "in" ? "Inbound" : "Outbound"}
            </button>
          );
        })}
        <span className="ml-2 text-xs text-mist-500">
          {selectedNode === null
            ? direction === "all"
              ? "Hover a node to highlight its flows, or click to focus on it"
              : `Hover a node to highlight its ${direction === "in" ? "inbound" : "outbound"} flows, or click to focus on it`
            : `Hiding ${hiddenCount} unrelated node${hiddenCount === 1 ? "" : "s"} — click the background to show all`}
        </span>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row" ref={layoutRef}>
        <div
          className="flex-1 overflow-hidden rounded-md border border-mist-200 dark:border-mist-800"
          style={{ height: mapHeight ?? MAP_HEIGHT }}
        >
          <ReactFlow
            colorMode={colorMode}
            edges={rfEdges}
            edgeTypes={edgeTypes}
            fitView
            // The initial fit must reserve the same corners as the refits.
            fitViewOptions={{ padding: FIT_PADDING }}
            nodes={rfNodes}
            nodesConnectable={false}
            // Positions address node CENTRES, not top-left corners. Otherwise
            // two boxes of different widths sit on the same layout point with
            // their centres offset, and the line joining those centres tilts —
            // most visible with two nodes on the ring, where a line that ought
            // to be dead straight leans by half the width difference.
            nodeOrigin={NODE_ORIGIN}
            nodeTypes={nodeTypes}
            onEdgesChange={onEdgesChange}
            onInit={(instance) => {
              flowRef.current = instance;
            }}
            onNodesChange={onNodesChange}
            // Greyed nodes and lines are live now: grey means "outside the
            // filter", and clicking is how you bring something into it, so
            // refusing the hover would hide the only affordance saying so.
            onNodeMouseEnter={(_, node) => {
              if (selectedNode === null) setHovered(node.id);
            }}
            onNodeMouseLeave={() => {
              if (selectedNode === null) setHovered(null);
            }}
            onEdgeClick={(_, edge) => {
              const flow = edgesById.get(edge.id);
              if (!flow) {
                selectEdge(null);
                return;
              }
              // A greyed line's rules would describe a flow that is out of
              // scope, so the click brings its two machines in instead. Same
              // gesture, and the hover preview says which two.
              if (!isMatch(flow.src) || !isMatch(flow.dst)) {
                toggleMany([flow.src, flow.dst], true);
                return;
              }
              selectEdge(edge.id);
            }}
            onEdgeMouseEnter={(_, edge) => setHoveredEdge(edge.id)}
            onEdgeMouseLeave={() => setHoveredEdge(null)}
            onNodeClick={(_, node) => {
              setHovered(null);
              clickNode(node.id);
            }}
            // Steps back one level rather than jumping straight to the
            // overview. stepBack also clears the hover: if a re-render swallows
            // the mouseleave the highlight sticks, and clicking away then looks
            // like it did nothing.
            onPaneClick={stepBack}
          >
            <Background />
            <Controls showInteractive={false} />
            {/*
              Transparent to the pointer, with each control opting back in. The
              row is as tall as the open picker and as wide as picker plus
              icons, so its empty corner sat over the canvas swallowing clicks —
              a dead rectangle you could neither click through nor pan from.
              React Flow's own panel CSS sets no pointer-events, so the box is
              hit-testable whether or not anything is painted there.
            */}
            <Panel className="pointer-events-none" position="top-left">
              <div className="flex items-start gap-1.5">
                <FilterPanel
                  animateAll={animateAll}
                  chosen={chosen}
                  extras={roster.extras}
                  machines={roster.machines}
                  onChange={setFilter}
                  onOpenChange={setFilterOpen}
                  onToggle={toggleChosen}
                  onToggleMany={toggleMany}
                  open={filterOpen}
                  suspended={suspended}
                />
                {/*
                  Both act on the filter as a whole, so they sit beside the
                  picker rather than inside it — reachable without opening a
                  panel that covers the map you are deciding about.
                */}
                <IconButton
                  active={filterActive}
                  disabled={chosen.size === 0}
                  label={
                    chosen.size === 0
                      ? "Nothing is filtered yet"
                      : suspended
                        ? "Resume the filter"
                        : "Suspend the filter, keeping the selection"
                  }
                  onClick={() => setFilter({ suspend: suspended ? null : "1" })}
                >
                  {suspended ? (
                    <ToggleLeft className="size-3.5" />
                  ) : (
                    <ToggleRight className="size-3.5" />
                  )}
                </IconButton>
                {/*
                  An open eye means you are seeing everything, so pressing it
                  closes things down; a closed one means machines are being
                  held back. Only useful past two picks — with one, the lit set
                  is that machine and everyone it talks to, and hiding would
                  strand a single box with no lines.
                */}
                <IconButton
                  active={!hideOthers && hideableCount > 0}
                  disabled={hideableCount === 0 && !hideOthers}
                  label={
                    chosen.size < 2
                      ? "Select two or more machines to hide the others"
                      : suspended
                        ? "Resume the filter to hide the others"
                        : hideOthers
                          ? "Show every machine again"
                          : `Hide the ${hideableCount} machine${hideableCount === 1 ? "" : "s"} outside the filter`
                  }
                  onClick={() => setFilter({ hide: hideOthers ? null : "1" })}
                >
                  {hideOthers ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </IconButton>
                <IconButton
                  disabled={chosen.size === 0}
                  label={
                    chosen.size === 0 ? "Nothing is filtered yet" : "Clear the filter and show all"
                  }
                  onClick={() => setFilter({ only: null, suspend: null, hide: null })}
                >
                  <FunnelX className="size-3.5" />
                </IconButton>
              </div>
            </Panel>
            {/*
              Inside the canvas rather than under it. The map is sized from the
              viewport (calc(100vh - 20rem)), so a legend placed below it grows
              out of reach as the window grows — zooming out never brings it
              back. Bottom-right keeps it clear of the Controls.
            */}
            <Panel position="bottom-right">
              {/*
                A grid, not wrapped flex: five items of unequal width wrapped
                into a right-aligned box left the short row padded away from
                the left edge. Three auto columns give two rows that line up
                and a box that is exactly as wide as its contents.
                The bottom margin clears React Flow's own attribution, which
                sits in this same corner and was otherwise tucked under it.
              */}
              <div
                className={cn(
                  "mb-2.5 grid grid-cols-[auto_auto_auto] items-center gap-x-3 gap-y-1",
                  "rounded-md border border-mist-200 bg-mist-50/85 px-2 py-1.5 text-xs",
                  "dark:border-mist-800 dark:bg-mist-950/85",
                )}
              >
                <Legend colour={ACCENT.selected}>Selected</Legend>
                <Legend colour={ACCENT.out}>Can reach</Legend>
                <Legend colour={ACCENT.in}>Reached by</Legend>
                <Legend colour={ACCENT.both}>Both ways</Legend>
                <span className="col-span-2 whitespace-nowrap text-mist-500">
                  Dashed = Internet or subnet
                </span>
              </div>
            </Panel>
          </ReactFlow>
        </div>

        <aside
          className="shrink-0 overflow-y-auto rounded-md border border-mist-200 p-3 lg:w-80 dark:border-mist-800"
          style={{ maxHeight: mapHeight ?? MAP_HEIGHT }}
        >
          <Summary
            // Suspending has to reach the panel too, or the canvas un-greys
            // the machines outside the filter while the column beside it goes
            // on describing only the chosen ones. An empty set here is what
            // "no filter" means everywhere else.
            chosen={filterActive ? chosen : EMPTY_SET}
            direction={direction}
            isVisible={isMatch}
            jumpDisabled={unsaved}
            onJump={jumpToRule}
            flows={selectedFlows}
            evaluation={evaluation}
            labels={labels}
            nodes={nodes}
            onClearEdge={() => selectEdge(null)}
            selected={selectedNode}
          />
        </aside>
      </div>

      {evaluation.warnings.length > 0 ? (
        <div className="rounded-md border border-yellow-500/40 bg-yellow-500/5 p-3 text-sm">
          <div className="mb-1 flex items-center gap-2 font-medium">
            <CircleAlert className="size-4" />
            <span>
              {evaluation.warnings.length} policy warning
              {evaluation.warnings.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="space-y-0.5 text-mist-600 dark:text-mist-400">
            {evaluation.warnings.map((warning) => (
              <li
                className="flex items-start gap-1.5"
                key={`${warning.ruleIndex ?? "-"}:${warning.message}`}
              >
                <span className="flex-1">{warning.message}</span>
                {/*
                  Only rule-scoped warnings can be located. A parse failure has
                  no rule to jump to, so it gets no affordance rather than one
                  that goes nowhere.
                */}
                {warning.ruleIndex !== undefined ? (
                  <JumpToRule
                    disabled={unsaved}
                    onJump={jumpToRule}
                    ruleIndex={warning.ruleIndex}
                    token={warning.token}
                  />
                ) : undefined}
              </li>
            ))}
          </ul>
        </div>
      ) : undefined}
    </div>
  );
}

// --- Custom node -----------------------------------------------------------

/**
 * A node with handles on its left and right edges instead of top and bottom.
 * Forward traffic enters left-upper and leaves right-upper; return traffic
 * leaves left-lower and enters right-lower. Handles are invisible: they exist
 * only as anchor points, since the map is not interactively connectable.
 */
function FlowNode({ id, data }: NodeProps) {
  const role = (data.role as Role) ?? "idle";
  const anchor = { background: "transparent", border: "none", width: 1, height: 1 };
  const onInspect = data.onInspect as ((id: string) => void) | undefined;

  return (
    // The wrapper carries no size of its own, so the measured box — which the
    // floating edges anchor to — is still the label box below.
    <div
      className="group relative"
      // Said on hover rather than on click: the pointer is already there, and
      // explaining a dead click only once it has been made is late.
      title={data.selectable === false ? "Toggle the filter back on to select machines" : undefined}
      style={{
        // The node being inspected is not clickable, and neither is anything
        // while the filter is suspended, so neither offers a pointer.
        // Otherwise every node does, greyed or not: grey means "outside the
        // filter", and clicking is how you bring it in.
        cursor: data.interactive === false || data.selectable === false ? "default" : "pointer",
        pointerEvents: data.interactive === false ? ("none" as const) : undefined,
      }}
    >
      <div
        style={{
          background: "var(--cm-bg)",
          color: "var(--cm-fg)",
          border: `2px ${data.pseudo ? "dashed" : "solid"} ${ACCENT[role]}`,
          borderRadius: 8,
          fontSize: 12,
          padding: "6px 10px",
          opacity: data.dim ? DIMMED_OPACITY : 1,
          transition: "opacity 120ms ease",
        }}
      >
        <Handle id={HANDLE.target} position={Position.Left} style={anchor} type="target" />
        <Handle id={HANDLE.source} position={Position.Right} style={anchor} type="source" />
        {String(data.label ?? "")}
      </div>
      {/*
        Outside the box that carries the dim, or it would fade to 20% along
        with a greyed node — which is exactly when you most need to reach it.
        Absolutely positioned so it never contributes to the measured size.
      */}
      {onInspect ? (
        <button
          className={cn(
            "-top-2.5 -right-2.5 absolute hidden rounded border p-1 opacity-0 transition-opacity",
            "border-mist-300 bg-mist-50 text-mist-600 shadow-sm hover:text-mist-900",
            "dark:border-mist-700 dark:bg-mist-900 dark:text-mist-300 dark:hover:text-mist-100",
            "group-hover:flex group-hover:opacity-100",
          )}
          onClick={(event) => {
            // Or the node's own click would fire too and toggle the filter
            // instead of — as well as — inspecting.
            event.stopPropagation();
            onInspect(id);
          }}
          title="Inspect this machine"
          type="button"
        >
          <Focus className="size-3" />
        </button>
      ) : undefined}
    </div>
  );
}

const nodeTypes = { flow: FlowNode };

/**
 * Where the line joining two node centres crosses the border of `node`. Gives
 * each overview edge the shortest possible run between two boxes, instead of
 * anchoring it to a fixed handle and sweeping around.
 */
function nodeCentre(node: InternalNode<Node>) {
  return {
    x: node.internals.positionAbsolute.x + (node.measured?.width ?? 0) / 2,
    y: node.internals.positionAbsolute.y + (node.measured?.height ?? 0) / 2,
  };
}

/**
 * Where the line towards `other` leaves this node's box, with the lane offset
 * applied FIRST — post-shifting a point already on the boundary slides it
 * along and often back inside, burying the arrowhead. Walks from the offset
 * point out to the first edge crossed (slab method), so the result is on the
 * boundary whatever the lane.
 */
function borderPoint(
  node: InternalNode<Node>,
  other: InternalNode<Node>,
  offset: { x: number; y: number } = { x: 0, y: 0 },
) {
  const halfW = (node.measured?.width ?? 0) / 2;
  const halfH = (node.measured?.height ?? 0) / 2;
  const centre = nodeCentre(node);
  const target = nodeCentre(other);

  // Before measurement both boxes are 0×0; fall back to the centre.
  if (halfW === 0 || halfH === 0) return { x: centre.x + offset.x, y: centre.y + offset.y };

  const dx = target.x - centre.x;
  const dy = target.y - centre.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return { x: centre.x + offset.x, y: centre.y + offset.y };

  const ux = dx / length;
  const uy = dy / length;
  const toVerticalEdge =
    ux === 0 ? Number.POSITIVE_INFINITY : (Math.sign(ux) * halfW - offset.x) / ux;
  const toHorizontalEdge =
    uy === 0 ? Number.POSITIVE_INFINITY : (Math.sign(uy) * halfH - offset.y) / uy;
  const t = Math.max(0, Math.min(toVerticalEdge, toHorizontalEdge));

  return { x: centre.x + offset.x + ux * t, y: centre.y + offset.y + uy * t };
}

function FloatingEdge({ id, source, target, style, markerEnd, data }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  // Each leg of a two-way pair steps off the centre line along the normal.
  // Both legs carry the same lane value: each computes the normal from its own
  // direction, and those are opposites, so they land on opposite sides.
  const lane = typeof data?.lane === "number" ? data.lane : 0;
  const normal = perpendicular(nodeCentre(sourceNode), nodeCentre(targetNode));
  const offset = { x: normal.x * lane, y: normal.y * lane };

  const from = borderPoint(sourceNode, targetNode, offset);
  const to = borderPoint(targetNode, sourceNode, offset);
  const [path] = getStraightPath({
    sourceX: from.x,
    sourceY: from.y,
    targetX: to.x,
    targetY: to.y,
  });

  return (
    <BaseEdge
      id={id}
      // Narrower than the default so two lanes keep distinct hit areas.
      interactionWidth={lane === 0 ? undefined : LANE_INTERACTION}
      markerEnd={markerEnd}
      path={path}
      style={style}
    />
  );
}

/** getStraightPath takes flattened coordinates; these come as points. */
/** Unit vector at right angles to the line from `from` to `to`. */
function perpendicular(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: -dy / length, y: dx / length };
}

/**
 * Two dash streams running opposite ways, one either side of the line, each
 * styled like a one-way animated edge. Focused view only: its fixed
 * source-right/target-left anchors would send a real return leg out of the
 * peer's far face and back around, so a two-way pair is one line with two
 * heads. The overview has free geometry and uses real per-leg lanes.
 */
function DashStreams({
  path,
  colour,
  width,
  opacity,
  normal,
}: {
  path: string;
  colour: string;
  width: number;
  opacity: number;
  normal: { x: number; y: number };
}) {
  const stroke = Math.min(width, 2);
  const spread = stroke / 2 + 0.5;
  const dx = normal.x * spread;
  const dy = normal.y * spread;
  const stream = {
    fill: "none",
    stroke: colour,
    strokeWidth: stroke,
    strokeDasharray: 5,
    opacity,
    // The base path keeps the arrowheads and the click target; these are decor.
    pointerEvents: "none" as const,
    animation: "dashdraw 0.5s linear infinite",
  };

  return (
    <>
      <path d={path} style={{ ...stream, transform: `translate(${dx}px, ${dy}px)` }} />
      <path
        d={path}
        style={{
          ...stream,
          animationDirection: "reverse",
          transform: `translate(${-dx}px, ${-dy}px)`,
        }}
      />
    </>
  );
}

/**
 * While the streams run the line itself is drawn with a transparent stroke
 * rather than a faded one — a one-way animated edge has no solid line under
 * its dashes. Transparent rather than hidden, so the arrowheads and the wide
 * interaction path survive.
 */
function streamingBaseStyle(style: EdgeProps["style"], active: boolean) {
  return active ? { ...style, stroke: "transparent" } : style;
}

/** A two-way conversation in the focused view: one line, a head at each end. */
function DualFlowEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  markerEnd,
  markerStart,
  style,
  data,
  // A custom edge type has to hand this down itself; BaseEdge does not see it
  // otherwise.
  interactionWidth,
}: EdgeProps) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const active = data?.active === true;
  const width = typeof style?.strokeWidth === "number" ? style.strokeWidth : 2;
  const back = arrowLength(width);

  // Stop the streams exactly where the arrowheads begin: they loop, so without
  // this a dash slides out from under the head as the previous one arrives.
  const towards = Math.sign(targetX - sourceX) || 1;
  const inset = Math.abs(targetX - sourceX) > back * 3 ? back * towards : 0;
  const [streamPath] = getBezierPath({
    sourceX: sourceX + inset,
    sourceY,
    sourcePosition,
    targetX: targetX - inset,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        interactionWidth={interactionWidth}
        markerEnd={markerEnd}
        markerStart={markerStart}
        path={path}
        style={streamingBaseStyle(style, active)}
      />
      {active ? (
        <DashStreams
          colour={String(style?.stroke ?? ACCENT.both)}
          normal={perpendicular({ x: sourceX, y: sourceY }, { x: targetX, y: targetY })}
          opacity={typeof style?.opacity === "number" ? style.opacity : 1}
          path={streamPath}
          width={width}
        />
      ) : undefined}
    </>
  );
}

const edgeTypes = { floating: FloatingEdge, dual: DualFlowEdge };

// --- Right-hand summary ----------------------------------------------------

interface SummaryProps {
  direction: Direction;
  /** The filter, which decides both what this describes and how. */
  chosen: Set<string>;
  /** Whether a peer survives the node filter, so the lists match the canvas. */
  isVisible: (id: string) => boolean;
  /** Jumping is unavailable while the buffer and the saved policy disagree. */
  jumpDisabled: boolean;
  onJump: (ruleIndex: number, token?: string) => void;
  /** Every leg of the selected conversation — one entry, or two if two-way. */
  flows: AclEdge[];
  evaluation: AclEvaluation;
  labels: Map<string, string>;
  nodes: AclNode[];
  selected: string | null;
  onClearEdge: () => void;
}

/**
 * Follows the filter and changes mode at two, as the greying does. One
 * machine: everything it talks to — a single machine has no "between", so the
 * panel would empty at the moment you picked something. Two or more: only what
 * passes between them.
 */
function Summary({
  chosen,
  direction,
  isVisible,
  jumpDisabled,
  onJump,
  flows,
  evaluation,
  labels,
  nodes,
  selected,
  onClearEdge,
}: SummaryProps) {
  if (flows.length > 0) {
    return (
      <EdgeSummary
        evaluation={evaluation}
        selected={selected}
        jumpDisabled={jumpDisabled}
        flows={flows}
        labels={labels}
        onClose={onClearEdge}
        onJump={onJump}
      />
    );
  }

  if (chosen.size > 1) {
    return (
      <BetweenSummary
        chosen={chosen}
        direction={direction}
        evaluation={evaluation}
        jumpDisabled={jumpDisabled}
        labels={labels}
        onJump={onJump}
        selected={selected}
      />
    );
  }

  // With exactly one machine chosen it is the subject, whether it got there by
  // a click or by being inspected. `selected` is the fallback for a hand-made
  // URL that focuses a node without filtering it.
  const subject = chosen.size === 1 ? [...chosen][0] : selected;

  if (!subject) {
    return (
      <p className="text-sm text-mist-500">
        Select a node to see which rules apply to it, or an edge to see what permits that flow.
      </p>
    );
  }

  return (
    <NodeSummary
      direction={direction}
      evaluation={evaluation}
      isVisible={isVisible}
      jumpDisabled={jumpDisabled}
      labels={labels}
      nodes={nodes}
      onJump={onJump}
      selected={subject}
    />
  );
}

interface NodeSummaryProps {
  direction: Direction;
  evaluation: AclEvaluation;
  isVisible: (id: string) => boolean;
  jumpDisabled: boolean;
  labels: Map<string, string>;
  nodes: AclNode[];
  onJump: (ruleIndex: number, token?: string) => void;
  selected: string;
}

function NodeSummary({
  direction,
  evaluation,
  isVisible,
  jumpDisabled,
  labels,
  nodes,
  onJump,
  selected,
}: NodeSummaryProps) {
  const node = nodes.find((n) => n.id === selected);
  // The panel lists exactly what the map is drawing, so the direction filter
  // applies here too — otherwise "Inbound" shows one thing on the canvas and
  // another in the rules beside it.
  const allOutbound = direction === "in" ? [] : groupByRule(evaluation.edges, selected, "out");
  const allInbound = direction === "out" ? [] : groupByRule(evaluation.edges, selected, "in");

  const surviving = (groups: RuleGrouping[]) =>
    groups.filter((group) => group.peers.some(isVisible));
  const outbound = surviving(allOutbound);
  const inbound = surviving(allInbound);
  // Nothing left to show, but the node is not isolated — its peers are simply
  // filtered out. Saying "isolated" here would be a lie.
  const hiddenByFilter =
    outbound.length === 0 && inbound.length === 0 && allOutbound.length + allInbound.length > 0;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div>
        <h3 className="font-medium break-words">{labels.get(selected) ?? selected}</h3>
        <p className="text-xs text-mist-500">
          {node?.user ? `Owned by ${node.user}` : undefined}
          {node?.user && node.tags.length > 0 ? " · " : undefined}
          {node && node.tags.length > 0 ? node.tags.join(", ") : undefined}
          {!node ? "Not a machine" : undefined}
        </p>
        <p className="mt-1 text-xs text-mist-500">
          Reaches {evaluation.reachOut.get(selected)?.length ?? 0} · reached by{" "}
          {evaluation.reachIn.get(selected)?.length ?? 0}
        </p>
      </div>

      <RuleGroup
        isVisible={isVisible}
        jumpDisabled={jumpDisabled}
        onJump={onJump}
        accent={ACCENT.out}
        groups={outbound}
        labels={labels}
        peerLabel="To"
        title="Outbound rules"
      />
      <RuleGroup
        isVisible={isVisible}
        jumpDisabled={jumpDisabled}
        onJump={onJump}
        accent={ACCENT.in}
        groups={inbound}
        labels={labels}
        peerLabel="From"
        title="Inbound rules"
      />

      {outbound.length === 0 && inbound.length === 0 ? (
        <p className="text-xs text-mist-500">
          {hiddenByFilter
            ? "Every machine this node talks to is filtered out."
            : direction === "all"
              ? "No rule mentions this node — it is isolated."
              : `No ${direction === "in" ? "inbound" : "outbound"} rule applies to this node.`}
        </p>
      ) : undefined}
    </div>
  );
}

interface FlowGrouping {
  src: string;
  dst: string;
  rules: { ruleIndex: number; ports: PortRange[]; proto?: string }[];
}

/**
 * Traffic permitted between the chosen machines, one entry per direction of
 * each conversation. Grouped by flow, not by rule: rule-first repeated a pair
 * once per rule, and again within a card for each dst alias that reached it.
 * `focus` narrows to one machine's own conversations, for the inspect view.
 */
function groupBetween(
  edges: AclEdge[],
  chosen: Set<string>,
  focus: string | null,
  direction: Direction,
): FlowGrouping[] {
  const flows: FlowGrouping[] = [];

  for (const edge of edges) {
    if (!chosen.has(edge.src) || !chosen.has(edge.dst)) continue;
    if (focus !== null) {
      if (direction === "out" && edge.src !== focus) continue;
      if (direction === "in" && edge.dst !== focus) continue;
      if (edge.src !== focus && edge.dst !== focus) continue;
    }

    // One row per rule, even where the rule reaches this flow through several
    // dst aliases: the ports merge and the row would otherwise repeat.
    const byRule = new Map<number, FlowGrouping["rules"][number]>();
    for (const rule of edge.rules) {
      const entry = byRule.get(rule.ruleIndex) ?? {
        ruleIndex: rule.ruleIndex,
        ports: [],
        proto: rule.proto,
      };
      for (const port of rule.ports) {
        if (!entry.ports.some((p) => p.start === port.start && p.end === port.end)) {
          entry.ports.push(port);
        }
      }
      byRule.set(rule.ruleIndex, entry);
    }

    flows.push({
      src: edge.src,
      dst: edge.dst,
      rules: [...byRule.values()].sort((a, b) => a.ruleIndex - b.ruleIndex),
    });
  }

  return flows;
}

function BetweenSummary({
  chosen,
  direction,
  evaluation,
  jumpDisabled,
  labels,
  onJump,
  selected,
}: {
  chosen: Set<string>;
  direction: Direction;
  evaluation: AclEvaluation;
  jumpDisabled: boolean;
  labels: Map<string, string>;
  onJump: (ruleIndex: number, token?: string) => void;
  /** The machine being inspected, if any — the reference for the narrowing. */
  selected: string | null;
}) {
  const name = (id: string) => labels.get(id) ?? id;
  const flows = groupBetween(evaluation.edges, chosen, selected, direction);

  // Both legs of one conversation sit together, so a two-way pair reads as a
  // pair instead of turning up twice in unrelated places down the column.
  const pairName = (flow: FlowGrouping) => [name(flow.src), name(flow.dst)].sort().join(" ");
  const ordered = [...flows].sort(
    (a, b) => pairName(a).localeCompare(pairName(b)) || name(a.src).localeCompare(name(b.src)),
  );

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div>
        <h3 className="font-medium">{chosen.size} machines selected</h3>
        <p className="text-xs text-mist-500">{[...chosen].map(name).join(", ")}</p>
      </div>

      {ordered.length === 0 ? (
        // Said out loud, because the map is still full of lines: those run to
        // machines outside the selection, and a blank column here would read
        // as the panel having broken rather than as an answer.
        <p className="text-xs text-mist-500">
          {selected
            ? `No policy connects ${name(selected)} to the other selected machines.`
            : "No policy connects the selected machines. Their traffic all goes elsewhere — remove one to see what it talks to."}
        </p>
      ) : (
        <div>
          <h4 className="mb-1 flex items-center gap-1.5 text-xs font-medium">
            <span className="size-2 rounded-full" style={{ background: ACCENT.selected }} />
            {selected ? `Flows with ${name(selected)}` : "Flows between them"}
            <span className="text-mist-500">({ordered.length})</span>
          </h4>
          <ul className="divide-y divide-mist-200 dark:divide-mist-800">
            {ordered.map((flow) => {
              // Direction only means something against a reference point, so
              // the rails stay neutral in the overview, where none exists.
              const accent =
                selected === null
                  ? ACCENT.selected
                  : flow.src === selected
                    ? ACCENT.out
                    : ACCENT.in;

              return (
                <li
                  className="border-l-2 py-2 pl-2.5 text-xs"
                  key={`${flow.src}->${flow.dst}`}
                  style={{ borderColor: accent }}
                >
                  <p className="break-words text-mist-900 dark:text-mist-100">
                    {name(flow.src)} <span className="text-mist-500">→</span> {name(flow.dst)}
                  </p>
                  {/* Its rules in succession underneath, which is the shape of
                      the question: this flow, permitted by these. */}
                  <ul className="mt-1 space-y-1">
                    {flow.rules.map((rule) => (
                      <li className="flex items-center gap-2" key={rule.ruleIndex}>
                        <RuleBadge index={rule.ruleIndex} />
                        <span className="ml-auto truncate font-mono text-mist-500">
                          {rule.proto ?? "any"} · {summarisePorts(rule.ports)}
                        </span>
                        <JumpToRule
                          disabled={jumpDisabled}
                          onJump={onJump}
                          ruleIndex={rule.ruleIndex}
                        />
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

interface RuleGroupProps {
  accent: string;
  isVisible: (id: string) => boolean;
  jumpDisabled: boolean;
  onJump: (ruleIndex: number, token?: string) => void;
  groups: RuleGrouping[];
  labels: Map<string, string>;
  /** Prefixes the resolved machines: "To" for outbound, "From" for inbound. */
  peerLabel: string;
  title: string;
}

function RuleGroup({
  accent,
  groups,
  isVisible,
  jumpDisabled,
  labels,
  onJump,
  peerLabel,
  title,
}: RuleGroupProps) {
  // The panel lists what the canvas is showing, so a filtered-out peer drops
  // out of the rule that mentions it — and a rule left describing nobody drops
  // out entirely.
  const visible = groups
    .map((group) => ({ ...group, peers: group.peers.filter(isVisible) }))
    .filter((group) => group.peers.length > 0);

  if (visible.length === 0) return null;

  return (
    <div>
      <h4 className="mb-1 flex items-center gap-1.5 text-xs font-medium">
        <span className="size-2 rounded-full" style={{ background: accent }} />
        {title}
        <span className="text-mist-500">({visible.length})</span>
      </h4>
      {/*
        A rail instead of a box. Six boxed cards in a narrow column is 24 border
        segments all competing with the text; one tinted left edge per row plus
        a shared hairline reads as a single list — and the tint carries the
        direction, which otherwise lives only in the header that scrolls away.
        The rule's own src → dst text is deliberately absent here: when scanning
        many rules it was noise, and the magnifying glass goes to the source.
      */}
      <ul className="divide-y divide-mist-200 dark:divide-mist-800">
        {visible.map((group) => (
          <li
            className="border-l-2 py-2 pl-2.5 text-xs"
            key={group.ruleIndex}
            style={{ borderColor: accent }}
          >
            <div className="flex items-center gap-2">
              <RuleBadge index={group.ruleIndex} />
              <span className="ml-auto truncate font-mono text-mist-500">
                {group.proto ?? "any"} · {summarisePorts(group.ports)}
              </span>
              <JumpToRule disabled={jumpDisabled} onJump={onJump} ruleIndex={group.ruleIndex} />
            </div>
            <PeerList label={peerLabel} names={group.peers.map((id) => labels.get(id) ?? id)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

interface EdgeSummaryProps {
  flows: AclEdge[];
  /** The focused node, so direction can be stated relative to it. */
  selected: string | null;
  jumpDisabled: boolean;
  onJump: (ruleIndex: number, token?: string) => void;
  evaluation: AclEvaluation;
  labels: Map<string, string>;
  onClose: () => void;
}

function EdgeSummary({
  evaluation,
  flows,
  jumpDisabled,
  labels,
  onJump,
  onClose,
  selected,
}: EdgeSummaryProps) {
  const name = (id: string) => labels.get(id) ?? id;
  const [first] = flows;
  const twoWay = flows.length > 1;

  // Direction only means something relative to a node. In the focused view
  // that is the node being inspected, so a leg leaving it is outbound and
  // takes the same emerald the map and the node summary use. The overview has
  // no such reference point, so both legs stay neutral there.
  const accentFor = (flow: AclEdge) =>
    selected === null ? ACCENT.selected : flow.src === selected ? ACCENT.out : ACCENT.in;

  return (
    <div className="text-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="font-medium break-words">
          {name(first.src)} {twoWay ? "↔" : "→"} {name(first.dst)}
        </span>
        <button aria-label="Close flow details" onClick={onClose} type="button">
          <X className="size-4" />
        </button>
      </div>

      {/*
        One section per direction. Rules can exist both ways between the same
        pair, and which way a rule runs is the whole question — so each section
        states its own source → destination rather than relying on the header,
        which cannot describe both at once.
      */}
      {flows.map((flow) => (
        <div className="mb-3 last:mb-0" key={edgeId(flow)}>
          {twoWay ? (
            <h4 className="mb-1 flex items-center gap-1.5 font-mono text-xs break-words text-mist-500">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: accentFor(flow) }}
              />
              {name(flow.src)} → {name(flow.dst)}
            </h4>
          ) : undefined}
          <ul className="divide-y divide-mist-200 dark:divide-mist-800">
            {mergeFlowRules(flow.rules).map((rule) => {
              const source = evaluation.rules.find((r) => r.index === rule.ruleIndex);
              return (
                <li
                  className="border-l-2 py-2 pl-2.5 text-xs"
                  key={rule.ruleIndex}
                  style={{ borderColor: accentFor(flow) }}
                >
                  <div className="flex items-center gap-2">
                    <RuleBadge index={rule.ruleIndex} />
                    {/*
                      Protocol only. This card lists the ports in full below,
                      and `summarisePorts` prints values rather than a count at
                      three or fewer — so a short rule said "any · 9200, 9300,
                      9980" and then said it again two lines down.
                    */}
                    <span className="ml-auto truncate font-mono text-mist-500">
                      {rule.proto ?? "any"}
                    </span>
                    <JumpToRule
                      disabled={jumpDisabled}
                      onJump={onJump}
                      ruleIndex={rule.ruleIndex}
                    />
                  </div>
                  {/*
                    Endpoints as the policy writes them — but only the dst
                    tokens that actually matched this flow. Printing the rule's
                    whole dst list buried the card in destinations belonging to
                    other pairs.
                  */}
                  {source ? (
                    <p className="mt-1 font-mono break-words text-mist-500">
                      {source.src.join(", ")} → {rule.dstAliases.join(", ")}
                    </p>
                  ) : undefined}
                  <PortList ports={rule.ports} />
                </li>
              );
            })}
          </ul>
          {isSubnetNodeId(flow.dst) ? (
            <p className="mt-2 text-xs text-mist-500">
              {subnetRoutersFor(evaluation, flow.dst).length > 0
                ? `Routed by ${subnetRoutersFor(evaluation, flow.dst).map(name).join(", ")}`
                : "No machine advertises an approved route covering this subnet."}
            </p>
          ) : undefined}
        </div>
      ))}
    </div>
  );
}

function subnetRoutersFor(evaluation: AclEvaluation, id: string): string[] {
  return evaluation.subnets.find((subnet) => subnet.id === id)?.routers ?? [];
}

interface FlowRule {
  ruleIndex: number;
  proto?: string;
  ports: PortRange[];
  dstAliases: string[];
}

/**
 * One card per rule, not per matched destination. A rule naming several dsts
 * that all resolve to the same machine produced a separate identical-looking
 * card for each; the ports and matched tokens belong together.
 */
function mergeFlowRules(rules: EdgeRule[]): FlowRule[] {
  const byIndex = new Map<number, FlowRule>();

  for (const rule of rules) {
    const existing = byIndex.get(rule.ruleIndex);
    if (existing) {
      existing.ports.push(...rule.ports);
      if (!existing.dstAliases.includes(rule.dstAlias)) existing.dstAliases.push(rule.dstAlias);
    } else {
      byIndex.set(rule.ruleIndex, {
        ruleIndex: rule.ruleIndex,
        proto: rule.proto,
        ports: [...rule.ports],
        dstAliases: [rule.dstAlias],
      });
    }
  }

  return [...byIndex.values()].sort((a, b) => a.ruleIndex - b.ruleIndex);
}

/**
 * The ports a flow permits: the payload of the card, so it takes the
 * full-strength colour. Capped by token count rather than by lines, since how
 * many fit on a line depends on the panel width.
 */
function PortList({ ports }: { ports: PortRange[] }) {
  const [expanded, setExpanded] = useState(false);
  const tokens = portTokens(ports);
  const limit = 8;
  const hidden = tokens.length - limit;
  const shown = expanded || hidden <= 0 ? tokens : tokens.slice(0, limit);

  if (tokens.length === 0) return null;

  return (
    <p className="mt-1 font-mono break-words text-mist-900 dark:text-mist-100">
      {shown.join(", ")}
      {hidden > 0 ? (
        <button
          className="ml-1 rounded font-sans text-mist-500 underline underline-offset-2 hover:text-mist-700 dark:hover:text-mist-300"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          {expanded ? "show less" : `+${hidden} more`}
        </button>
      ) : undefined}
    </p>
  );
}

/**
 * Open this rule in the editor. Icon only, and it sits on the card's header
 * line — the label was identical on every card, so spelling it out added a
 * whole row of repeated text per rule.
 */
function JumpToRule({
  disabled,
  onJump,
  ruleIndex,
  token,
}: {
  disabled?: boolean;
  onJump: (index: number, token?: string) => void;
  ruleIndex: number;
  token?: string;
}) {
  // Rendered as a plain icon rather than a disabled <button>: the tooltip's
  // own trigger is a button (so nesting one would be invalid), and a natively
  // disabled control often swallows the hover that would explain itself.
  if (disabled) {
    return (
      <Tooltip content="Save or discard the ACL to use this tool">
        <span
          aria-disabled="true"
          aria-label="Show in the policy file — save or discard first"
          className="shrink-0 cursor-not-allowed rounded p-1 text-mist-300 dark:text-mist-700"
        >
          <Search className="size-3.5" />
        </span>
      </Tooltip>
    );
  }

  return (
    <button
      aria-label={`Show acls[${ruleIndex}] in the policy file`}
      className={cn(
        "shrink-0 rounded p-1 text-mist-500",
        "hover:bg-mist-100 hover:text-mist-700",
        "dark:hover:bg-mist-800 dark:hover:text-mist-300",
      )}
      onClick={() => onJump(ruleIndex, token)}
      title="Show this rule in the policy file"
      type="button"
    >
      <Search className="size-3.5" />
    </button>
  );
}

/**
 * A square icon control that keeps its explanation when disabled. Uses `title`
 * rather than `~/components/tooltip`, whose trigger is itself a button; the
 * disabled form is a span, since a disabled button swallows the hover that
 * would explain why.
 */
function IconButton({
  active = false,
  children,
  disabled = false,
  label,
  onClick,
}: {
  /** On, in the switch sense: tinted so the state reads without the tooltip. */
  active?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  const shell = cn(
    // Opts back in: the panel wrapping these is pointer-events-none so its
    // empty area stays part of the map.
    "pointer-events-auto flex items-center rounded-md border p-1.5",
    active
      ? "border-indigo-400/60 bg-indigo-500/10 text-indigo-500 dark:border-indigo-500/50 dark:text-indigo-400"
      : "border-mist-200 bg-mist-50/85 dark:border-mist-800 dark:bg-mist-950/85",
  );

  if (disabled) {
    return (
      <span aria-disabled className={cn(shell, "text-mist-400 dark:text-mist-600")} title={label}>
        {children}
      </span>
    );
  }

  return (
    <button
      aria-label={label}
      className={cn(
        shell,
        active ? "hover:bg-indigo-500/20" : "hover:bg-mist-100 dark:hover:bg-mist-900",
      )}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

interface FilterItem {
  id: string;
  label: string;
  /** Owner and tags, shown under the name to tell similar machines apart. */
  detail: string;
  /** Pre-lowercased name, owner, tags and addresses, for the search box. */
  haystack: string;
}

/** Clear of the canvas edge, so the panel never runs flush into the border. */
const PANEL_EDGE_GAP = 24;

/**
 * Drag the bottom-right corner to grow the picker. Right and down only: the
 * panel is anchored top-left, so the other way would have to move it. Floored
 * at its natural size (captured on the first drag) and ceilinged at the canvas
 * edge. Not persisted — a scratch adjustment for one search.
 */
function usePanelResize() {
  const ref = useRef<HTMLDivElement>(null);
  const natural = useRef<{ width: number; height: number } | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const onResizeStart = (event: React.PointerEvent<HTMLElement>) => {
    const panel = ref.current;
    if (!panel) return;
    event.preventDefault();
    // Or the canvas beneath treats it as a background click and steps back.
    event.stopPropagation();

    const start = panel.getBoundingClientRect();
    // Before the first drag the panel is at its natural size, so this is the
    // smallest it can honestly go.
    natural.current ??= { width: start.width, height: start.height };
    const min = natural.current;

    const canvas = panel.closest(".react-flow")?.getBoundingClientRect();
    const maxWidth = canvas ? canvas.right - start.left - PANEL_EDGE_GAP : Number.POSITIVE_INFINITY;
    const maxHeight = canvas
      ? canvas.bottom - start.top - PANEL_EDGE_GAP
      : Number.POSITIVE_INFINITY;

    const handle = event.currentTarget;
    const startX = event.clientX;
    const startY = event.clientY;
    // Capture, so a fast drag that outruns the 12px handle keeps resizing
    // instead of dropping the gesture over the canvas.
    handle.setPointerCapture(event.pointerId);

    const clamp = (value: number, low: number, high: number) =>
      Math.max(low, Math.min(value, high));

    const onMove = (move: PointerEvent) => {
      setSize({
        width: clamp(start.width + (move.clientX - startX), min.width, maxWidth),
        height: clamp(start.height + (move.clientY - startY), min.height, maxHeight),
      });
    };

    const onUp = () => {
      // Only if it is still held: the browser releases implicitly, and calling
      // this on a pointer it no longer has throws NotFoundError — which would
      // abort the handler before the listeners came off and leave the panel
      // resizing after the button was let go.
      if (handle.hasPointerCapture(event.pointerId)) {
        handle.releasePointerCapture(event.pointerId);
      }
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      // A cancelled gesture (a touch turning into a scroll, the tab losing the
      // pointer) never sends pointerup, so without this the listeners stay.
      handle.removeEventListener("pointercancel", onUp);
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  };

  return { size, onResizeStart, ref };
}

interface FilterPanelProps {
  machines: FilterItem[];
  extras: FilterItem[];
  chosen: Set<string>;
  animateAll: boolean;
  suspended: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: (id: string) => void;
  /** Tick or untick a whole set at once — every search hit, in practice. */
  onToggleMany: (ids: string[], selected: boolean) => void;
  onChange: (updates: Partial<Record<FilterKey, string | null>>) => void;
}

/**
 * Pick which machines the map lights. Nothing chosen means everything, so
 * "clear" and "select all" are one state and the canvas can never end up
 * empty by accident. Collapsed by default, since an open roster covers the map
 * it exists to help you read. The search narrows this list only, never the
 * ticks, so clearing the term leaves the selection alone.
 */
function FilterPanel({
  machines,
  extras,
  chosen,
  animateAll,
  suspended,
  open,
  onOpenChange,
  onToggle,
  onToggleMany,
  onChange,
}: FilterPanelProps) {
  const [search, setSearch] = useState("");
  const { size, onResizeStart, ref: panelRef } = usePanelResize();

  const term = search.trim().toLowerCase();
  const matches = (item: FilterItem) => term.length === 0 || item.haystack.includes(term);
  const unchosen = (items: FilterItem[]) =>
    items.filter((item) => !chosen.has(item.id) && matches(item));

  // Everything the term matches, chosen or not — a hit is a hit, and the ticked
  // ones are pinned to the top of the list whether or not they match. With no
  // term there is nothing to act on in bulk: "select all" over the whole roster
  // is the same as choosing nothing, which is already the default.
  const hits = term.length === 0 ? [] : [...machines, ...extras].filter(matches);
  const allHitsChosen = hits.length > 0 && hits.every((item) => chosen.has(item.id));

  // Chosen items ignore the search and pin to the top, or ticking one and then
  // retyping would hide it with no way to untick it.
  const picked = [...machines, ...extras].filter((item) => chosen.has(item.id));
  const restMachines = unchosen(machines);
  const restExtras = unchosen(extras);

  const row = (item: FilterItem) => (
    <label
      className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 hover:bg-mist-100 dark:hover:bg-mist-800"
      key={item.id}
    >
      <input
        checked={chosen.has(item.id)}
        className="mt-0.5"
        onChange={() => onToggle(item.id)}
        type="checkbox"
      />
      <span className="min-w-0">
        <span className="block truncate">{item.label}</span>
        {item.detail ? (
          <span className="block truncate text-[11px] text-mist-500">{item.detail}</span>
        ) : undefined}
      </span>
    </label>
  );

  if (!open) {
    return (
      <button
        className={cn(
          "pointer-events-auto flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
          "border-mist-200 bg-mist-50/85 dark:border-mist-800 dark:bg-mist-950/85",
          "hover:bg-mist-100 dark:hover:bg-mist-900",
        )}
        onClick={() => onOpenChange(true)}
        type="button"
      >
        <ListFilter className="size-3.5" />
        Filter
        {chosen.size > 0 ? (
          <span className={cn("rounded px-1", suspended ? "text-mist-500" : "text-indigo-500")}>
            {chosen.size}
          </span>
        ) : undefined}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-auto relative flex flex-col gap-1.5 rounded-md border p-2 text-xs",
        "border-mist-200 bg-mist-50/95 dark:border-mist-800 dark:bg-mist-950/95",
        // Sized to the longest name and tag list so nothing truncates at rest,
        // floored so a short roster is not cramped and ceilinged so one long
        // tag cannot take the canvas. Only until the first drag.
        size === null ? "w-max min-w-60 max-w-md" : undefined,
      )}
      onClick={(event) => event.stopPropagation()}
      ref={panelRef}
      style={size ?? undefined}
    >
      <div className="flex items-center gap-1.5">
        <Search className="size-3.5 shrink-0 text-mist-500" />
        <input
          aria-label="Search machines"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-mist-500"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Name, tag, owner or IP"
          value={search}
        />
        {/* Clears the term first and closes only once there is nothing to
            clear. Sitting inside the search field it reads as the field's own
            clear button, so closing the whole panel on the first press loses
            work the user was in the middle of. Same progressive dismissal as
            the background click, which closes this panel before it touches the
            selection behind it. */}
        <button
          aria-label={search.length > 0 ? "Clear the search" : "Close the filter"}
          className="shrink-0 rounded p-0.5 text-mist-500 hover:text-mist-700 dark:hover:text-mist-300"
          onClick={() => {
            if (search.length > 0) setSearch("");
            else onOpenChange(false);
          }}
          title={search.length > 0 ? "Clear the search" : "Close the filter"}
          type="button"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {hits.length > 0 ? (
        <div className="flex items-center justify-between gap-2 text-[11px] text-mist-500">
          <span>
            {hits.length} {hits.length === 1 ? "match" : "matches"}
          </span>
          {/* One call, not a loop of single toggles: each of those would read
              the same stale `chosen` and only the last would survive. */}
          <button
            className="rounded underline underline-offset-2 hover:text-mist-700 dark:hover:text-mist-300"
            onClick={() =>
              onToggleMany(
                hits.map((item) => item.id),
                !allHitsChosen,
              )
            }
            type="button"
          >
            {allHitsChosen ? "deselect all" : "select all"}
          </button>
        </div>
      ) : undefined}

      {/* Capped until resized, then it takes whatever the drag gave it — the
          list is the only part worth growing. `min-h-0` or a flex child
          refuses to shrink below its content and the panel overflows.
          20rem holds eight rows of name-plus-tags with room for a group
          heading, which is enough to compare machines without scrolling. */}
      <div className={cn("overflow-y-auto", size === null ? "max-h-80" : "min-h-0 flex-1")}>
        {picked.length > 0 ? (
          <>
            <p className="px-1 py-0.5 text-[11px] text-mist-500">Selected ({picked.length})</p>
            {picked.map(row)}
            <hr className="my-1 border-mist-200 dark:border-mist-800" />
          </>
        ) : undefined}

        {restMachines.map(row)}

        {restExtras.length > 0 ? (
          <>
            <p className="px-1 py-0.5 text-[11px] text-mist-500">Internet &amp; subnets</p>
            {restExtras.map(row)}
          </>
        ) : undefined}

        {picked.length === 0 && restMachines.length === 0 && restExtras.length === 0 ? (
          <p className="px-1 py-1 text-mist-500">Nothing matches “{search}”.</p>
        ) : undefined}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-mist-200 pt-1.5 dark:border-mist-800">
        {/* Says so plainly: suspended is the state in which none of the filter
            controls below do anything, and a bare count does not hint at it.
            Suspending and clearing themselves live in the toolbar now. */}
        <span className="text-mist-500">
          {chosen.size === 0
            ? "Showing all"
            : suspended
              ? `${chosen.size} selected · suspended`
              : `${chosen.size} selected`}
        </span>
      </div>

      {/* Hiding moved out to the toolbar beside suspend and clear — all three
          act on the filter as a whole. What is left here only changes how the
          map is drawn, never what it contains. */}
      <div className="flex flex-col gap-1 text-mist-500">
        <label
          className="flex cursor-pointer items-center gap-1.5"
          title="Keep every line moving, not just the ones you point at or pick"
        >
          <input
            checked={animateAll}
            onChange={(event) => onChange({ animate: event.target.checked ? "1" : null })}
            type="checkbox"
          />
          Animate all flows
        </label>
      </div>

      {/*
        Two hairlines in the corner, the conventional grip. A button rather
        than a div so it is focusable and announced; the pointer handler does
        the work, and there is nothing for a plain activation to do.
      */}
      <button
        aria-label="Resize the filter panel"
        className={cn(
          "absolute right-0.5 bottom-0.5 size-3 cursor-nwse-resize rounded-xs",
          "border-mist-400 border-r-2 border-b-2 opacity-40 hover:opacity-80 dark:border-mist-600",
        )}
        onPointerDown={onResizeStart}
        title="Drag to resize"
        type="button"
      />
    </div>
  );
}

/** A fixed anchor to scan down: every card starts with its rule id. */
function RuleBadge({ index }: { index: number }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px]",
        "bg-mist-100 text-mist-600 dark:bg-mist-800 dark:text-mist-300",
      )}
    >
      acls[{index}]
    </span>
  );
}

/**
 * The machines a rule resolved to, labelled with the direction so they are not
 * confused with the rule's own src → dst aliases directly above. Capped,
 * because one wildcard rule would otherwise dump the whole tailnet into the
 * panel.
 */
function PeerList({ label, names }: { label: string; names: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const limit = 3;
  const hidden = names.length - limit;
  const shown = expanded || hidden <= 0 ? names : names.slice(0, limit);

  return (
    <p className="mt-1 break-words">
      {/*
        Machines carry the full-strength colour and ports stay muted monospace,
        so the two kinds of value in a card are told apart at a glance rather
        than read.
      */}
      <span className="text-mist-500">{label} </span>
      <span className="text-mist-900 dark:text-mist-100">{shown.join(", ")}</span>
      {hidden > 0 ? (
        <button
          className="ml-1 rounded text-mist-500 underline underline-offset-2 hover:text-mist-700 dark:hover:text-mist-300"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          {expanded ? "show less" : `+${hidden} more`}
        </button>
      ) : undefined}
    </p>
  );
}

// --- Helpers ---------------------------------------------------------------

interface OverviewEdgeState {
  /** Run this line whether or not it is emphasised. */
  alwaysAnimate: boolean;
  /** Arrowhead at the target end — the directed views always, plus emphasis. */
  arrowEnd: boolean;
  /** Overrides the emphasis colour, for the legend's direction accents. */
  colour?: string;
  /** Perpendicular offset, so the two legs of a pair sit side by side. */
  lane: number;
  /** The cursor is on this line. */
  hovered: boolean;
  /** Nothing is hovered, so nothing is emphasised. */
  idle: boolean;
  /** Runs to or from the hovered node, in the filtered direction. */
  lit: boolean;
  /** Some OTHER line is under the cursor, so this one gets out of its way. */
  otherHovered: boolean;
  /** Clicked; stays emphasised until cleared. */
  selected: boolean;
  /** Some line is selected, so the rest recede. */
  someSelected: boolean;
  /** Filtered out: drawn faintly, and clicking it adds both its machines. */
  muted: boolean;
}

/** One overview line: straight, between the nearest points on each box. */
function overviewEdge(edge: AclEdge, state: OverviewEdgeState): Edge {
  const emphasised = state.selected || state.hovered || state.lit;
  const colour = state.colour ?? (emphasised ? ACCENT.selected : ACCENT.idle);
  return {
    id: edgeId(edge),
    source: edge.src,
    target: edge.dst,
    // Straight lines between the nearest points on each box, rather than
    // beziers between fixed handles — far less noodly on a ring.
    type: "floating",
    // Unused by the floating edge, but they must reference real handles or
    // React Flow will not resolve the edge.
    sourceHandle: HANDLE.source,
    targetHandle: HANDLE.target,
    markerEnd: state.arrowEnd ? { type: MarkerType.ArrowClosed, color: colour } : undefined,
    // Movement follows emphasis, or the idle graph is constant noise — unless
    // asked for, and "animate all flows" means all of them, greyed included.
    // Each leg travels its own way, so React Flow's own flag is enough.
    animated: state.alwaysAnimate || emphasised,
    data: { lane: state.lane },
    style: {
      stroke: colour,
      strokeWidth: state.hovered ? 3 : state.selected ? 3 : state.lit ? 2 : 1,
      // A selection persists; hover still wins over the fade, so a dimmed line
      // stays findable under the cursor.
      opacity: state.muted
        ? // Level with a greyed node rather than the old near-invisible 0.04:
          // this is a click target now, so it has to be findable, and hover
          // lifts it further to say the click will land.
          state.hovered || state.lit
          ? 0.6
          : DIMMED_OPACITY
        : // Hover comes first and goes to full strength, with everything else
          // pushed well back below. Lit lines already sit at 0.95, so the old
          // order left hovering one of them changing almost nothing — the
          // contrast has to come from the rest receding, not from the line
          // brightening the last 5%.
          state.hovered
          ? 1
          : state.otherHovered
            ? 0.1
            : state.selected
              ? 1
              : state.someSelected
                ? 0.08
                : // Ahead of `idle`: a chosen machine's traffic is lit with no
                  // cursor anywhere, so the two are no longer exclusive.
                  state.lit
                  ? 0.95
                  : state.idle
                    ? 0.4
                    : 0.05,
      cursor: "pointer",
      transition: "opacity 120ms ease, stroke-width 120ms ease",
    },
  };
}

interface RuleGrouping {
  ruleIndex: number;
  peers: string[];
  ports: PortRange[];
  proto?: string;
}

/** Collapse the edges touching `selected` into one entry per ACL rule. */
function groupByRule(edges: AclEdge[], selected: string, dir: "out" | "in"): RuleGrouping[] {
  const grouped = new Map<number, { peers: Set<string>; ports: PortRange[]; proto?: string }>();

  for (const edge of edges) {
    const matches = dir === "out" ? edge.src === selected : edge.dst === selected;
    if (!matches) continue;
    const peer = dir === "out" ? edge.dst : edge.src;

    for (const rule of edge.rules) {
      const entry = grouped.get(rule.ruleIndex) ?? {
        peers: new Set<string>(),
        ports: [],
        proto: rule.proto,
      };
      entry.peers.add(peer);
      for (const port of rule.ports) {
        if (!entry.ports.some((p) => p.start === port.start && p.end === port.end)) {
          entry.ports.push(port);
        }
      }
      grouped.set(rule.ruleIndex, entry);
    }
  }

  return [...grouped.entries()]
    .map(([ruleIndex, entry]) => ({
      ruleIndex,
      peers: [...entry.peers],
      ports: entry.ports,
      proto: entry.proto,
    }))
    .sort((a, b) => a.ruleIndex - b.ruleIndex);
}

interface NodeOptions {
  dim?: boolean;
  /** Only ever false for the node being inspected: clicking it is a no-op. */
  interactive?: boolean;
  /**
   * Whether a click would change the filter. Separate from `interactive`,
   * which governs pointer events: a node with a frozen selection still hovers
   * to show its flows, it just no longer offers a pointer.
   */
  selectable?: boolean;
  /** Omitted for the inspected node, which has nowhere to go. */
  onInspect?: (id: string) => void;
}

function buildNode(
  id: string,
  labels: Map<string, string>,
  role: Role,
  position: { x: number; y: number },
  { dim = false, interactive = true, selectable = true, onInspect }: NodeOptions = {},
): Node {
  return {
    id,
    position,
    type: "flow",
    // On the wrapper, not just the inner box: React Flow's node element is
    // what receives the pointer, so styling the child alone still leaves the
    // node hoverable.
    style: interactive ? undefined : { pointerEvents: "none" },
    data: {
      label: labels.get(id) ?? id,
      role,
      pseudo: isPseudo(id),
      dim,
      interactive,
      selectable,
      onInspect,
    },
  };
}

interface FocusEdgeStyle {
  colour: string;
  animated: boolean;
  opacity: number;
  strokeWidth: number;
  arrowEnd: boolean;
  /** Head at the near end too, for a two-way conversation. */
  arrowStart: boolean;
  /** Two-way: drawn by DualFlowEdge so both directions animate at once. */
  dual: boolean;
  /** Runs to a filtered-out node, so it recedes to match it. */
  muted: boolean;
}

function buildEdge(edge: AclEdge, state: FocusEdgeStyle): Edge {
  const marker = { type: MarkerType.ArrowClosed, color: state.colour };
  // "Animate all flows" means all of them, greyed ones included: they are
  // click targets, not inert decoration, and leaving them still made the
  // toggle look half-applied.
  const animated = state.animated;
  return {
    id: edgeId(edge),
    source: edge.src,
    target: edge.dst,
    sourceHandle: HANDLE.source,
    targetHandle: HANDLE.target,
    type: state.dual ? "dual" : undefined,
    // A dual edge animates itself; React Flow's own flag only moves one way
    // and would fight the two streams.
    animated: state.dual ? false : animated,
    data: state.dual ? { active: animated } : undefined,
    markerEnd: state.arrowEnd ? marker : undefined,
    markerStart: state.arrowStart ? marker : undefined,
    style: {
      stroke: state.colour,
      strokeWidth: state.strokeWidth,
      // Level with a greyed node. Clicking it adds both its machines to the
      // filter rather than opening rules, so it stays a live target.
      opacity: state.muted ? DIMMED_OPACITY : state.opacity,
      cursor: "pointer",
      // Keeps the fade from strobing as the cursor crosses several lines.
      transition: "opacity 120ms ease, stroke-width 120ms ease",
    },
  };
}

/**
 * Mirror the app's theme onto React Flow, which styles its own controls and
 * background. Headplane puts an explicit `.dark`/`.light` on <html> and
 * otherwise follows the system preference — the same three states React Flow
 * accepts, so this maps across directly.
 */
function useColorMode(): "light" | "dark" | "system" {
  const [mode, setMode] = useState<"light" | "dark" | "system">("system");

  useEffect(() => {
    const read = () => {
      const classes = document.documentElement.classList;
      setMode(classes.contains("dark") ? "dark" : classes.contains("light") ? "light" : "system");
    };

    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return mode;
}

function Legend({ colour, children }: { colour: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: colour }} />
      {children}
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-md border border-mist-200 dark:border-mist-800"
      style={{ height: MAP_HEIGHT }}
    >
      <div className="flex h-full items-center justify-center">
        <p className="max-w-prose text-center text-sm text-mist-500">{children}</p>
      </div>
    </div>
  );
}

function edgeId(edge: AclEdge): string {
  return `${edge.src}->${edge.dst}`;
}

/** Direction-independent key for a node pair, so both legs share an identity. */
function pairKey(a: string, b: string): string {
  return [a, b].sort().join(" ");
}

function isPseudo(id: string): boolean {
  return id === INTERNET || isSubnetNodeId(id);
}
