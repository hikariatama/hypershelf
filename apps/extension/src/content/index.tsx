import { useCallback, useEffect, useState } from "react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient, useQuery } from "convex/react";
import { createRoot } from "react-dom/client";

import { api } from "@hypershelf/convex/_generated/api";
import { useConvex } from "@hypershelf/lib/hooks";

import type { Tokens } from "../shared/types";
import type { ConnectorAdapter } from "./adapters/types";
import { NEXT_PUBLIC_CONVEX_URL, NEXT_PUBLIC_SITE_URL } from "~/shared/env";
import { ensureTokens, resetAuth } from "../shared/auth";
import { connectors } from "./adapters";
import { ShadowPortalProvider } from "./shadow-portal/PortalProvider";
import sheet from "./shared.css" with { type: "css" };
import { log } from "./ui/banner";

const convex = new ConvexReactClient(NEXT_PUBLIC_CONVEX_URL);

const isHypershelfOrigin = (): boolean => {
  if (!NEXT_PUBLIC_SITE_URL) return false;
  try {
    return window.location.origin === new URL(NEXT_PUBLIC_SITE_URL).origin;
  } catch {
    return false;
  }
};

const dispatchExtensionReady = (): void => {
  if (!isHypershelfOrigin()) return;
  const manifest = chrome.runtime.getManifest();
  window.dispatchEvent(
    new CustomEvent("hypershelf:extension-ready", {
      detail: {
        name: manifest.name,
        version: manifest.version,
      },
    }),
  );
};

const installExtensionHandshake = (): void => {
  if (!isHypershelfOrigin()) return;
  window.addEventListener("hypershelf:web-ready", dispatchExtensionReady);
  dispatchExtensionReady();
};

installExtensionHandshake();

const selectAdapter = (doc: Document): ConnectorAdapter | null => {
  for (const c of connectors) {
    for (const sel of c.anchorSelectors) {
      if (doc.querySelector(sel)) return c;
    }
  }
  return null;
};

const Utils = ({ setTokens }: { setTokens: (t: Tokens) => void }) => {
  useConvex();

  const isAuthed = useQuery(api.auth.isAuthed);
  useEffect(() => {
    const handler = setTimeout(() => {
      if (isAuthed?.authed === false) {
        void resetAuth()
          .then((t) => setTokens(t))
          .catch(() => null);
      }
    }, 5000);
    return () => clearTimeout(handler);
  }, [isAuthed, setTokens]);
  return null;
};

const App = ({ connector }: { connector: ConnectorAdapter }) => {
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [hostname, setHostname] = useState<string | null>(null);

  useEffect(() => {
    void ensureTokens()
      .then((t) => setTokens(t))
      .catch(() => null);
  }, []);

  const observe = useCallback(() => {
    let debounceTimer: number | NodeJS.Timeout | undefined;
    let lastDns: string | null = null;
    let spaObserver: MutationObserver | null = null;
    const observers: MutationObserver[] = [];

    const emit = (): void => {
      if (debounceTimer) clearTimeout(debounceTimer as number);
      debounceTimer = setTimeout(() => {
        const dns = connector.extractHostname({ win: window, doc: document });
        if (dns === lastDns) return;
        lastDns = dns ?? null;
        setHostname(dns);
        if (dns) log(`Loading hostname ${dns}`);
      }, 1000);
    };

    const install = (): void => {
      observers.forEach((o) => o.disconnect());
      observers.length = 0;
      connector.observableSelectors.forEach((sel) => {
        const els = document.querySelectorAll(sel);
        els.forEach((el) => {
          const o = new MutationObserver(() => emit());
          o.observe(el, {
            childList: true,
            subtree: true,
            characterData: true,
          });
          observers.push(o);
        });
      });
      emit();
    };

    install();

    spaObserver = new MutationObserver(() => {
      for (const anchor of connector.anchorSelectors) {
        const el = document.querySelector(anchor);
        if (el) {
          install();
          break;
        }
      }
    });
    spaObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    const onPop = (): void => emit();
    const onHash = (): void => emit();
    window.addEventListener("popstate", onPop);
    window.addEventListener("hashchange", onHash);

    return () => {
      observers.forEach((o) => o.disconnect());
      spaObserver.disconnect();
      if (debounceTimer) clearTimeout(debounceTimer as number);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("hashchange", onHash);
    };
  }, [connector]);

  useEffect(() => {
    const dispose = observe();
    return () => dispose();
  }, [observe]);

  if (!tokens) {
    return null;
  }

  const storage = {
    getItem: (key: string): string | null => {
      if (key.startsWith("__convexAuthJWT")) return tokens.token;
      if (key.startsWith("__convexAuthRefreshToken"))
        return tokens.refreshToken;
      return localStorage.getItem(key);
    },
    setItem: (key: string, value: string): void => {
      if (key.startsWith("__convexAuthJWT")) return;
      if (key.startsWith("__convexAuthRefreshToken")) return;
      localStorage.setItem(key, value);
    },
    removeItem: (key: string): void => {
      if (key.startsWith("__convexAuthJWT")) return;
      if (key.startsWith("__convexAuthRefreshToken")) return;
      localStorage.removeItem(key);
    },
  };

  return (
    <ConvexAuthProvider client={convex} storage={storage}>
      <Utils setTokens={setTokens} />
      <connector.widget hostname={hostname} />
    </ConvexAuthProvider>
  );
};

