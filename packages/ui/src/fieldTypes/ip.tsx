import type { FieldPropConfig } from "./_abstractType";
import { InlineString } from "./_shared";

const config = {
  cellClipboard: "enabled",
  key: "ip",
  label: "IP",
  icon: "ethernet-port",
  fieldProps: ["placeholder", "subnet"],
  component: InlineString,
} as const satisfies FieldPropConfig;

export default config;
