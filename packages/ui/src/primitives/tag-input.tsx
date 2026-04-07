import type { DragEndEvent } from "@dnd-kit/core";
import type { KeyboardEvent } from "react";
import React, { useImperativeHandle, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { Plus, X } from "lucide-react";

import { cn } from "@hypershelf/lib/utils";

import { Badge } from "./badge";
import { Button } from "./button";
import { Textarea } from "./textarea";

const SortableTag: React.FC<{
  tag: string;
  onRemove: () => void;
  disabled: boolean;
}> = ({ tag, onRemove, disabled = false }) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: tag,
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="m-0.5 inline-block align-bottom"
      tabIndex={-1}
    >
      <motion.div
        initial={{ scale: 1 }}
        whileTap={{ scale: 0.9 }}
        transition={{
          scale: { type: "spring", bounce: 0.15, duration: 0.15 },
        }}
        tabIndex={-1}
      >
        <Badge variant="outline" className="border-input" asChild>
          <div className="gap-0.5 flex items-center select-none">
            <div
              className="px-0.5 cursor-grab rounded-sm outline-0 focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              {tag}
            </div>

            <Button
              type="button"
              size="icon"
              variant="ghost"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onRemove}
              className="size-4 p-0 focus-visible:ring-2"
              disabled={disabled}
            >
              <X className="size-3" />
            </Button>
          </div>
        </Badge>
      </motion.div>
    </div>
  );
};

const StaticTag: React.FC<{
  tag: string;
  onRemove: () => void;
  disabled: boolean;
}> = ({ tag, onRemove, disabled = false }) => (
  <div className="m-0.5 inline-block align-bottom">
    <Badge variant="secondary" className="gap-1 flex items-center select-none">
      <span className="mr-0.5">{tag}</span>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={onRemove}
        className="size-4 p-0"
        disabled={disabled}
      >
        <X className="size-3" />
      </Button>
    </Badge>
  </div>
);

type DraftResult = {
  tags: string[];
  status: "none" | "added" | "duplicate" | "invalid";
  error: string | null;
};

export type TagInputHandle = {
  blur: () => void;
  commitDraft: () => DraftResult;
  clearDraft: () => void;
  focus: () => void;
  setDraftText: (text: string) => void;
};

export const TagInput = React.forwardRef<
  TagInputHandle,
  {
    tags: string[];
    setTags: (tags: string[]) => void;
    placeholder?: string;
    className?: string;
    draggable?: boolean;
    validateTag?: (tag: string) => string | null;
    disabled?: boolean;
    onFocus?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
    onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
    onDraftChange?: (draft: string) => void;
  }
