import type { FieldPropConfig } from "./_abstractType";
import { InlineString } from "./_shared";

const config = {
  cellClipboard: "enabled",
  key: "url",
  label: "Ссылка",
  icon: "link-2",
  fieldProps: ["placeholder"],
  component: InlineString,
} as const satisfies FieldPropConfig;

export default config;
