"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  HardDrive,
  Lightbulb,
  ListFilter,
  Loader2,
  SearchIcon,
} from "lucide-react";

import type { IndexedVM } from "@hypershelf/convex/schema";
import { useHypershelf } from "@hypershelf/lib/stores";
import { cn } from "@hypershelf/lib/utils";
import { useScopedHotkeys } from "@hypershelf/ui/hotkeys";
import { HypershelfIcon, VSphereIcon } from "@hypershelf/ui/icons";
import { Button } from "@hypershelf/ui/primitives/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@hypershelf/ui/primitives/input-group";
import { Kbd } from "@hypershelf/ui/primitives/kbd";
import { ButtonWithKbd } from "@hypershelf/ui/primitives/kbd-button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@hypershelf/ui/primitives/popover";

function VSphereVM({ vm }: { vm: IndexedVM }) {
  const [open, setOpen] = useState(false);
  const existsOnHypershelf = useHypershelf((state) => {
    const hostnameField = state.magicFields.magic__hostname;
    const ipField = state.magicFields.magic__ip;
    return Boolean(
      hostnameField &&
      ipField &&
      (Object.values(state.assets).find(
        (a) => a.asset.metadata?.[hostnameField] === vm.hostname,
      ) ??
        Object.values(state.assets).find(
          (a) => a.asset.metadata?.[ipField] === vm.primaryIp,
        )),
    );
  });

  return (
    <motion.div
      className="p-2 w-full cursor-pointer rounded-md border border-border select-none"
      role="combobox"
      aria-expanded={open}
      onClick={() => setOpen((o) => !o)}
      whileHover={{ y: -1 }}
      whileTap={{ y: 1 }}
      transition={{ type: "spring", bounce: 0.2, duration: 0.2 }}
    >
      <div className="flex items-center justify-between">
        <div className="gap-1 flex items-center">
          <VSphereIcon colored={true} className="size-3.5" />
          {existsOnHypershelf && (
            <div className="relative flex">
              <HypershelfIcon className="size-3.5" />
              <div className="bottom-0 left-0 rounded absolute h-px w-full bg-brand" />
            </div>
          )}
          <div className="font-medium text-sm">{vm.hostname}</div>
        </div>
        <ChevronDown
          className={cn(
            "size-3 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </div>
      <AnimatePresence initial={false}>
        {!open && vm.primaryIp && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", bounce: 0.3, duration: 0.3 }}
            className="text-xs text-muted-foreground"
          >
            {vm.primaryIp}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 4 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ type: "spring", bounce: 0.3, duration: 0.3 }}
          >
            <div className="px-1">
              {vm.ips?.map((ip) => (
                <motion.div
                  transition={{ duration: 0.15 }}
                  key={ip}
                  className="text-xs text-muted-foreground"
                >
                  {ip}
                </motion.div>
              ))}
              <div className="my-1.5 h-px w-full bg-border"></div>
              {vm.portgroup && (
                <div className="text-xs text-muted-foreground">
                  Портгруппа: {vm.portgroup}
                </div>
              )}
              {vm.cluster && (
                <div className="text-xs text-muted-foreground">
                  Кластер: {vm.cluster}
                </div>
              )}
              {vm.guestOs && (
                <div className="text-xs text-muted-foreground">
                  Гостевая ОС: {vm.guestOs}
                </div>
              )}
              {vm.memoryMb && (
                <div className="text-xs text-muted-foreground">
                  RAM: {vm.memoryMb} МБ
                </div>
              )}
              {vm.cpuCores && (
                <div className="text-xs text-muted-foreground">
                  CPU: {vm.cpuCores}
                </div>
              )}
            </div>
            {vm.drives.length > 0 && (
              <div className="text-xs gap-1 mt-2 grid grid-cols-3 text-center text-muted-foreground">
                {vm.drives.map((d, i) => (
                  <div
                    key={i}
                    className="px-1 py-2 rounded flex flex-col items-center border border-border"
                  >
                    <HardDrive className="size-4 mb-1" />
                    <div>{d.sizeGb} ГБ</div>
                    <div className="text-[0.7rem] text-muted-foreground/70">
                      {d.thin ? "Thin" : "Thick"} provisioned
                    </div>
                    <div className="text-[0.7rem] text-muted-foreground/70">
                      {d.datastore}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {vm.snaps?.length && (
              <div className="mt-2 w-full">
                <div className="text-xs text-muted-foreground/70">Снапы:</div>
                <div className="text-xs gap-1 mt-1 flex w-full flex-col text-center text-muted-foreground">
                  {vm.snaps.map((s, i) => (
                    <div
                      key={i}
                      className="px-2 py-1 rounded gap-3 flex w-full items-center justify-between border border-border whitespace-pre"
                    >
                      <div className="gap-3 flex items-center">
                        <div className="font-medium max-w-48 truncate">
                          {s.name}
                        </div>
                        {s.description && (
                          <div className="max-w-32 truncate text-[0.7rem] text-muted-foreground/70">
                            {s.description}
                          </div>
                        )}
                      </div>
                      <div className="text-[0.7rem] text-muted-foreground/70">
                        {formatDistanceToNow(new Date(s.createTime), {
                          addSuffix: true,
                          locale: ru,
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function Search({ expanded }: { expanded?: boolean }) {
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState(false);
  const [displayVSphere, setDisplayVSphere] = useState(true);

  const search = useHypershelf((state) => state.search);
  const setSearch = useHypershelf((state) => state.setSearch);
  const isFiltering = useHypershelf((state) => state.isFiltering);
  const setIsFiltering = useHypershelf((state) => state.setIsFiltering);
  const searchResultsVSphere = useHypershelf(
    (state) => state.searchResultsVSphere,
  );

  const [inputValue, setInputValue] = useState(search);

  useEffect(() => {
    setInputValue(search);
  }, [search]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (search !== inputValue) {
        setSearch(inputValue);
        setDebounced(false);
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [inputValue, setSearch, search]);

  useScopedHotkeys(
    [
      {
        hotkey: "Mod+K",
        callback: () => {
          setOpen(true);
        },
        scope: "app",
      },
      {
        hotkey: "Mod+Shift+V",
        callback: () => {
          setDisplayVSphere((value) => !value);
        },
        enabled: open,
        scope: "app",
      },
      {
        hotkey: "Mod+Shift+F",
        callback: () => {
          setIsFiltering(!isFiltering);
        },
        enabled: open,
        scope: "app",
      },
      {
        hotkey: "Mod+Escape",
        callback: () => {
          setOpen(false);
          setSearch("");
          setInputValue("");
        },
        enabled: open,
        scope: "app",
      },
      {
        hotkey: "Escape",
        callback: () => {
          setOpen(false);
        },
        enabled: open,
        scope: "app",
      },
    ],
    {
      ignoreInputs: true,
      meta: {
        name: "Search",
      },
    },
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {expanded ? (
          <Button variant="ghost" size="sm">
            <SearchIcon
              className={cn(search.trim().length ? "text-brand" : "opacity-50")}
            />
            Поиск
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="!p-1 !size-auto">
            <SearchIcon
              className={cn(
                "size-4",
                search.trim().length ? "text-brand" : "opacity-50",
              )}
            />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="max-w-xl gap-1 z-[9999] flex w-fit flex-col items-center"
        side="bottom"
        collisionPadding={8}
        sideOffset={8}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <InputGroup>
          <InputGroupInput
            autoFocus
            type="text"
            placeholder="Найдется все"
            className="w-48"
            value={inputValue}
            onChange={(e) => {
              setInputValue(String(e.target.value));
              setDebounced(true);
            }}
          />
          <InputGroupAddon>
            {debounced ? (
              <Loader2 className="animate-spin size-4" />
            ) : (
              <SearchIcon className="size-4" />
            )}
          </InputGroupAddon>
          <InputGroupAddon align="inline-end">
            <ButtonWithKbd
              size="sm"
              variant="ghost"
              onClick={() => {
                setInputValue("");
                setSearch("");
              }}
              keys={["Meta", "Esc"]}
            >
              Очистить
            </ButtonWithKbd>
          </InputGroupAddon>
        </InputGroup>
        <div className="text-xs mt-1 gap-1 flex w-full items-center justify-center text-muted-foreground select-none">
          <Lightbulb className="size-3" />
          <div className="w-fit">
            Нажми <Kbd keys={["Esc"]} variant="ghost" /> чтобы закрыть поиск.
            Запрос сохранится.
          </div>
        </div>
        <ButtonWithKbd
          className="mt-2"
          size="sm"
          variant="outline"
          onClick={() => setDisplayVSphere((v) => !v)}
          keys={["Meta", "Shift", "V"]}
        >
          <VSphereIcon colored={displayVSphere} />
          {displayVSphere ? "Скрыть" : "Показать"} результаты из vSphere
        </ButtonWithKbd>
        <ButtonWithKbd
          className="mt-1"
          size="sm"
          variant="outline"
          onClick={() => setIsFiltering(!isFiltering)}
          keys={["Meta", "Shift", "F"]}
        >
          <ListFilter className={cn(isFiltering && "text-brand")} />
          {isFiltering ? "Выключить" : "Включить"} фильтры
        </ButtonWithKbd>
        {displayVSphere && searchResultsVSphere.length > 0 && (
          <div className="max-h-96 mt-2 gap-2 flex w-full flex-col overflow-y-auto pt-px">
            {searchResultsVSphere.map((vm) => (
              <VSphereVM vm={vm} key={vm.moid} />
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
