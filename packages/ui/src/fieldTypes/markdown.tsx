import type { Ref } from "react";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useMutation } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  CircleCheck,
  CodeXml,
  Download,
  Eye,
  FileText,
  Loader2,
  Share,
} from "lucide-react";

import type { Id } from "@hypershelf/convex/_generated/dataModel";
import { api } from "@hypershelf/convex/_generated/api";
import { useHypershelf } from "@hypershelf/lib/stores";
import { cn } from "@hypershelf/lib/utils";

import type {
  FieldPropConfig,
  FieldRendererTableCellProps,
  TableCellEditorHandle,
} from "./_abstractType";
import { HotkeyScopeProvider, useScopedHotkeys } from "../hotkeys";
import { MarkdownEditor, MarkdownViewer } from "../markdownEditor";
import { Button } from "../primitives/button";
import { ButtonWithKbd } from "../primitives/kbd-button";
import { Popover, PopoverContent, PopoverTrigger } from "../primitives/popover";
import { toast } from "../Toast";

function MarkdownEditorDialogContent({
  fieldId,
  assetId,
  onClose,
  readonly,
  tableCell,
}: {
  fieldId: Id<"fields">;
  assetId: Id<"assets">;
  onClose: () => void;
  readonly: boolean;
  tableCell?: FieldRendererTableCellProps;
}) {
  const placeholder = useHypershelf(
    (state) => state.fields[fieldId]?.field.extra?.placeholder ?? "",
  );
  const mdPreset = useHypershelf(
    (state) => state.fields[fieldId]?.field.extra?.mdPreset ?? null,
  );
  const value = useHypershelf(
    (state) => state.assets[assetId]?.asset.metadata?.[fieldId],
  );
  const [val, setVal] = useState(value?.toString() ?? mdPreset ?? "");
  const disabled = useHypershelf(
    (state) => !!state.lockedFields[assetId]?.[fieldId],
  );
  const lazyError = useHypershelf(
    (state) => state.assetErrors[assetId]?.[fieldId],
  );

  const updateAsset = useMutation(api.assets.update);
  const [updating, setUpdating] = useState(false);

  const onSave = useCallback(
    (newValue: string) => {
      setUpdating(true);
      setTimeout(() => {
        updateAsset({
          assetId,
          fieldId,
          value: newValue,
        })
          .catch((e) => {
            console.error("Failed to update asset:", e);
            toast.error("Не смогли сохранить поле!");
          })
          .finally(() => {
            setUpdating(false);
            const locker = useHypershelf.getState().assetsLocker;
            void locker.release(assetId, fieldId);
            onClose();
          });
      }, 0);
    },
    [assetId, fieldId, updateAsset, onClose],
  );

  const handleClose = useCallback(() => {
    const locker = useHypershelf.getState().assetsLocker;
    void locker.release(assetId, fieldId);
    onClose();
  }, [assetId, fieldId, onClose]);

  const isDirty = useMemo(
    () =>
      val.toString() !== value?.toString() &&
      val.toString() !== mdPreset?.toString(),
    [val, value, mdPreset],
  );

  return (
    <HotkeyScopeProvider
      scope="dialog"
      blockScopes={["app", "table", "table-editor", "markdown-editor"]}
    >
      <MarkdownDialogHotkeys
        isDirty={isDirty}
        onClose={handleClose}
        onSave={() => onSave(val)}
      />
      <Dialog.Overlay asChild>
        <motion.div
          className="inset-0 fixed z-[9999]"
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            backdropFilter: "blur(4px)",
            background:
              "color-mix(in oklab, var(--background) 60%, transparent)",
          }}
          exit={{
            opacity: 0,
            backdropFilter: "blur(0px)",
            background:
              "color-mix(in oklab, var(--background) 0%, transparent)",
          }}
          transition={{ duration: 0.2 }}
        />
      </Dialog.Overlay>
      <Dialog.Content
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          handleClose();
          tableCell?.onModeChange("navigation");
        }}
        onPointerDownOutside={(e) => e.preventDefault()}
        className="inset-0 p-4 fixed z-[9999] flex items-center justify-center"
      >
        <Dialog.Title>
          <VisuallyHidden>Редактирование маркдаун-поля</VisuallyHidden>
        </Dialog.Title>
        <Dialog.Description>
          <VisuallyHidden>
            Нажмите Ctrl(Cmd)+Shift+Tab, чтобы редактировать, Escape чтобы выйти
            и Ctrl(Cmd)+S чтобы сохранить.
          </VisuallyHidden>
        </Dialog.Description>
        <motion.div
          key={`markdown-editor-${assetId}-${fieldId}`}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{
            opacity: { duration: 0.1 },
            scale: { type: "spring", duration: 0.2, bounce: 0.1 },
          }}
          className="max-w-3xl relative w-full"
        >
          <MarkdownEditor
            value={val}
            placeholder={placeholder}
            disabled={disabled || updating || readonly}
            onChange={setVal}
            className={cn(
              "backdrop-blur-lg max-h-[90vh] overflow-y-auto bg-background/80",
              lazyError && "ring-red-500 ring-2",
            )}
            defaultExpanded={true}
          />
          {lazyError && isDirty && (
            <div className="mt-1 text-sm text-red-500 text-right">
              {lazyError}
            </div>
          )}
          <div className="mt-2 gap-2 flex justify-end">
            <ButtonWithKbd
              variant="outline"
              onClick={handleClose}
              disabled={updating}
              keys={["Esc"]}
            >
              Отмена
            </ButtonWithKbd>
            <ButtonWithKbd
              onClick={() => onSave(val)}
              disabled={disabled || updating || readonly || !isDirty}
              keys={["Meta", "S"]}
              showKbd={isDirty}
            >
              {updating ? (
                <Loader2 className="animate-spin" />
              ) : (
                <CircleCheck />
              )}
              Сохранить
            </ButtonWithKbd>
          </div>
        </motion.div>
      </Dialog.Content>
    </HotkeyScopeProvider>
  );
}

