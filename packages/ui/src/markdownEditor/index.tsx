import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  defaultHighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { Compartment, EditorState } from "@codemirror/state";
import {
  placeholder as cmPlaceholder,
  drawSelection,
  EditorView,
  keymap,
} from "@codemirror/view";
import { Table } from "@lezer/markdown";
import { useMutation } from "convex/react";
import { motion } from "framer-motion";
import { ArrowDownFromLine } from "lucide-react";

import type { Id } from "@hypershelf/convex/_generated/dataModel";
import { api } from "@hypershelf/convex/_generated/api";
import { cn } from "@hypershelf/lib/utils";

import { HotkeyScopeProvider } from "../hotkeys";
import { MarkdownCommandPalette } from "./command-palette";
import config from "./markdoc";
import { previewModeFacet } from "./preview-facet";
import richEditor from "./rich-editor";

export interface MarkdownEditorProps {
  value: string;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  defaultExpanded?: boolean;
  preview?: boolean;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value = "",
  onChange = () => null,
  onFocus = () => null,
  disabled = false,
  className = "",
  placeholder,
  defaultExpanded = false,
  preview = false,
}) => {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const attachMetadata = useMutation(api.files.attachMetadata);

  const uploadFiles = useCallback(
    async (files: File[]): Promise<string[]> => {
      const urls: string[] = [];
      for (const file of files) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const { storageId } = (await result.json()) as {
          storageId: Id<"_storage">;
        };
        const { fileId } = await attachMetadata({
          storageId: storageId,
          fileName: file.name,
        });
        urls.push(
          // eslint-disable-next-line turbo/no-undeclared-env-vars
          `${process.env.NEXT_PUBLIC_CONVEX_SITE_URL}/getfile/${fileId}.${file.name.split(".").pop()}`,
        );
      }
      return urls;
    },
    [generateUploadUrl, attachMetadata],
  );

  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isInFocus, setIsInFocus] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const valueRef = useRef(value);
  const placeholderRef = useRef(placeholder);
  const onChangeRef = useRef(onChange);
  const onFocusRef = useRef(onFocus);
  const disabledRef = useRef(disabled);
  const previewRef = useRef(preview);

  const editableCompartment = useRef(new Compartment()).current;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onFocusRef.current = onFocus;
  }, [onFocus]);

  useEffect(() => {
    if (viewRef.current || !containerRef.current) return;
    const previewCompartment = new Compartment();

    const state = EditorState.create({
      doc: valueRef.current,
      extensions: [
        previewCompartment.of(previewModeFacet.of(previewRef.current)),
        richEditor({
          markdoc: config,
          lezer: { codeLanguages: languages, extensions: [Table] },
        }),
        EditorView.lineWrapping,
        editableCompartment.of(EditorView.editable.of(!disabled)),
        history(),
        indentOnInput(),
        drawSelection(),
        cmPlaceholder(placeholderRef.current ?? "Type here..."),
        syntaxHighlighting(defaultHighlightStyle),
        keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newDoc = update.state.doc.toString();
            if (newDoc !== valueRef.current) {
              valueRef.current = newDoc;
              onChangeRef.current(newDoc);
            }
          }
          if (update.focusChanged) {
            setIsInFocus(update.view.hasFocus);
          }
          if (update.focusChanged && update.view.hasFocus) {
            onFocusRef.current();
            setIsExpanded(true);
          }
        }),
      ],
    });

    viewRef.current = new EditorView({ state, parent: containerRef.current });

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [editableCompartment, disabled]);

  useEffect(() => {
    if (!viewRef.current) return;

    if (value !== valueRef.current) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: value,
        },
      });
      valueRef.current = value;
    }
  }, [value]);

  useEffect(() => {
    if (!viewRef.current || disabled === disabledRef.current) return;

    viewRef.current.dispatch({
      effects: editableCompartment.reconfigure(
        EditorView.editable.of(!disabled),
      ),
    });
    disabledRef.current = disabled;
  }, [disabled, editableCompartment]);

  useEffect(() => {
    const insertAt = (pos: number, urls: string[]) => {
      if (!viewRef.current) return;
      const md = urls.map((u) => `!((${u}))`).join("\n") + "\n";
      viewRef.current.dispatch({ changes: { from: pos, insert: md } });
      viewRef.current.focus();
    };

    const handlePaste = async (e: ClipboardEvent) => {
      if (!viewRef.current) return;
      const files = Array.from(e.clipboardData?.files ?? []);
      if (!files.length) return;
      e.preventDefault();
      const urls = await uploadFiles(files);
      insertAt(viewRef.current.state.selection.main.to, urls);
    };

    const handleDrop = async (e: DragEvent) => {
      if (!viewRef.current) return;
      const imgs = Array.from(e.dataTransfer?.files ?? []);
      if (!imgs.length) return;
      e.preventDefault();
      const urls = await uploadFiles(imgs);
      insertAt(viewRef.current.state.selection.main.to, urls);
    };

    if (!viewRef.current) return;
    viewRef.current.dom.addEventListener("paste", (e) => void handlePaste(e));
    viewRef.current.dom.addEventListener("drop", (e) => void handleDrop(e));

    return () => {
      if (!viewRef.current) return;
      viewRef.current.dom.removeEventListener(
        "paste",
        (e) => void handlePaste(e),
      );
      viewRef.current.dom.removeEventListener(
        "drop",
        (e) => void handleDrop(e),
      );
    };
  }, [generateUploadUrl, uploadFiles]);

  return (
    <HotkeyScopeProvider scope="markdown-editor">
      <div
        className={cn(
          "p-3 rounded-md border border-input bg-input/30",
          className,
        )}
      >
        <motion.div
          ref={containerRef}
          className="markdown-editor relative mx-auto max-w-[700px] overflow-hidden transition-[mask] duration-200"
          style={
            !isExpanded && !isInFocus
              ? {
                  mask: "linear-gradient(to bottom,black 1.5rem,transparent 100%)",
                }
              : {}
          }
          initial={{
            height: defaultExpanded ? "initial" : 80,
            opacity: defaultExpanded ? 0.5 : 1,
          }}
          animate={{
            height: isExpanded || isInFocus || defaultExpanded ? "initial" : 80,
            opacity: 1,
          }}
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
        >
          {!defaultExpanded && (
            <motion.button
              initial={{ rotate: 0 }}
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
              className={cn(
                "right-2 rounded-2xl p-1 shadow-md hover:shadow-lg absolute z-10 cursor-pointer transition-colors hover:bg-input",
                isExpanded ? "bottom-2" : "top-2",
              )}
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <ArrowDownFromLine className="size-4" />
            </motion.button>
          )}
        </motion.div>
        <MarkdownCommandPalette
          enabled={isInFocus && !disabled}
          viewRef={viewRef}
          isInFocus={isInFocus}
        />
      </div>
    </HotkeyScopeProvider>
  );
};

