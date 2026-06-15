import { Ellipsis } from "lucide-react";

import { Button } from "@hypershelf/ui/primitives/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@hypershelf/ui/primitives/popover";

import { QueryBuilder } from "../QueryBuilder";
import { Search } from "../Search";
import { Export } from "./Export";
import { ToggleHiding } from "./ToggleHiding";
import { ToggleReadOnly } from "./ToggleReadOnly";
import { Wayback } from "./Wayback";

export function ExtraActions() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="!p-1 !size-auto">
          <Ellipsis className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" className="py-2 px-3 z-[9999]">
        <div className="gap-1 flex flex-col">
          <div className="md:hidden contents">
            <Search expanded />
            <QueryBuilder expanded />
          </div>
          <ToggleReadOnly />
          <ToggleHiding />
          <Wayback />
          <Export />
        </div>
      </PopoverContent>
    </Popover>
  );
}
