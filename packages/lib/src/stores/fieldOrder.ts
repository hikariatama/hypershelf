import type { Id } from "@hypershelf/convex/_generated/dataModel";

function fieldOrderEquals(left: Id<"fields">[], right: Id<"fields">[]) {
  if (left.length !== right.length) return false;
  return left.every((fieldId, index) => fieldId === right[index]);
}

export function getEffectiveFieldOrder(
  fieldIds: Id<"fields">[],
  fieldOrder: Id<"fields">[],
) {
  const knownFieldIds = new Set(fieldIds);
  const orderedFieldIds = new Set<Id<"fields">>();
  const effectiveFieldOrder: Id<"fields">[] = [];

  for (const fieldId of fieldOrder) {
    if (!knownFieldIds.has(fieldId) || orderedFieldIds.has(fieldId)) continue;
    effectiveFieldOrder.push(fieldId);
    orderedFieldIds.add(fieldId);
  }

  for (const fieldId of fieldIds) {
    if (orderedFieldIds.has(fieldId)) continue;
    effectiveFieldOrder.push(fieldId);
  }

  return effectiveFieldOrder;
}

export function compactFieldOrder(
  fieldIds: Id<"fields">[],
  fieldOrder: Id<"fields">[],
) {
  const effectiveFieldOrder = getEffectiveFieldOrder(fieldIds, fieldOrder);
  return fieldOrderEquals(effectiveFieldOrder, fieldIds)
    ? []
    : effectiveFieldOrder;
}

export function fieldOrdersEqual(
  fieldIds: Id<"fields">[],
  left: Id<"fields">[],
  right: Id<"fields">[],
) {
  return fieldOrderEquals(
    getEffectiveFieldOrder(fieldIds, left),
    getEffectiveFieldOrder(fieldIds, right),
  );
}