MarkdownEditor.displayName = "MarkdownEditor";

const MarkdownViewer: React.FC<{ content: string; className?: string }> = ({
  content,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (viewRef.current || !containerRef.current) return;
    const state = EditorState.create({
      doc: content,
      extensions: [
        richEditor({
          markdoc: config,
          lezer: { codeLanguages: languages, extensions: [Table] },
          // readonly: true,
        }),
        EditorView.lineWrapping,
        EditorView.editable.of(false),
        drawSelection(),
        syntaxHighlighting(defaultHighlightStyle),
      ],
    });

    viewRef.current = new EditorView({ state, parent: containerRef.current });

    setTimeout(() => {
      void (async () => {
        if (!viewRef.current) return;
        const imgs = Array.from(viewRef.current.dom.querySelectorAll("img"));
        for (const img of imgs) {
          if (img.src.startsWith("data:")) continue;
          try {
            const response = await fetch(img.src);
            if (!response.ok) continue;
            const blob = await response.blob();
            if (!blob.type.startsWith("image/")) continue;

            await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                if (typeof reader.result === "string") {
                  img.src = reader.result;
                }
                resolve(true);
              };
              reader.onerror = () => resolve(true);
              reader.readAsDataURL(blob);
            });
          } catch (e) {
            console.error(e);
          }
        }
        window.dispatchEvent(new Event("mdLoaded"));
      })();
    }, 500);

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [content]);

  useEffect(() => {
    if (!viewRef.current) return;

    if (content !== viewRef.current.state.doc.toString()) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: content,
        },
      });
    }
  }, [content]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "markdown-editor markdown-pdf mx-auto max-w-[700px]",
        className,
      )}
    />
  );
};

export { MarkdownEditor, MarkdownViewer };
export default MarkdownEditor;
