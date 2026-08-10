import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { clamp, type Pt } from "@/lib/tactical";
import { cn } from "@/lib/utils";

export type ViewportHandle = {
  reset: () => void;
  zoomBy: (factor: number) => void;
  zoom: number;
};

type Props = {
  children: ReactNode;
  aspect?: number;
  className?: string;
  /** When true a single-pointer drag draws instead of panning. */
  drawMode?: boolean;
  onTap?: (p: Pt) => void;
  onDrawStart?: (p: Pt) => void;
  onDrawMove?: (p: Pt) => void;
  onDrawEnd?: (p: Pt) => void;
  onZoomChange?: (z: number) => void;
};

const MIN = 1;
const MAX = 8;

export const Viewport = forwardRef<ViewportHandle, Props>(function Viewport(
  { children, aspect = 1, className, drawMode, onTap, onDrawStart, onDrawMove, onDrawEnd, onZoomChange },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const state = useRef({ zoom: 1, offset: { x: 0, y: 0 } });
  state.current = { zoom, offset };

  useEffect(() => onZoomChange?.(zoom), [zoom, onZoomChange]);

  const toLocal = useCallback((clientX: number, clientY: number): Pt => {
    const r = innerRef.current!.getBoundingClientRect();
    return {
      x: clamp(((clientX - r.left) / r.width) * 100, 0, 100),
      y: clamp(((clientY - r.top) / r.height) * 100, 0, 100),
    };
  }, []);

  const applyZoom = useCallback((next: number, px: number, py: number) => {
    const { zoom: z, offset: o } = state.current;
    const nz = clamp(next, MIN, MAX);
    if (nz === z) return;
    const k = nz / z;
    setOffset({ x: px - (px - o.x) * k, y: py - (py - o.y) * k });
    setZoom(nz);
  }, []);

  // wheel / trackpad pinch (non-passive)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const r = el.getBoundingClientRect();
      applyZoom(
        state.current.zoom * Math.exp(-dy * 0.0018),
        e.clientX - r.left,
        e.clientY - r.top,
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [applyZoom]);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    mode: "none" | "pan" | "draw" | "pinch";
    startDist: number;
    startZoom: number;
    last: { x: number; y: number };
    moved: number;
  }>({ mode: "none", startDist: 0, startZoom: 1, last: { x: 0, y: 0 }, moved: 0 });

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      g.mode = "pinch";
      g.startDist = Math.hypot(a.x - b.x, a.y - b.y);
      g.startZoom = state.current.zoom;
      return;
    }
    g.moved = 0;
    g.last = { x: e.clientX, y: e.clientY };
    if (drawMode) {
      g.mode = "draw";
      onDrawStart?.(toLocal(e.clientX, e.clientY));
    } else {
      g.mode = "pan";
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (g.mode === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const r = wrapRef.current!.getBoundingClientRect();
      applyZoom(
        g.startZoom * (dist / (g.startDist || dist)),
        (a.x + b.x) / 2 - r.left,
        (a.y + b.y) / 2 - r.top,
      );
      return;
    }
    const dx = e.clientX - g.last.x;
    const dy = e.clientY - g.last.y;
    g.moved += Math.hypot(dx, dy);
    g.last = { x: e.clientX, y: e.clientY };
    if (g.mode === "pan") {
      setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
    } else if (g.mode === "draw") {
      onDrawMove?.(toLocal(e.clientX, e.clientY));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (g.mode === "pinch") {
      if (pointers.current.size < 2) g.mode = "none";
      return;
    }
    if (g.mode === "draw") {
      onDrawEnd?.(toLocal(e.clientX, e.clientY));
    } else if (g.mode === "pan" && g.moved < 8) {
      onTap?.(toLocal(e.clientX, e.clientY));
    }
    g.mode = "none";
  };

  useImperativeHandle(ref, () => ({
    reset: () => {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    },
    zoomBy: (factor: number) => {
      const r = wrapRef.current?.getBoundingClientRect();
      applyZoom(state.current.zoom * factor, (r?.width ?? 0) / 2, (r?.height ?? 0) / 2);
    },
    zoom,
  }));

  return (
    <div
      ref={wrapRef}
      className={cn("relative overflow-hidden rounded-2xl bg-black/40 touch-none select-none", className)}
      style={{ aspectRatio: String(aspect) }}
    >
      <div
        ref={innerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="absolute left-0 top-0 w-full"
        style={{
          aspectRatio: String(aspect),
          transformOrigin: "0 0",
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          cursor: drawMode ? "crosshair" : "grab",
        }}
      >
        {children}
      </div>
    </div>
  );
});
