import type { FieldPropConfig } from "./_abstractType";
import { InlineString } from "./_shared";

const config = {
  cellClipboard: "enabled",
  key: "string",
  label: "Строка",
  icon: "case-sensitive",
  fieldProps: [
    "placeholder",
    "regex",
    "regexError",
    "minLength",
    "maxLength",
    "singleLine",
  ],
  component: InlineString,
} as const satisfies FieldPropConfig;

export default config;
