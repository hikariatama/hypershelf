"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  GitBranch,
  LogIn,
  LogOut,
  Plug,
  Settings2,
  Table2,
} from "lucide-react";

import { api } from "@hypershelf/convex/_generated/api";
import { cn } from "@hypershelf/lib/utils";

import { convex } from "./ConvexClientProvider";
import { useHeaderContent } from "./util/HeaderContext";

function NavLink({
  href,
  children,
  label,
}: {
  href: string;
  children: React.ReactNode;
  label: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (href === pathname) return;
    setIsNavigating(true);
    router.push(href);
  };

  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  return (
    <motion.div
      initial={{ scale: 1 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: "spring", bounce: 0.3, duration: 0.3 }}
      tabIndex={-1}
    >
      <Link
        href={href}
        className={cn(
          "group p-1 relative block cursor-pointer overflow-x-hidden rounded-md outline-0 focus-visible:ring-2 focus-visible:ring-ring/50",
          href === pathname && "text-brand",
        )}
        onClick={handleClick}
        aria-label={label}
        role="button"
      >
        {children}
        <div
          className={cn("bottom-0.5 left-0 absolute h-[1px] w-full bg-brand", {
            "animate-load": isNavigating,
            "origin-left scale-x-0 transform transition-transform duration-100 group-hover:scale-x-100":
              !isNavigating,
          })}
        />
      </Link>
    </motion.div>
  );
}

export default function Header() {
  const [isConnected, setIsConnected] = useState(false);
  const currentUser = useQuery(api.auth.getCurrentUser);
  const pathname = usePathname();

  useEffect(() => {
    const checkConnection = () => {
      const connectionState = convex.connectionState();
      setIsConnected(connectionState.isWebSocketConnected);
    };

    checkConnection();
    const interval = setInterval(checkConnection, 1000);

    return () => clearInterval(interval);
  }, []);

  const { isAuthenticated } = useConvexAuth();
  const { content } = useHeaderContent();

  return (
    <header className="fixed z-[9999] w-screen">
      <div className="m-2 h-8 px-4 py-1.5 backdrop-blur-xl flex items-center justify-between rounded-md border border-border bg-background/60 text-foreground">
        <div className="md:gap-8 flex items-center">
          <Link
            href="/"
            className="p-1 text-xs font-extrabold relative rounded-md font-title outline-0 focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <span className="md:inline hidden">Hypershelf</span>
            <span className="md:hidden inline">H</span>
            <div
              className={cn(
                "md:!bg-brand bottom-1 left-1 h-0.5 w-4 absolute bg-brand",
                {
                  "bg-red-500": !isConnected,
                },
              )}
            ></div>
          </Link>
          <div className="gap-1.5 md:flex hidden items-center">
            <div
              className={cn("h-1.5 w-1.5 rounded-full", {
                "bg-green-500": isConnected,
                "bg-red-500": !isConnected,
              })}
            ></div>
            <div className="text-xs text-muted-foreground">
              {isConnected ? "Онлайн" : "Переподключаемся..."}
            </div>
          </div>
        </div>
        {content}
        <nav>
          <div className="gap-x-2 md:gap-x-6 text-xs font-medium flex">
            {pathname !== "/signin" && (
              <>
                <NavLink href="/" label="Хосты">
                  <span className="lg:inline hidden">Хосты</span>
                  <Table2 className="size-4 lg:hidden inline" />
                </NavLink>
                <NavLink href="/fields" label="Поля">
                  <span className="lg:inline hidden">Поля</span>
                  <Settings2 className="size-4 lg:hidden inline" />
                </NavLink>
                <NavLink href="/schemas" label="Схемы">
                  <span className="lg:inline hidden">Схемы</span>
                  <GitBranch className="size-4 lg:hidden inline" />
                </NavLink>
                <NavLink href="/integrations" label="Интеграции">
                  <span className="lg:inline hidden">Интеграции</span>
                  <Plug className="size-4 lg:hidden inline" />
                </NavLink>
              </>
            )}
            {pathname !== "/signin" &&
              (isAuthenticated ? (
                <>
                  <NavLink href="/signout" label="Выйти">
                    <span className="lg:inline hidden">Выйти</span>
                    <LogOut className="size-4 lg:hidden inline text-destructive" />
                  </NavLink>
                  <div className="p-1 text-xs md:block hidden text-muted-foreground">
                    {currentUser?.email ?? "..."}
                  </div>
                </>
              ) : (
                <NavLink href="/signin" label="Войти">
                  <span className="lg:inline hidden">Войти</span>
                  <LogIn className="size-4 lg:hidden inline" />
                </NavLink>
              ))}
          </div>
        </nav>
      </div>
    </header>
  );
}
