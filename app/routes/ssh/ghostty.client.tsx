import { useEffect, useRef } from "react";
import { Restty } from "restty";
import type { GhosttyTheme } from "restty";
import type { PtyTransport } from "restty/internal";

const FONT_BASE = `${__PREFIX__}/fonts`;

// Ghostty's default canvas background is rgb(20,23,26) — a dark gray, not black.
// Override it so the terminal matches the page and pane container backgrounds.
const HEADPLANE_THEME: GhosttyTheme = {
  colors: {
    background: { r: 0, g: 0, b: 0 },
    foreground: { r: 235, g: 237, b: 242 },
    palette: [],
  },
  raw: {},
};

function createSSHTransport(
  ipn: IPN,
  ipAddress: string,
  username: string,
  onConnected: () => void,
): PtyTransport {
  let session: IPNSSHSession | null = null;
  let writeInput: ((data: string) => void) | null = null;

  return {
    connect(options) {
      session = ipn.ssh(ipAddress, username, {
        writeFn: (data) => options.callbacks.onData?.(data),
        writeErrorFn: (error) => options.callbacks.onData?.(error),
        setReadFn: (readFn) => {
          writeInput = readFn;
        },
        rows: options.rows ?? 24,
        cols: options.cols ?? 80,
        termType: "xterm-256color",
        timeoutSeconds: 30,
        onConnectionProgress: () => {},
        onConnected: () => {
          options.callbacks.onConnect?.();
          onConnected();
        },
        onDone: () => {
          options.callbacks.onDisconnect?.();
          session = null;
          writeInput = null;
        },
      });
    },
    disconnect() {
      session?.close();
      session = null;
    },
    sendInput(data) {
      writeInput?.(data);
      return session != null;
    },
    // Restty passes cols first, the Tailscale session takes rows first.
    resize(cols, rows) {
      session?.resize(rows, cols);
      return session != null;
    },
    isConnected() {
      return session != null;
    },
    destroy() {
      session?.close();
      session = null;
    },
  };
}

interface GhosttyProps {
  ipn: IPN;
  ipAddress: string;
  username: string;
  onConnected: () => void;
}

export default function Ghostty({ ipn, ipAddress, username, onConnected }: GhosttyProps) {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!divRef.current) return;

    const transport = createSSHTransport(ipn, ipAddress, username, onConnected);
    const restty = new Restty({
      root: divRef.current,
      surface: {
        createInitialPane: true,
        defaultContextMenu: false,
        shortcuts: false,
        searchUi: false,
        paneStyles: {
          inactivePaneOpacity: 1,
          activePaneOpacity: 1,
        },
      },
      terminal: {
        fontSize: 20,
        ligatures: true,
        fonts: [
          {
            url: `${FONT_BASE}/JetBrainsMonoNLNerdFontMono-Regular.ttf`,
            name: "JetBrains Mono Nerd Font",
          },
          {
            url: `${FONT_BASE}/JetBrainsMonoNLNerdFontMono-Bold.ttf`,
            name: "JetBrains Mono Nerd Font Bold",
            weight: 700,
          },
          {
            url: `${FONT_BASE}/JetBrainsMonoNLNerdFontMono-Italic.ttf`,
            name: "JetBrains Mono Nerd Font Italic",
            style: "italic",
          },
          {
            url: `${FONT_BASE}/JetBrainsMonoNLNerdFontMono-BoldItalic.ttf`,
            name: "JetBrains Mono Nerd Font Bold Italic",
            weight: 700,
            style: "italic",
          },
          {
            url: `${FONT_BASE}/SymbolsNerdFontMono-Regular.ttf`,
            name: "Symbols Nerd Font",
          },
        ],
      },
      services: {
        ptyTransport: transport,
      },
    });

    restty.applyTheme(HEADPLANE_THEME);
    restty.updateSize(true);
    restty.connectPty();

    return () => {
      restty.destroy();
    };
  }, [ipn, ipAddress, username, onConnected]);

  return <div className="min-h-0 min-w-0 flex-1 overflow-hidden bg-black" ref={divRef} />;
}