function ensureHeadStylesOnce() {
  const add = (id: string, href: string) => {
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  };
  add(
    "hs-font-syne",
    "https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap",
  );
  add(
    "hs-font-scp",
    "https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@400;500;600;700&display=swap",
  );
  add(
    "hs-font-geist",
    "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap",
  );
}

function createOverlayHost(): ShadowRoot {
  const host = document.createElement("div");
  host.setAttribute("data-hs-overlay-host", "");
  host.style.position = "fixed";
  host.style.left = "0";
  host.style.top = "0";
  host.style.right = "0";
  host.style.bottom = "0";
  host.style.zIndex = "2147483647";
  host.style.pointerEvents = "none";
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host {
      --tw-border-style: solid;
    }
    #hs-portal-root { position: fixed; inset: 0; pointer-events: none; }
    [data-hs-interactive] { pointer-events: auto; }
  `;
  shadow.appendChild(style);
  const mount = document.createElement("div");
  shadow.appendChild(mount);
  shadow.adoptedStyleSheets = [sheet];
  return shadow;
}

const boot = (): void => {
  const connector = selectAdapter(document);
  if (!connector) return;

  let anchor: Element | null = null;
  for (const sel of connector.anchorSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      anchor = el;
      break;
    }
  }
  if (!anchor) return;
  const existing = document.getElementById("hypershelf-widget-root");
  if (existing) return;
  const mainHost = document.createElement("div");
  mainHost.id = "hypershelf-widget-root";
  mainHost.classList.add(`hypershelf__${connector.id}`);
  if (connector.mountStyles) {
    Object.assign(mainHost.style, connector.mountStyles);
  }
  if (connector.anchorPosition === "before") {
    anchor.parentElement?.insertBefore(mainHost, anchor);
  } else if (connector.anchorPosition === "after") {
    anchor.parentElement?.insertBefore(mainHost, anchor.nextSibling);
  } else if (connector.anchorPosition === "instead") {
    anchor.replaceWith(mainHost);
  } else if (connector.anchorPosition === "start") {
    anchor.prepend(mainHost);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  } else if (connector.anchorPosition === "end") {
    anchor.appendChild(mainHost);
  }

  console.log(
    "%c ",
    `
    background-image: url(${connector.banner});
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
    padding-right: 316px;
    padding-bottom: 61px;
  `,
  );
  log(`Mounted connector ${connector.id}`);

  ensureHeadStylesOnce();

  const mainShadow =
    mainHost.shadowRoot ?? mainHost.attachShadow({ mode: "open" });
  const mainStyle = document.createElement("style");
  mainStyle.textContent = `
    :host {
      --tw-border-style: solid;
    }
  `;
  mainShadow.appendChild(mainStyle);

  const container = document.createElement("div");
  mainShadow.appendChild(container);
  mainShadow.adoptedStyleSheets = [sheet];

  const overlayShadow = createOverlayHost();

  const root = createRoot(container);
  root.render(
    <ShadowPortalProvider
      mainShadowRoot={mainShadow}
      shadowRoot={overlayShadow}
    >
      <App connector={connector} />
    </ShadowPortalProvider>,
  );
};

setInterval(() => boot(), 250);
