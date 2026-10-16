import cn from "~/utils/cn";

const HEADER_HEIGHT = 53;
const INSET = 3;
const MIN_THUMB = 32;
const IDLE_MS = 1000;

// Classic scrollbars reserve a gutter that shifts the page whenever it starts
// or stops scrolling, and pages can no longer opt into overlay scrollbars. So
// on mouse devices the root scrollbar is hidden (see tailwind.css) and this
// draws an overlay thumb between the header and footer instead. Wheel,
// keyboard, and dragging the thumb all scroll; clicking the empty track does
// not.
export default function Scrollbar() {
  return (
    <div
      aria-hidden
      className={cn(
        "group/scrollbar fixed right-0 z-30 hidden w-3 pointer-fine:block",
        "opacity-0 transition-opacity duration-300 motion-reduce:transition-none",
        "hover:opacity-100 data-active:opacity-100 data-hidden:invisible",
      )}
      ref={attach}
      style={{ top: HEADER_HEIGHT + INSET }}
    >
      <div
        className={cn(
          "bg-line-strong absolute right-0.5 w-1.5 cursor-default rounded-full",
          "transition-[width] duration-100 group-hover/scrollbar:w-2",
        )}
        data-thumb
      />
    </div>
  );
}

function attach(node: HTMLDivElement | null) {
  if (!node) {
    return;
  }

  const track = node;
  const thumb = track.querySelector<HTMLDivElement>("[data-thumb]")!;
  const root = document.documentElement;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let drag: { startY: number; startScroll: number; ratio: number } | undefined;

  function measure() {
    const footer = document.querySelector("footer")?.offsetHeight ?? 0;
    const viewHeight = window.innerHeight;
    const trackHeight = viewHeight - HEADER_HEIGHT - footer - INSET * 2;
    const maxScroll = root.scrollHeight - viewHeight;
    const thumbHeight = Math.max(MIN_THUMB, (trackHeight * viewHeight) / root.scrollHeight);
    return { footer, trackHeight, maxScroll, thumbHeight };
  }

  function update() {
    const { footer, trackHeight, maxScroll, thumbHeight } = measure();
    track.toggleAttribute("data-hidden", maxScroll <= 0);
    if (maxScroll <= 0) {
      return;
    }

    const progress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
    track.style.bottom = `${footer + INSET}px`;
    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translateY(${progress * (trackHeight - thumbHeight)}px)`;
  }

  function wake() {
    track.toggleAttribute("data-active", true);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!drag) {
        track.toggleAttribute("data-active", false);
      }
    }, IDLE_MS);
  }

  function onScroll() {
    update();
    wake();
  }

  function onPointerDown(event: PointerEvent) {
    const { trackHeight, maxScroll, thumbHeight } = measure();
    drag = {
      startY: event.clientY,
      startScroll: window.scrollY,
      ratio: maxScroll / (trackHeight - thumbHeight),
    };
    thumb.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function onPointerMove(event: PointerEvent) {
    if (!drag) {
      return;
    }

    window.scrollTo({ top: drag.startScroll + (event.clientY - drag.startY) * drag.ratio });
  }

  function onPointerUp() {
    drag = undefined;
    wake();
  }

  const resizeObserver = new ResizeObserver(update);
  resizeObserver.observe(document.body);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", update);
  thumb.addEventListener("pointerdown", onPointerDown);
  thumb.addEventListener("pointermove", onPointerMove);
  thumb.addEventListener("pointerup", onPointerUp);
  thumb.addEventListener("pointercancel", onPointerUp);
  update();

  return () => {
    clearTimeout(idleTimer);
    resizeObserver.disconnect();
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", update);
    thumb.removeEventListener("pointerdown", onPointerDown);
    thumb.removeEventListener("pointermove", onPointerMove);
    thumb.removeEventListener("pointerup", onPointerUp);
    thumb.removeEventListener("pointercancel", onPointerUp);
  };
}
