import { useState } from "react";
import { PopoverClose } from "@radix-ui/react-popover";
import { useMutation } from "convex/react";
import { isEqual } from "lodash";
import {
  ChevronDown,
  LoaderCircle,
  Lock,
  Plus,
  Save,
  SaveOff,
  Share2,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useStoreWithEqualityFn } from "zustand/traditional";

import type { Id } from "@hypershelf/convex/_generated/dataModel";
import { api } from "@hypershelf/convex/_generated/api";
import { useHypershelf } from "@hypershelf/lib/stores";
import { useIsViewDirty } from "@hypershelf/lib/stores/hooks";
import { cn } from "@hypershelf/lib/utils";
import { Button } from "@hypershelf/ui/primitives/button";
import { Input } from "@hypershelf/ui/primitives/input";
import { ButtonWithKbd } from "@hypershelf/ui/primitives/kbd-button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@hypershelf/ui/primitives/popover";
import { toast } from "@hypershelf/ui/toast";

function CreateNew({
  callback,
  onClose,
  isLoading,
}: {
  callback: (name: string) => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  const [newViewName, setNewViewName] = useState("");

  return (
    <div className="gap-4 flex flex-col">
      <Input
        placeholder="Название вида"
        value={newViewName}
        onChange={(e) => setNewViewName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && newViewName) {
            callback(newViewName);
          } else if (e.key === "Escape") {
            onClose();
            setNewViewName("");
          }
        }}
        autoFocus
      />
      <div className="gap-2 flex">
        <ButtonWithKbd
          disabled={!newViewName || isLoading}
          onClick={() => callback(newViewName)}
          className="flex-auto"
          keys={["Enter"]}
          showKbd={!!newViewName}
        >
          {isLoading ? <LoaderCircle className="animate-spin" /> : <Plus />}
          Создать
        </ButtonWithKbd>
        <ButtonWithKbd
          variant="outline"
          onClick={() => {
            onClose();
            setNewViewName("");
          }}
          keys={["Esc"]}
        >
          Отмена
        </ButtonWithKbd>
      </div>
    </div>
  );
}

