import type { EditorView } from "@codemirror/view";
import type { IconName } from "lucide-react/dynamic";
import { useCallback, useState } from "react";
import { DynamicIcon } from "lucide-react/dynamic";

import { useOS } from "@hypershelf/lib/hooks";

import { useScopedHotkeys } from "../hotkeys";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "../primitives/command";

const TEMPLATES: Record<
  string,
  { title: string; icon: IconName; content: string; pos: number }
> = {
  table: {
    title: "Вставить таблицу",
    icon: "table-2",
    content: "\n||||\n|---|---|---|\n||||\n",
    pos: 2,
  },
  codeblock: {
    title: "Вставить блок кода",
    icon: "code",
    content: "\n```\n```\n",
    pos: 4,
  },
  callout: {
    title: "Вставить инфоблок",
    icon: "message-square-quote",
    content: '\n{% callout type="info" %}\n\n{% /callout %}\n',
    pos: 27,
  },
};

const formattingOptions: Record<
  string,
  {
    title: string;
    keybind: string;
    keybindMac: string;
    hotkey: string;
    format: string;
  }
> = {
  bold: {
    title: "Жирный",
    keybind: "Ctrl+B",
    keybindMac: "⌘B",
    hotkey: "Mod+B",
    format: "**{}**",
  },
  italic: {
    title: "Курсив",
    keybind: "Ctrl+I",
    keybindMac: "⌘I",
    hotkey: "Mod+I",
    format: "*{}*",
  },
  strikethrough: {
    title: "Зачеркнутый",
    keybind: "Ctrl+Shift+S",
    keybindMac: "⌘^S",
    hotkey: "Mod+Shift+S",
    format: "~~{}~~",
  },
  link: {
    title: "Ссылка",
    keybind: "Ctrl+K",
    keybindMac: "⌘K",
    hotkey: "Mod+K",
    format: "[{}]()",
  },
  inlineCode: {
    title: "Встроенный код",
    keybind: "Ctrl+E",
    keybindMac: "⌘E",
    hotkey: "Mod+E",
    format: "`{}`",
  },
  blockquote: {
    title: "Цитата",
    keybind: "Ctrl+Q",
    keybindMac: "⌘Q",
    hotkey: "Mod+Q",
    format: "> {}\n",
  },
  heading1: {
    title: "Заголовок 1",
    keybind: "Ctrl+1",
    keybindMac: "⌘1",
    hotkey: "Mod+1",
    format: "# {}\n",
  },
  heading2: {
    title: "Заголовок 2",
    keybind: "Ctrl+2",
    keybindMac: "⌘2",
    hotkey: "Mod+2",
    format: "## {}\n",
  },
  heading3: {
    title: "Заголовок 3",
    keybind: "Ctrl+3",
    keybindMac: "⌘3",
    hotkey: "Mod+3",
    format: "### {}\n",
  },
  heading4: {
    title: "Заголовок 4",
    keybind: "Ctrl+4",
    keybindMac: "⌘4",
    hotkey: "Mod+4",
    format: "#### {}\n",
  },
  heading5: {
    title: "Заголовок 5",
    keybind: "Ctrl+5",
    keybindMac: "⌘5",
    hotkey: "Mod+5",
    format: "##### {}\n",
  },
  unorderedList: {
    title: "Ненумерованный список",
    keybind: "Ctrl+Shift+U",
    keybindMac: "⌘^U",
    hotkey: "Mod+Shift+U",
    format: "- {}\n",
  },
  orderedList: {
    title: "Нумерованный список",
    keybind: "Ctrl+Shift+O",
    keybindMac: "⌘^O",
    hotkey: "Mod+Shift+O",
    format: "1. {}\n",
  },
  taskList: {
    title: "Список задач",
    keybind: "Ctrl+Shift+T",
    keybindMac: "⌘^T",
    hotkey: "Mod+Shift+T",
    format: "- [ ] {}\n",
  },
};

const wrappingSymbols = {
  "`": "``",
  "(": "()",
  "*": "**",
  "[": "[]",
  "{": "{}",
  "~": "~~",
  '"': '""',
  "'": "''",
};

