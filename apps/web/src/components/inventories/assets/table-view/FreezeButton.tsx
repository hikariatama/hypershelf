import type { Id } from "@hypershelf/convex/_generated/dataModel";
import { useHypershelf } from "@hypershelf/lib/stores";
import { cn } from "@hypershelf/lib/utils";
import { Button } from "@hypershelf/ui/primitives/button";

export function FreezeButton({
  fieldId,
  isFrozen,
}: {
  fieldId: Id<"fields">;
  isFrozen: boolean;
}) {
  const toggleFrozen = useHypershelf((state) => state.toggleFrozen);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => toggleFrozen(fieldId)}
      className="!p-1 !size-auto"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(
          "transition-transform duration-100",
          !isFrozen && "opacity-50",
          isFrozen && "rotate-45",
        )}
      >
        <path d="m10 20-1.25-2.5L6 18" />
        <path d="M10 4 8.75 6.5 6 6" />
        <path d="m14 20 1.25-2.5L18 18" />
        <path d="m14 4 1.25 2.5L18 6" />
        <path d="m17 21-3-6h-4" />
        <path d="m17 3-3 6 1.5 3" />
        <path d="M2 12h6.5L10 9" />
        <path d="m20 10-1.5 2 1.5 2" />
        <path d="M22 12h-6.5L14 15" />
        <path d="m4 10 1.5 2L4 14" />
        <path d="m7 21 3-6-1.5-3" />
        <path d="m7 3 3 6h4" />
      </svg>
    </Button>
  );
}
