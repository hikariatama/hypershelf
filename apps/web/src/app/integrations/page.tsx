"use client";

import type { DragEndEvent } from "@dnd-kit/core";
import type { IconName } from "lucide-react/dynamic";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery } from "convex/react";
import { isEqual } from "lodash";
import { CheckCircle2, GripVertical } from "lucide-react";
import { DynamicIcon } from "lucide-react/dynamic";
import { useStoreWithEqualityFn } from "zustand/traditional";

import type { Id } from "@hypershelf/convex/_generated/dataModel";
import { api } from "@hypershelf/convex/_generated/api";
import { useHypershelf } from "@hypershelf/lib/stores";
import { cn } from "@hypershelf/lib/utils";
import { AnimatedEyeIcon } from "@hypershelf/ui/icons";
import { Button } from "@hypershelf/ui/primitives/button";
import { Skeleton } from "@hypershelf/ui/primitives/skeleton";
import { toast } from "@hypershelf/ui/toast";

import { useHeaderContent } from "~/components/util/HeaderContext";

type ExtensionInfo = {
  name: string;
  version: string | null;
};

type ExtensionReadyDetail = {
  name?: string;
  version?: string;
};

type FieldRow = {
  id: Id<"fields">;
  name: string;
  icon: string | undefined;
};

function getEventDetail(event: Event): ExtensionReadyDetail {
  if (!(event instanceof CustomEvent)) return {};
  if (!event.detail || typeof event.detail !== "object") return {};
  return event.detail as ExtensionReadyDetail;
}

function FieldLayoutRow({
  field,
  hidden,
  onToggle,
}: {
  field: FieldRow;
  hidden: boolean;
  onToggle: (fieldId: Id<"fields">) => void;
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: field.id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "pl-2 pr-1 py-1 text-sm flex items-center rounded-md border border-border bg-background text-foreground",
        isDragging && "opacity-60",
      )}
    >
      <DynamicIcon
        name={(field.icon ?? "circle") as IconName}
        className="mr-2 size-4 shrink-0 text-muted-foreground"
      />
      <div
        className={cn(
          "min-w-0 font-medium flex-1 truncate",
          hidden && "text-muted-foreground",
        )}
      >
        {field.name}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onToggle(field.id)}
        className="ml-2 size-6! p-0! text-muted-foreground"
        aria-label={hidden ? "Показать поле" : "Скрыть поле"}
      >
        <AnimatedEyeIcon isHidden={hidden} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="ml-1 size-6! p-0! cursor-grab active:cursor-grabbing"
        aria-label="Переместить поле"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4 text-muted-foreground" />
      </Button>
    </div>
  );
}