>(
  (
    {
      tags,
      setTags,
      placeholder = "Add items...",
      className,
      draggable = true,
      validateTag,
      disabled = false,
      onFocus,
      onBlur,
      onDraftChange,
    },
    ref,
  ) => {
    const [value, setValue] = useState("");
    const [isInvalid, setIsInvalid] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = React.useRef<HTMLTextAreaElement>(null);

    const sensors = useSensors(
      useSensor(PointerSensor),
      useSensor(TouchSensor),
      useSensor(KeyboardSensor),
    );

    const addTag = React.useCallback(
      (raw: string): DraftResult => {
        const text = raw.trim();

        if (!text) {
          return {
            tags,
            status: "none",
            error: null,
          };
        }

        if (tags.includes(text)) {
          return {
            tags,
            status: "duplicate",
            error: null,
          };
        }

        const error = validateTag?.(text) ?? null;
        if (error !== null) {
          return {
            tags,
            status: "invalid",
            error,
          };
        }

        return {
          tags: [...tags, text],
          status: "added",
          error: null,
        };
      },
      [tags, validateTag],
    );

    useImperativeHandle(
      ref,
      () => ({
        commitDraft: () => {
          const result = addTag(value);

          if (result.status === "added") {
            setTags(result.tags);
            setValue("");
            onDraftChange?.("");
            setIsInvalid(false);
          } else if (result.status === "invalid") {
            setIsInvalid(true);
          }

          return result;
        },
        clearDraft: () => {
          setValue("");
          onDraftChange?.("");
          setIsEditing(false);
          setIsInvalid(false);
          setIsFocused(false);
          inputRef.current?.blur();
        },
        blur: () => {
          inputRef.current?.blur();
          setIsFocused(false);
        },
        focus: () => {
          setIsEditing(true);
          setTimeout(() => {
            inputRef.current?.focus();
          }, 0);
        },
        setDraftText: (text) => {
          setIsEditing(true);
          setValue(text);
          onDraftChange?.(text);
          setIsInvalid(false);
          setTimeout(() => {
            inputRef.current?.focus();
            const caretPosition = text.length;
            inputRef.current?.setSelectionRange(caretPosition, caretPosition);
          }, 0);
        },
      }),
      [addTag, onDraftChange, setTags, value],
    );

    const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        const result = addTag(value);
        if (result.status === "added") {
          setTags(result.tags);
          setValue("");
          onDraftChange?.("");
          setIsInvalid(false);
        } else if (result.status === "invalid") {
          setIsInvalid(true);
        }
      } else if (e.key === "Backspace" && !value && tags.length) {
        e.preventDefault();
        setTags(tags.slice(0, -1));
      }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
      onDraftChange?.(e.target.value);
      if (isInvalid) {
        setIsInvalid(false);
      }
    };

    const onDragEnd = ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return;
      const oldIdx = tags.indexOf(String(active.id));
      const newIdx = tags.indexOf(String(over.id));
      setTags(arrayMove(tags, oldIdx, newIdx));
    };

    const Tag = draggable ? SortableTag : StaticTag;

    return (
      <div className={cn("p-2 rounded-md border text-center", className)}>
        {draggable ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={tags}
              strategy={rectSortingStrategy}
              disabled={disabled}
            >
              {tags.map((t) => (
                <Tag
                  key={t}
                  tag={t}
                  onRemove={() => setTags(tags.filter((x) => x !== t))}
                  disabled={disabled}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          tags.map((t) => (
            <Tag
              key={t}
              tag={t}
              onRemove={() => setTags(tags.filter((x) => x !== t))}
              disabled={disabled}
            />
          ))
        )}
        <motion.div
          className="m-0.5 inline-block align-bottom"
          animate={isInvalid ? { x: [0, -5, 5, -5, 5, 0] } : {}}
          transition={{ duration: 0.4 }}
        >
          {isEditing ? (
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              transition={{ type: "spring", bounce: 0.15, duration: 0.15 }}
              className="px-2 py-0.5 border border-transparent"
            >
              <Textarea
                value={value}
                onChange={handleInputChange}
                onKeyDown={onKeyDown}
                onBlur={(e) => {
                  if (!e.target.value.trim()) {
                    setIsEditing(false);
                  }
                  setIsFocused(false);
                  onBlur?.(e);
                }}
                placeholder={
                  !isFocused && tags.length > 0 ? undefined : placeholder
                }
                className={cn(
                  "min-w-8 p-0 text-xs border-0 !bg-transparent shadow-none focus-visible:ring-0",
                  isInvalid && "text-red-500",
                )}
                disabled={disabled}
                autosizeFrom={30}
                autosizeTo={150}
                minRows={1}
                maxRows={10}
                ref={inputRef}
                onFocus={(e) => {
                  setIsFocused(true);
                  onFocus?.(e);
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              transition={{ type: "spring", bounce: 0.15, duration: 0.15 }}
              className="flex size-fit"
            >
              <Button
                variant={tags.length === 0 ? "ghost" : "outline"}
                size="sm"
                className={cn(
                  "h-fit w-fit",
                  tags.length === 0 ? "px-2 py-1 text-sm" : "!p-0.5 text-xs",
                )}
                onClick={() => {
                  setIsEditing(true);
                  setTimeout(() => {
                    inputRef.current?.focus();
                  }, 0);
                }}
                disabled={disabled}
              >
                {tags.length === 0 ? (
                  <span className="text-muted-foreground/50 italic">пусто</span>
                ) : (
                  <Plus />
                )}
              </Button>
            </motion.div>
          )}
        </motion.div>
      </div>
    );
  },
);

TagInput.displayName = "TagInput";
