import { useHypershelf } from "@hypershelf/lib/stores";
import { Button } from "@hypershelf/ui/primitives/button";

export function ToggleReadOnly() {
  const assetsReadOnly = useHypershelf((state) => state.assetsReadOnly);
  const toggleAssetsReadOnly = useHypershelf(
    (state) => state.toggleAssetsReadOnly,
  );

  return (
    <Button size="sm" variant="ghost" onClick={toggleAssetsReadOnly}>
      {assetsReadOnly ? "Выключить только чтение" : "Включить только чтение"}
    </Button>
  );
}