function ExtensionStatus({
  checking,
  extension,
}: {
  checking: boolean;
  extension: ExtensionInfo | null;
}) {
  if (checking) {
    return <Skeleton className="h-18 w-64 rounded-md" />;
  }

  if (extension) {
    return (
      <div className="gap-3 px-4 py-3 flex items-center rounded-md border border-border bg-background">
        <CheckCircle2 className="size-5 text-green-500 shrink-0" />
        <div className="min-w-0">
          <div className="font-medium">Расширение установлено</div>
          <div className="text-sm text-muted-foreground">
            {extension.name}
            {extension.version ? ` ${extension.version}` : ""}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gap-4 p-4 flex flex-col rounded-md border border-border bg-background">
      <div>
        <h2 className="font-semibold">Установка расширения</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Скачай архив, распакуй его и подключи папку расширения в Chrome.
        </p>
      </div>
      <ol className="ml-5 space-y-2 text-sm list-decimal">
        <li>
          Открой <span className="font-mono">chrome://extensions/</span>.
        </li>
        <li>Включи режим разработчика в правом верхнем углу.</li>
        <li>Нажми Load unpacked.</li>
        <li>Выбери распакованную папку расширения.</li>
      </ol>
      <div>
        <Button asChild variant="outline" size="sm">
          <a href="/plugins/hypershelf-vsphere.zip" download>
            Скачать расширение
          </a>
        </Button>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const preferences = useQuery(api.extensionPreferences.get);
  const updatePreferences = useMutation(api.extensionPreferences.update);
  const loadingFields = useHypershelf((state) => state.loadingFields);
  const fields = useStoreWithEqualityFn(
    useHypershelf,
    (state) =>
      state.fieldIds.flatMap((fieldId): FieldRow[] => {
        const field = state.fields[fieldId]?.field;
        if (!field || field.hidden) return [];
        return [
          {
            id: fieldId,
            name: field.name,
            icon: field.extra?.icon,
          },
        ];
      }),
    isEqual,
  );
  const { setContent: setHeaderContent } = useHeaderContent();
  const [extension, setExtension] = useState<ExtensionInfo | null>(null);
  const [checkingExtension, setCheckingExtension] = useState(true);
  const [fieldOrder, setFieldOrder] = useState<Id<"fields">[]>([]);
  const [hiddenFields, setHiddenFields] = useState<Id<"fields">[]>([]);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    setHeaderContent(null);
  }, [setHeaderContent]);

  useEffect(() => {
    const handleExtensionReady = (event: Event) => {
      const detail = getEventDetail(event);
      setExtension({
        name: typeof detail.name === "string" ? detail.name : "Hypershelf",
        version: typeof detail.version === "string" ? detail.version : null,
      });
      setCheckingExtension(false);
    };

    window.addEventListener("hypershelf:extension-ready", handleExtensionReady);
    window.dispatchEvent(new CustomEvent("hypershelf:web-ready"));
    const timeout = window.setTimeout(() => setCheckingExtension(false), 1000);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener(
        "hypershelf:extension-ready",
        handleExtensionReady,
      );
    };
  }, []);

  useEffect(() => {
    if (!preferences) return;
    const availableIds = fields.map((field) => field.id);
    const available = new Set(availableIds);
    const ordered = preferences.fieldOrder.filter((fieldId) =>
      available.has(fieldId),
    );
    const missing = availableIds.filter(
      (fieldId) => !ordered.includes(fieldId),
    );
    setFieldOrder([...ordered, ...missing]);
    setHiddenFields(
      preferences.hiddenFields.filter((fieldId) => available.has(fieldId)),
    );
  }, [fields, preferences]);

  const orderedFields = useMemo(() => {
    const positions = new Map(
      fieldOrder.map((fieldId, index) => [fieldId, index] as const),
    );

    return [...fields].sort((left, right) => {
      const leftPosition = positions.get(left.id);
      const rightPosition = positions.get(right.id);

      if (leftPosition == null && rightPosition == null) return 0;
      if (leftPosition == null) return 1;
      if (rightPosition == null) return -1;

      return leftPosition - rightPosition;
    });
  }, [fields, fieldOrder]);

  const persist = useCallback(
    (nextFieldOrder: Id<"fields">[], nextHiddenFields: Id<"fields">[]) => {
      void updatePreferences({
        fieldOrder: nextFieldOrder,
        hiddenFields: nextHiddenFields,
      }).catch((error) => {
        console.error("Failed to update extension preferences", error);
        toast.error("Не смогли сохранить настройки расширения");
      });
    },
    [updatePreferences],
  );

  const toggleField = useCallback(
    (fieldId: Id<"fields">) => {
      const nextHiddenFields = hiddenFields.includes(fieldId)
        ? hiddenFields.filter((hiddenFieldId) => hiddenFieldId !== fieldId)
        : [...hiddenFields, fieldId];
      setHiddenFields(nextHiddenFields);
      persist(fieldOrder, nextHiddenFields);
    },
    [fieldOrder, hiddenFields, persist],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const from = active.id as Id<"fields">;
      const to = over.id as Id<"fields">;
      const fromIndex = fieldOrder.indexOf(from);
      const toIndex = fieldOrder.indexOf(to);
      if (fromIndex === -1 || toIndex === -1) return;

      const nextFieldOrder = arrayMove(fieldOrder, fromIndex, toIndex);
      setFieldOrder(nextFieldOrder);
      persist(nextFieldOrder, hiddenFields);
    },
    [fieldOrder, hiddenFields, persist],
  );

  const preferencesReady = preferences !== undefined && !loadingFields;

  return (
    <div className="gap-4 flex flex-col">
      <div className="pb-8 mx-auto w-full">
        <div className="gap-4 pt-6 px-2 flex flex-col">
          <h1 className="mx-4 mb-2 text-xl font-extrabold md:text-2xl relative font-title">
            Integrations
            <div className="bottom-0 left-0 h-1 w-6 absolute bg-brand"></div>
          </h1>
          <div className="gap-4 flex items-start">
            <div className="gap-3 px-4 py-3 flex flex-col rounded-md border border-border bg-background">
              <div>
                <h2 className="font-semibold">Поля в расширении</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Универсально применяются ко всем видам виджетов.
                </p>
              </div>
              {!preferencesReady ? (
                <div className="gap-1 flex flex-col">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-11 w-full rounded-md" />
                  ))}
                </div>
              ) : orderedFields.length ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={fieldOrder}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="gap-2 flex flex-col">
                      {orderedFields.map((field) => (
                        <FieldLayoutRow
                          key={field.id}
                          field={field}
                          hidden={hiddenFields.includes(field.id)}
                          onToggle={toggleField}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Нет полей для показа в расширении.
                </div>
              )}
            </div>
            <ExtensionStatus
              checking={checkingExtension}
              extension={extension}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
