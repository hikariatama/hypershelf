import type { FieldPropConfig } from "./_abstractType";
import { InlineString } from "./_shared";

const config = {
  cellClipboard: "enabled",
  key: "email",
  label: "Email",
  icon: "at-sign",
  fieldProps: ["placeholder"],
  component: InlineString,
} as const satisfies FieldPropConfig;

export default config;