export function MarkdownCommandPalette({
  enabled,
  viewRef,
  isInFocus,
}: {
  enabled?: boolean;
  viewRef?: React.RefObject<EditorView | null>;
  isInFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const os = useOS();
  const editorTarget = viewRef?.current?.dom ?? null;
  const hotkeysEnabled = Boolean(enabled && ((isInFocus ?? false) || open));

  const handleSelect = (
    template: (typeof TEMPLATES)[keyof typeof TEMPLATES],
  ) => {
    setOpen(false);
    if (!viewRef?.current) return;
    const view = viewRef.current;
    const pos = view.state.selection.main.head;
    view.dispatch(
      view.state.update({
        changes: { from: pos, insert: template.content },
        scrollIntoView: true,
      }),
    );
    setTimeout(() => {
      view.focus();
      const newPos = pos + template.pos;
      view.dispatch(
        view.state.update({
          selection: { anchor: newPos, head: newPos },
          scrollIntoView: true,
        }),
      );
    }, 0);
  };

  const applyFormatting = useCallback(
    (format: string) => {
      setOpen(false);
      if (!viewRef?.current) return;
      const view = viewRef.current;
      const selection = view.state.selection.main;
      const from = selection.from;
      const to = selection.to;
      const selectedText = view.state.doc.sliceString(from, to);
      const formattedText = format.replace("{}", selectedText || "");
      view.dispatch(
        view.state.update({
          changes: { from, to, insert: formattedText },
          selection: {
            anchor: from + format.indexOf("}") - 1,
            head: to + format.indexOf("}") - 1,
          },
          scrollIntoView: true,
        }),
      );
      setTimeout(() => {
        view.focus();
      }, 0);
    },
    [viewRef],
  );

  useScopedHotkeys(
    [
      {
        hotkey: "Mod+P",
        callback: (event) => {
          event.preventDefault();
          setOpen(true);
        },
        enabled: Boolean(enabled && isInFocus),
        scope: "markdown-editor",
      },
      {
        hotkey: "Escape",
        callback: (event) => {
          event.preventDefault();
          setOpen(false);
        },
        enabled: open,
        scope: "markdown-editor",
      },
    ],
    {
      ignoreInputs: false,
      target: typeof document === "undefined" ? null : document,
    },
  );

  useScopedHotkeys(
    Object.values(formattingOptions).map((option) => ({
      hotkey: option.hotkey,
      callback: (event) => {
        event.preventDefault();
        event.stopPropagation();
        applyFormatting(option.format);
      },
      enabled: hotkeysEnabled,
      scope: "markdown-editor" as const,
    })),
    {
      ignoreInputs: false,
      preventDefault: false,
      stopPropagation: false,
      target: editorTarget,
    },
  );

  useScopedHotkeys(
    Object.entries(wrappingSymbols).map(([trigger, format]) => ({
      hotkey: trigger,
      callback: (event) => {
        if (!viewRef?.current) return;
        const view = viewRef.current;
        const selection = view.state.selection.main;
        if (selection.empty) return;
        event.preventDefault();
        event.stopPropagation();
        const from = selection.from;
        const to = selection.to;
        const selectedText = view.state.doc.sliceString(from, to);
        const wrappedText = `${format[0]}${selectedText}${format[1]}`;
        view.dispatch(
          view.state.update({
            changes: { from, to, insert: wrappedText },
            selection: {
              anchor: from + 1,
              head: to + 1,
            },
            scrollIntoView: true,
          }),
        );
      },
      enabled: hotkeysEnabled,
      scope: "markdown-editor" as const,
    })),
    {
      ignoreInputs: false,
      preventDefault: false,
      stopPropagation: false,
      target: editorTarget,
    },
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen} className="z-[9999999]">
      <CommandInput placeholder="Search commands..." />
      <CommandList className="w-full">
        <CommandEmpty>Ничего не нашли</CommandEmpty>
        <CommandGroup heading="Шаблоны" className="w-full">
          {Object.entries(TEMPLATES).map(([key, template]) => (
            <CommandItem
              key={key}
              onSelect={() => handleSelect(template)}
              className="transition-colors duration-75 [&[data-selected=true]]:bg-accent [&[data-selected=true]]:text-accent-foreground"
            >
              <DynamicIcon name={template.icon} />
              {template.title}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Форматирование" className="w-full">
          {Object.entries(formattingOptions).map(([key, option]) => (
            <CommandItem
              key={key}
              onSelect={() => applyFormatting(option.format)}
              className="transition-colors duration-75 [&[data-selected=true]]:bg-accent [&[data-selected=true]]:text-accent-foreground"
            >
              <span className="gap-2 flex items-center">{option.title}</span>
              <CommandShortcut>
                {os === "macos" ? option.keybindMac : option.keybind}
              </CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
