"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useQuery } from "convex/react";
import { Annoyed } from "lucide-react";

import { api } from "@hypershelf/convex/_generated/api";
import { useBrowser, useConvex } from "@hypershelf/lib/hooks";
import { useHypershelf } from "@hypershelf/lib/stores";
import { HypershelfHotkeysProvider } from "@hypershelf/ui/hotkeys";
import { Button } from "@hypershelf/ui/primitives/button";
import { toast, Toaster } from "@hypershelf/ui/toast";

import { Footer } from "~/components/Footer";
import Header from "~/components/Header";
import { UpdateNotifier } from "~/components/UpdateNotifier";
import { HeaderContentProvider } from "~/components/util/HeaderContext";
import { env } from "~/env";

const queryClient = new QueryClient();

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useConvex();

  const indexedVMs = useQuery(api.vsphere.getIndexedVMs);
  const setIndexedVMs = useHypershelf((state) => state.setIndexedVMs);

  useEffect(() => {
    if (indexedVMs) {
      setIndexedVMs(indexedVMs);
    }
  }, [indexedVMs, setIndexedVMs]);

  useEffect(() => {
    const loading = toast.loading("Загружаем...");
    const unsubscribe = useHypershelf.subscribe((state) => {
      if (
        !Object.keys(state.assets).length ||
        !Object.keys(state.fields).length ||
        !Object.keys(state.users).length
      ) {
        loading.dismiss();
        unsubscribe();
      }
    });

    return () => {
      unsubscribe();
      loading.dismiss();
    };
  }, []);

  const pathname = usePathname();
  const [insecure, setInsecure] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    fetch(env.NEXT_PUBLIC_CONVEX_URL).catch((e) => {
      if (e instanceof Error && e.message === "Failed to fetch") {
        setInsecure(true);
      }
    });
    const isLocal = ["localhost", "127.0.0.1"].includes(
      window.location.hostname,
    );
    if (
      !isLocal &&
      (window.location.protocol !== "https:" || !window.isSecureContext)
    ) {
      setInsecure(true);
    }
  }, []);

  const browser = useBrowser();
  const [ignore, setIgnore] = useState(false);

  const hasIgnored = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return localStorage.getItem("ignoreFirefoxWarning") === "1";
  }, []);

  if (browser === "trident") {
    return (
      <div className="top-0 right-0 bottom-0 left-0 w-md gap-4 px-6 py-4 fixed m-auto flex h-fit flex-col rounded-md bg-background text-center shadow-[0_0_1rem_oklch(80%_0.188_70.08)]">
        <Image
          src="/images/trident-warning.png"
          alt="Галина"
          width={150}
          height={150}
          className="mx-auto"
        />
        <h1 className="text-2xl font-bold">Запахло ностальгией...</h1>
        <p className="text-sm text-secondary-fg">
          Hypershelf не поддерживает Internet Explorer.
          <br />
          Скачай Chrome.
          <br />
          Не надо брать пример с Галины!
        </p>
      </div>
    );
  }

  if (
    browser === "gecko" &&
    !ignore &&
    hasIgnored !== undefined &&
    !hasIgnored
  ) {
    return (
      <div className="top-0 right-0 bottom-0 left-0 w-md gap-4 px-6 py-4 fixed m-auto flex h-fit flex-col rounded-md bg-background text-center shadow-[0_0_1rem_oklch(80%_0.188_70.08)]">
        <Image
          src="/images/gecko-warning.png"
          alt="Галина"
          width={150}
          height={150}
          className="mx-auto"
        />
        <h1 className="text-2xl font-bold">Огненные лисы!</h1>
        <p className="text-sm text-secondary-fg">
          Hypershelf ломается на многих сборках Firefox.
          <br />
          Пожалуйста, используй Chrome.
          <br />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setIgnore(true);
              localStorage.setItem("ignoreFirefoxWarning", "1");
            }}
            className="mt-4"
          >
            <Annoyed />
            Мне все равно
          </Button>
        </p>
      </div>
    );
  }

  if (insecure) {
    return (
      <div className="top-0 right-0 bottom-0 left-0 w-md gap-4 px-6 py-4 fixed m-auto flex h-fit flex-col rounded-md bg-background text-center shadow-[0_0_1rem_oklch(80%_0.188_70.08)]">
        <Image
          src="/images/ssl-warning.png"
          alt="Галина"
          width={150}
          height={150}
          className="mx-auto"
        />
        <h1 className="text-2xl font-bold">Небезопасное подключение</h1>
        <p className="text-sm text-secondary-fg">
          Приложение не будет работать.
          <br />
          Установи SSL-сертификат и перезагрузи страницу.
        </p>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <HypershelfHotkeysProvider>
        <HeaderContentProvider>
          <Header />
          <main className="px-2 pt-12 min-h-screen">{children}</main>
          {pathname !== "/" && <Footer />}
          <UpdateNotifier />
          <Toaster />
        </HeaderContentProvider>
      </HypershelfHotkeysProvider>
    </QueryClientProvider>
  );
}