function MarkdownDialogHotkeys({
  isDirty,
  onClose,
  onSave,
}: {
  isDirty: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  useScopedHotkeys(
    [
      {
        hotkey: "Mod+S",
        callback: (event) => {
          event.preventDefault();
          if (isDirty) {
            onSave();
          }
        },
        enabled: isDirty,
        scope: "dialog",
      },
      {
        hotkey: "Escape",
        callback: (event) => {
          event.preventDefault();
          onClose();
        },
        enabled: true,
        scope: "dialog",
      },
    ],
    {
      ignoreInputs: false,
      preventDefault: false,
      stopPropagation: false,
      target: typeof document === "undefined" ? null : document,
    },
  );

  return null;
}

function DownloadButton({
  assetId,
  fieldId,
  readonly,
}: {
  assetId: Id<"assets">;
  fieldId: Id<"fields">;
  readonly: boolean;
}) {
  const mdEditor = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [downloadPdfAvailable, setDownloadPdfAvailable] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingMd, setDownloadingMd] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handler = () => setDownloadPdfAvailable(true);
    window.addEventListener("mdLoaded", handler);
    return () => window.removeEventListener("mdLoaded", handler);
  }, []);

  const value = useHypershelf(
    (state) =>
      state.assets[assetId]?.asset.metadata?.[fieldId] as string | null,
  );
  const hostname = useHypershelf((state) => {
    const hostnameFieldId = Object.values(state.fields).find(
      (f) => f.field.type === "magic__hostname",
    )?.field._id;
    if (!hostnameFieldId) return null;
    return (state.assets[assetId]?.asset.metadata?.[hostnameFieldId] ??
      null) as string | null;
  });

  const downloadMd = useCallback(() => {
    if (!value) return;
    setDownloadingMd(true);
    try {
      const element = document.createElement("a");
      const file = new Blob([value.toString()], { type: "text/markdown" });
      element.href = URL.createObjectURL(file);
      element.download = `${hostname ?? "asset-" + assetId}.md`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } finally {
      setDownloadingMd(false);
    }
  }, [value, assetId, hostname]);

  const downloadPdf = useCallback(async () => {
    if (!value) return;
    const el = mdEditor.current?.querySelector(
      ".markdown-pdf",
    ) as HTMLElement | null;
    if (!el) return;
    setDownloadingPdf(true);
    try {
      await (
        await import("html2pdf.js")
      ).default(el, {
        margin: 0.33,
        filename: `${hostname ?? "asset-" + assetId}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { dpi: 192, letterRendering: true },
        jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
      });
    } finally {
      setDownloadingPdf(false);
    }
  }, [assetId, value, hostname]);

  const copyMdLink = useCallback(() => {
    if (!value) return;
    void navigator.clipboard.writeText(
      // eslint-disable-next-line turbo/no-undeclared-env-vars
      `${process.env.NEXT_PUBLIC_CONVEX_SITE_URL}/markdown/${assetId}/${fieldId}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [value, assetId, fieldId]);

  if (!value) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(readonly && "p-0.5 h-auto")}
          onClick={() => setOpen((o) => !o)}
        >
          <Download className={cn(readonly ? "size-3" : "size-4")} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-fit">
        <div
          className="opacity-0"
          ref={mdEditor}
          style={{
            width: "210mm",
            height: "297mm",
            boxSizing: "border-box",
            position: "absolute",
            top: "-10000px",
            left: "-10000px",
            overflow: "hidden",
          }}
        >
          <MarkdownViewer content={value} />
        </div>
        <div className="gap-2 flex flex-col">
          <Button
            size="sm"
            variant="outline"
            onClick={downloadMd}
            disabled={downloadingMd}
          >
            {downloadingMd ? <Loader2 className="animate-spin" /> : <CodeXml />}
            Download .md
          </Button>
          <Button size="sm" variant="outline" onClick={copyMdLink}>
            {copied ? <Check /> : <Share />}
            Copy link to .md
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={downloadPdf}
            disabled={!downloadPdfAvailable || downloadingPdf}
          >
            {downloadingPdf ? (
              <Loader2 className="animate-spin" />
            ) : (
              <FileText />
            )}
            Download .pdf
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function InlineMarkdown({
  assetId,
  editorRef,
  fieldId,
  readonly = false,
  tableCell,
}: {
  assetId: Id<"assets">;
  editorRef?: Ref<TableCellEditorHandle>;
  fieldId: Id<"fields">;
  readonly?: boolean;
  tableCell?: FieldRendererTableCellProps;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const lockedBy = useHypershelf(
    (state) => state.lockedFields[assetId]?.[fieldId],
  );
  const isEmpty = useHypershelf(
    (state) => !state.assets[assetId]?.asset.metadata?.[fieldId],
  );

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        const locker = useHypershelf.getState().assetsLocker;
        void locker.release(assetId, fieldId);
        tableCell?.onModeChange("navigation");
      }
      setOpen(isOpen);
    },
    [assetId, fieldId, tableCell],
  );

  useImperativeHandle(
    editorRef,
    (): TableCellEditorHandle => ({
      beginEdit: () => {
        tableCell?.onModeChange("editing");
        setOpen(true);
      },
      cancel: () => {
        handleOpenChange(false);
      },
      focus: () => {
        triggerRef.current?.focus();
      },
      kind: "complex",
    }),
    [handleOpenChange, tableCell],
  );

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <div className="gap-2 flex flex-col">
        {lockedBy && (
          <span className="-mt-0.5 absolute -translate-y-full text-[10px] whitespace-pre text-brand">
            {lockedBy}
          </span>
        )}
        <div
          className={cn(
            "flex",
            lockedBy &&
              "cursor-not-allowed text-foreground/70 ring-2 ring-brand",
          )}
        >
          <Dialog.Trigger asChild>
            <Button
              ref={triggerRef}
              variant="ghost"
              size="sm"
              disabled={!!lockedBy}
              className={cn(
                lockedBy && "cursor-not-allowed !opacity-100",
                readonly && "p-0.5 h-auto",
              )}
            >
              {!isEmpty ? (
                <div className="gap-1.5 flex items-center">
                  <Eye className={cn(readonly ? "size-3" : "size-4")} />
                  {!readonly && "Открыть"}
                </div>
              ) : (
                <span className="text-muted-foreground/50 italic">пусто</span>
              )}
            </Button>
          </Dialog.Trigger>
          {/* Download for readonly is not available in the plugin
              context, since the plugins (including the overlay)
              are rendered inside a shadow DOM and html2canvas
              has a hard time transferring styles, thus the
              resulting pdf is a white page */}
          {!isEmpty && !readonly && (
            <DownloadButton
              assetId={assetId}
              fieldId={fieldId}
              readonly={readonly}
            />
          )}
          <AnimatePresence>
            {open && (
              <Dialog.Portal forceMount>
                <MarkdownEditorDialogContent
                  fieldId={fieldId}
                  assetId={assetId}
                  readonly={readonly}
                  onClose={() => handleOpenChange(false)}
                  tableCell={tableCell}
                />
              </Dialog.Portal>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Dialog.Root>
  );
}

const config = {
  cellClipboard: "disabled",
  key: "markdown",
  label: "Маркдаун",
  icon: "text-select",
  fieldProps: ["placeholder", "mdPreset"],
  component: InlineMarkdown,
} as const satisfies FieldPropConfig;

export default config;
