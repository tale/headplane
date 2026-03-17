import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRevalidator } from "react-router";

const LiveDataContext = createContext({
  paused: false,
  setPaused: (_: boolean) => {},
});

interface LiveDataProps {
  children: React.ReactNode;
}

type Versions = Record<string, string>;
interface ChangedEvent {
  resource: string;
  version: string;
}

export function LiveDataProvider({ children }: LiveDataProps) {
  const revalidator = useRevalidator();
  const [paused, setPaused] = useState(false);

  // This ref is a bit sus but it's needed to ensure the SSE handshake does
  // not re-establish on every revalidation. The SSE stream is always stable
  const revalidatorRef = useRef(revalidator);
  revalidatorRef.current = revalidator;

  const versionsRef = useRef<Versions>({});
  const isTabDirtyRef = useRef(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(1000);

  const revalidateIfIdle = useCallback(() => {
    if (revalidatorRef.current.state === "idle") {
      revalidatorRef.current.revalidate();
    }
  }, []);

  // SSE connection
  useEffect(() => {
    if (paused) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      return;
    }

    function connect() {
      const sse = new EventSource(`${__PREFIX__}/events/live`);
      eventSourceRef.current = sse;

      sse.addEventListener("hello", (e) => {
        backoffRef.current = 1000;
        try {
          versionsRef.current = JSON.parse(e.data) as Versions;
        } catch {}
      });

      sse.addEventListener("changed", (e) => {
        try {
          const data = JSON.parse(e.data) as ChangedEvent;
          const current = versionsRef.current[data.resource];
          if (current !== undefined && data.version === current) {
            return;
          }

          versionsRef.current = {
            ...versionsRef.current,
            [data.resource]: data.version,
          };

          if (document.visibilityState !== "visible") {
            isTabDirtyRef.current = true;
            return;
          }

          revalidateIfIdle();
        } catch {}
      });

      sse.onerror = () => {
        sse.close();
        eventSourceRef.current = null;
        const delay = backoffRef.current;
        backoffRef.current = Math.min(delay * 2, 30_000);
        reconnectTimer.current = setTimeout(connect, delay);
      };
    }

    connect();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };
  }, [paused, revalidateIfIdle]);

  // If the tab becomes visible and is marked dirty, revalidate
  useEffect(() => {
    const visibilityCallback = () => {
      if (document.visibilityState === "visible" && isTabDirtyRef.current) {
        isTabDirtyRef.current = false;
        revalidateIfIdle();
      }
    };

    document.addEventListener("visibilitychange", visibilityCallback);
    return () => {
      document.removeEventListener("visibilitychange", visibilityCallback);
    };
  }, [revalidateIfIdle]);

  // Force a revalidation when the app comes back online
  useEffect(() => {
    window.addEventListener("online", revalidateIfIdle);
    return () => {
      window.removeEventListener("online", revalidateIfIdle);
    };
  }, [revalidateIfIdle]);

  return (
    <LiveDataContext.Provider value={{ paused, setPaused }}>{children}</LiveDataContext.Provider>
  );
}

export function useLiveData() {
  const context = useContext(LiveDataContext);
  return {
    pause: () => context.setPaused(true),
    resume: () => context.setPaused(false),
  };
}