export function ViewSwitcher() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const updateView = useMutation(api.views.update);
  const createView = useMutation(api.views.create);
  const deleteView = useMutation(api.views.remove);

  const views = useStoreWithEqualityFn(
    useHypershelf,
    (state) => state.views,
    isEqual,
  );
  const activeView = useStoreWithEqualityFn(
    useHypershelf,
    (state) => (state.activeViewId ? state.views[state.activeViewId] : null),
    isEqual,
  );
  const activeViewId = useHypershelf((state) => state.activeViewId);
  const setActiveViewId = useHypershelf((state) => state.setActiveViewId);
  const applyView = useHypershelf((state) => state.applyView);

  const isDirty = useIsViewDirty();
  const [open, setOpen] = useState(false);
  const [creatingNewView, setCreatingNewView] = useState(false);

  const updateViewWrapped = () => {
    if (!activeViewId || activeView?.immutable) {
      setCreatingNewView(true);
      return;
    }
    setIsUpdating(true);
    const {
      hiddenFields,
      frozenFields,
      sorting,
      fieldOrder,
      isFiltering,
      filters,
    } = useHypershelf.getState();
    updateView({
      viewId: activeViewId,
      hiddenFields: hiddenFields,
      frozenFields: frozenFields,
      sorting: sorting,
      fieldOrder: fieldOrder,
      enableFiltering: isFiltering,
      filters: filters,
    })
      .catch((e) => {
        console.error("Failed to update view", e);
        toast.error("Не смогли сохранить вид!");
      })
      .finally(() => {
        setOpen(false);
        setIsUpdating(false);
      });
  };

  const createViewWrapped = (name: string) => {
    let data: (typeof createView)["arguments"] = { name: name };
    if (isDirty) {
      const {
        hiddenFields,
        frozenFields,
        sorting,
        fieldOrder,
        isFiltering,
        filters,
      } = useHypershelf.getState();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data = {
        ...data,
        hiddenFields: hiddenFields,
        frozenFields: frozenFields,
        sorting: sorting,
        fieldOrder: fieldOrder,
        enableFiltering: isFiltering,
        filters: filters,
      };
    }
    setIsCreating(true);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    createView(data)
      .then((view) => {
        let retries = 50;
        const interval = setInterval(() => {
          if (setActiveViewId(view)) clearInterval(interval);
          retries--;
          if (retries <= 0) clearInterval(interval);
        }, 100);
      })
      .catch((e) => {
        console.error("Failed to create view", e);
        toast.error("Не смогли создать вид!");
      })
      .finally(() => {
        setIsCreating(false);
        setCreatingNewView(false);
        setOpen(false);
      });
  };

  const deleteViewWrapped = (viewId: Id<"views">) => {
    if (activeViewId === viewId) {
      setActiveViewId(null);
      applyView("builtin:all" as const);
    }
    setIsDeleting(true);
    deleteView({ viewId })
      .catch((e) => {
        console.error("Failed to delete view", e);
        toast.error("Не смогли удалить вид!");
      })
      .finally(() => {
        setIsDeleting(false);
        setOpen(false);
      });
  };

  const revertView = () => {
    if (!activeViewId) {
      applyView("builtin:all" as const);
      return;
    }
    applyView(activeViewId);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="gap-1 py-0 text-xs !h-auto hover:!bg-transparent"
        >
          {activeView?.name ?? "Выбери вид"}
          <ChevronDown className="opacity-60" />
          {isDirty && (
            <SaveOff className="ml-1 size-3 animate-pulse text-yellow-300" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="max-w-sm gap-1 p-2 z-[9999] flex w-fit flex-col text-center"
        side="bottom"
      >
        {isDirty ? (
          <div className="gap-2 px-4 py-2 flex flex-col">
            <div className="px-4 text-xs text-yellow-400">
              Есть несохраненные изменения вида
            </div>
            {(!activeViewId || activeView?.immutable) && (
              <div className="px-4 text-xs text-muted-foreground">
                Сохранение создаст <b>новый</b> вид из текущего состояния
              </div>
            )}
            <div className="gap-1 flex flex-col justify-center">
              <Popover open={creatingNewView} onOpenChange={setCreatingNewView}>
                <PopoverAnchor asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={updateViewWrapped}
                    disabled={isUpdating || isCreating || isDeleting}
                  >
                    {isUpdating ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <Save />
                    )}
                    Сохранить
                  </Button>
                </PopoverAnchor>
                <PopoverContent className="mt-4 w-80 z-[9999]">
                  <CreateNew
                    callback={createViewWrapped}
                    onClose={() => setCreatingNewView(false)}
                    isLoading={isCreating}
                  />
                </PopoverContent>
              </Popover>
              <Button size="sm" variant="outline" onClick={revertView}>
                <Undo2 />
                Откатить
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                <X />
                Закрыть
              </Button>
            </div>
          </div>
        ) : (
          <div className="min-w-64 gap-1 flex flex-col">
            {Object.values(views).map((view) => {
              const isActive = activeViewId === view._id;
              return (
                <div key={view._id} className="gap-1 flex w-full items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "gap-2 flex-auto text-left",
                      isActive
                        ? "bg-white/10 pointer-events-none"
                        : "hover:bg-white/5",
                    )}
                    onClick={() => {
                      setActiveViewId(view._id);
                      setOpen(false);
                    }}
                  >
                    <span className="truncate">{view.name}</span>
                  </Button>
                  {!view.immutable ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="aspect-square opacity-50 hover:opacity-80"
                          disabled={isActive && isDeleting}
                        >
                          {isActive && isDeleting ? (
                            <LoaderCircle className="animate-spin" />
                          ) : (
                            <Trash2 />
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="mt-4 w-80 z-[99999]">
                        <div className="gap-4 flex flex-col">
                          <div className="text-sm text-center">
                            Ты уверен, что хочешь удалить вид{" "}
                            <span className="font-semibold">{view.name}</span>?
                          </div>
                          <div className="gap-2 flex">
                            <PopoverClose asChild>
                              <Button
                                variant="destructive"
                                className="flex-auto"
                                onClick={() => deleteViewWrapped(view._id)}
                              >
                                <Trash2 />
                                Удалить
                              </Button>
                            </PopoverClose>
                            <PopoverClose asChild>
                              <ButtonWithKbd
                                variant="outline"
                                className="flex-auto"
                                keys={["Esc"]}
                              >
                                <X />
                                Отмена
                              </ButtonWithKbd>
                            </PopoverClose>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : view.global && !view.builtin ? (
                    <div className="size-8 flex items-center justify-center">
                      <Share2 className="size-4 opacity-50" />
                    </div>
                  ) : (
                    <div className="size-8 flex items-center justify-center">
                      <Lock className="size-4 opacity-50" />
                    </div>
                  )}
                </div>
              );
            })}
            <Popover open={creatingNewView} onOpenChange={setCreatingNewView}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setCreatingNewView(true)}
                >
                  <Plus /> Создать новый
                </Button>
              </PopoverTrigger>
              <PopoverContent className="mt-4 w-80">
                <CreateNew
                  callback={createViewWrapped}
                  onClose={() => setCreatingNewView(false)}
                  isLoading={isCreating}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
