import { useCallback } from "react";

const SPACING = 22;
const DOT_R = 1.1;
const NODE_R = 4.5;

const NODE_COUNT = 7;
const NODE_GAP = 8;
const NODE_FADE_MS = 1200;
const CHURN_MS = [8000, 12000] as const;
const SPAWN_MS = [1800, 3200] as const;
const STEP_MS = 55;
const TRAIL_MS = 500;
const PEAK = 0.55;
const PING_MS = 1200;

type Cell = [number, number];

interface Node {
  x: number;
  y: number;
  bornAt: number;
  diesAt: number;
}

interface Packet {
  cells: Cell[];
  startedAt: number;
  index: number;
  to: Node;
}

interface Field {
  width: number;
  height: number;
  dpr: number;
  cols: number;
  half: number;
  lit: Float32Array;
}

export default function Grid() {
  const start = useCallback((node: HTMLCanvasElement | null) => {
    if (!node) {
      return;
    }

    const canvas = node;
    const ctx = canvas.getContext("2d")!;
    const base = document.createElement("canvas");
    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const nodes: Node[] = [];
    const packets: Packet[] = [];
    const pings: { node: Node; startedAt: number }[] = [];
    let field: Field = { width: 0, height: 0, dpr: 1, cols: 0, half: 0, lit: new Float32Array() };
    let baseColor = "";
    let frame = 0;
    let last = performance.now();
    let spawnAt = 0;
    let churnAt = 0;

    function resize() {
      const { width, height } = canvas.getBoundingClientRect();
      if (width === field.width && height === field.height) {
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      for (const c of [canvas, base]) {
        c.width = Math.round(width * dpr);
        c.height = Math.round(height * dpr);
      }

      const cols = Math.ceil(width / SPACING);
      const half = Math.ceil(height / SPACING / 2);
      field = { width, height, dpr, cols, half, lit: new Float32Array(cols * (half * 2 + 1)) };
      baseColor = "";

      const now = performance.now();
      nodes.length = 0;
      packets.length = 0;
      pings.length = 0;
      for (let i = 0; i < NODE_COUNT; i++) {
        place(now - NODE_FADE_MS);
      }

      churnAt = now + rand(...CHURN_MS);
    }

    function place(now: number) {
      const span = Math.floor(field.half * 0.7);
      for (let tries = 0; tries < 200; tries++) {
        const x = rand(3, field.cols - 4);
        const y = rand(-span, span);

        if (nodes.every((n) => Math.abs(n.x - x) + Math.abs(n.y - y) > NODE_GAP)) {
          nodes.push({ x, y, bornAt: now, diesAt: Infinity });
          return true;
        }
      }

      return false;
    }

    function tick(now: number, dt: number) {
      const fade = Math.exp(-dt / TRAIL_MS);
      for (let i = 0; i < field.lit.length; i++) {
        field.lit[i] = field.lit[i] < 0.01 ? 0 : field.lit[i] * fade;
      }

      for (let i = nodes.length - 1; i >= 0; i--) {
        if (now > nodes[i].diesAt) nodes.splice(i, 1);
      }

      if (now >= churnAt) {
        const alive = nodes.filter((n) => n.diesAt === Infinity);
        if (place(now)) {
          alive[rand(0, alive.length - 1)].diesAt = now + NODE_FADE_MS;
        }

        churnAt = now + rand(...CHURN_MS);
      }

      if (now >= spawnAt) {
        spawn(now);
      }

      for (let i = packets.length - 1; i >= 0; i--) {
        const packet = packets[i];
        const reached = Math.floor((now - packet.startedAt) / STEP_MS);

        while (packet.index <= reached && packet.index < packet.cells.length) {
          const [x, y] = packet.cells[packet.index];
          light(field, x, y, PEAK);
          packet.index++;
        }

        if (packet.index === packet.cells.length) {
          pings.push({ node: packet.to, startedAt: now });
          packets.splice(i, 1);
        }
      }
    }

    function spawn(now: number) {
      const ready = nodes.filter((n) => presence(n, now) === 1);
      if (ready.length < 2) {
        return;
      }

      const from = Math.random() < 0.3 ? { x: 0, y: rand(-3, 3) } : pick(ready);
      let to = pick(ready);
      while (to === from) to = pick(ready);

      packets.push({ cells: route([from.x, from.y], [to.x, to.y]), startedAt: now, index: 0, to });
      spawnAt = now + rand(...SPAWN_MS);
    }

    function paintBase(color: string) {
      const b = base.getContext("2d")!;
      b.setTransform(field.dpr, 0, 0, field.dpr, 0, 0);
      b.clearRect(0, 0, field.width, field.height);
      b.fillStyle = color;

      for (let y = -field.half; y <= field.half; y++) {
        for (let x = 0; x < field.cols; x++) {
          const [px, py] = position(field, x, y);
          b.globalAlpha = mask(field, px, py);
          circle(b, px, py, DOT_R);
          b.fill();
        }
      }
    }

    function draw(now: number) {
      const style = getComputedStyle(canvas);
      const dim = style.getPropertyValue("--hp-line-strong").trim();
      const bright = style.getPropertyValue("--hp-fg").trim();

      if (dim !== baseColor) {
        baseColor = dim;
        paintBase(dim);
      }

      ctx.setTransform(field.dpr, 0, 0, field.dpr, 0, 0);
      ctx.clearRect(0, 0, field.width, field.height);
      ctx.globalAlpha = 1;
      ctx.drawImage(base, 0, 0, field.width, field.height);

      ctx.fillStyle = bright;
      ctx.strokeStyle = bright;
      ctx.lineWidth = 1;

      for (let y = -field.half; y <= field.half; y++) {
        for (let x = 0; x < field.cols; x++) {
          const v = field.lit[index(field, x, y)];
          if (v < 0.02) continue;

          const [px, py] = position(field, x, y);
          ctx.globalAlpha = mask(field, px, py) * v;
          circle(ctx, px, py, DOT_R + v * 0.4);
          ctx.fill();
        }
      }

      for (const n of nodes) {
        const [px, py] = position(field, n.x, n.y);
        const a = mask(field, px, py) * Math.max(0, presence(n, now));
        ctx.globalAlpha = a * (0.28 + field.lit[index(field, n.x, n.y)] * 0.4);
        circle(ctx, px, py, NODE_R);
        ctx.stroke();

        ctx.globalAlpha = a * 0.45;
        circle(ctx, px, py, 1.5);
        ctx.fill();
      }

      for (let i = pings.length - 1; i >= 0; i--) {
        const t = (now - pings[i].startedAt) / PING_MS;
        if (t >= 1) {
          pings.splice(i, 1);
          continue;
        }

        const [px, py] = position(field, pings[i].node.x, pings[i].node.y);
        ctx.globalAlpha = mask(field, px, py) * (1 - t) * 0.3;
        circle(ctx, px, py, NODE_R + (1 - (1 - t) ** 3) * 12);
        ctx.stroke();
      }
    }

    // A hidden panel leaves the canvas at 0x0, and drawing an empty canvas
    // throws, so idle until it has a size instead of killing the loop.
    function isVisible() {
      return field.width > 0 && field.height > 0;
    }

    function loop(now: number) {
      frame = requestAnimationFrame(loop);
      if (isVisible()) {
        tick(now, Math.min(64, now - last));
        draw(now);
      }

      last = now;
    }

    function onResize() {
      resize();
      if (isReduced && isVisible()) draw(performance.now());
    }

    onResize();
    const observer = new ResizeObserver(onResize);
    observer.observe(canvas);
    if (!isReduced) {
      frame = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return <canvas aria-hidden className="absolute inset-0 size-full" ref={start} />;
}

function presence(node: Node, now: number) {
  return Math.min(1, (now - node.bornAt) / NODE_FADE_MS, (node.diesAt - now) / NODE_FADE_MS);
}

function index(f: Field, x: number, y: number) {
  return (y + f.half) * f.cols + x;
}

function light(f: Field, x: number, y: number, value: number) {
  if (x < 0 || x >= f.cols || Math.abs(y) > f.half) return;
  const i = index(f, x, y);
  f.lit[i] = Math.max(f.lit[i], value);
}

// The grid is centered in the panel, with row 0 on its vertical middle.
function position(f: Field, x: number, y: number): Cell {
  return [(f.width - (f.cols - 1) * SPACING) / 2 + x * SPACING, f.height / 2 + y * SPACING];
}

// Fades out toward every edge of the panel.
function mask(f: Field, px: number, py: number) {
  const x = px / f.width;
  const y = py / f.height;
  return smooth(x / 0.15) * smooth((1 - x) / 0.15) * smooth(y / 0.15) * smooth((1 - y) / 0.15);
}

function smooth(t: number) {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

function rand(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pick<T>(list: T[]) {
  return list[rand(0, list.length - 1)];
}

// L-shaped route along grid lines, turning once.
function route(from: Cell, to: Cell) {
  const cells: Cell[] = [from];
  const corner: Cell = Math.random() < 0.5 ? [to[0], from[1]] : [from[0], to[1]];
  for (const [a, b] of [
    [from, corner],
    [corner, to],
  ]) {
    const dx = Math.sign(b[0] - a[0]);
    const dy = Math.sign(b[1] - a[1]);
    let [x, y] = a;
    while (x !== b[0] || y !== b[1]) {
      x += dx;
      y += dy;
      cells.push([x, y]);
    }
  }

  return cells;
}
