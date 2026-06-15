import { AnimatePresence, motion } from "framer-motion";

import type { Id } from "@hypershelf/convex/_generated/dataModel";
import { useHypershelf } from "@hypershelf/lib/stores";
import { AnimatedEyeIcon } from "@hypershelf/ui/icons";
import { Button } from "@hypershelf/ui/primitives/button";

export function VisibilityButton({
  fieldId,
  isHidden,
}: {
  fieldId: Id<"fields">;
  isHidden: boolean;
}) {
  const toggleVisibility = useHypershelf((state) => state.toggleVisibility);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => toggleVisibility(fieldId)}
      className="!p-1 !size-auto"
    >
      <AnimatedEyeIcon isHidden={isHidden} />
    </Button>
  );
}
