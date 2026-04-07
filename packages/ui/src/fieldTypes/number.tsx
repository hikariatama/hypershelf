import type { FieldPropConfig } from "./_abstractType";
import { InlineString } from "./_shared";

const config = {
  cellClipboard: "enabled",
  key: "number",
  label: "Число",
  icon: "hash",
  fieldProps: ["placeholder", "minValue", "maxValue"],
  component: InlineString,
} as const satisfies FieldPropConfig;

export default config;
