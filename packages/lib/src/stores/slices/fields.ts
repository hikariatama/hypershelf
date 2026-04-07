import { isEqual } from "lodash";

import type { Id } from "@hypershelf/convex/_generated/dataModel";
import type { ExtendedFieldType, FieldType } from "@hypershelf/convex/schema";
import { validateFields } from "@hypershelf/convex/utils";

import type { FieldsSlice, ImmerStateCreator, MagicFieldTypes } from "../types";
import { fieldsEqual } from "../../utils";
import { magicFieldKeys } from "../types";

export const fieldsSlice: ImmerStateCreator<FieldsSlice> = (set, get) => ({
  revalidateErrors: () =>
    set((state) => {
      for (const [, asset] of Object.entries(state.assets)) {
        const errs = validateFields(
          Object.values(state.fields).map((f) => f.field),
          asset.asset.metadata ?? {},
        );
        if (errs && Object.keys(errs).length > 0) {
          let assetErrors = state.assetErrors[asset.asset._id];
          assetErrors ??= {};
          for (const [fieldId, error] of Object.entries(errs)) {
            if (assetErrors[fieldId as Id<"fields">] === error) continue;
            assetErrors[fieldId as Id<"fields">] = error;
          }
          for (const fieldId of Object.keys(assetErrors)) {
            if (!errs[fieldId]) {
              delete assetErrors[fieldId as Id<"fields">];
            }
          }
          state.assetErrors[asset.asset._id] = assetErrors;
        } else {
          delete state.assetErrors[asset.asset._id];
        }
      }
    }),
  setFields: (incoming) => {
    set((state) => {
      for (const [id, field] of Object.entries(incoming) as [
        Id<"fields">,
        ExtendedFieldType,
      ][]) {
        if (
          state.fields[id] &&
          fieldsEqual(state.fields[id].field, field.field)
        )
          continue;
        if (!state.fieldIds.includes(id)) {
          state.fieldIds.push(id);
          if (state.fieldOrder.length > 0) {
            state.fieldOrder.push(id);
          }
        }
        if (
          magicFieldKeys.some((mf) => mf === field.field.type) &&
          state.magicFields[field.field.type as MagicFieldTypes] !==
            field.field._id
        ) {
          state.magicFields[field.field.type as MagicFieldTypes] =
            field.field._id;
        }
        if (!state.fields[id]) {
          state.fields[id] = field;
        } else {
          if (state.fields[id].field.name !== field.field.name)
            state.fields[id].field.name = field.field.name;
          if (state.fields[id].field.slug !== field.field.slug)
            state.fields[id].field.slug = field.field.slug;
          if (state.fields[id].field.type !== field.field.type)
            state.fields[id].field.type = field.field.type;
          if (state.fields[id].field.required !== field.field.required)
            state.fields[id].field.required = field.field.required;
          if (state.fields[id].field.hidden !== field.field.hidden)
            state.fields[id].field.hidden = field.field.hidden;
          if (state.fields[id].field.editingBy !== field.field.editingBy)
            state.fields[id].field.editingBy = field.field.editingBy;
          if (state.fields[id].editingBy?.id !== field.editingBy?.id)
            state.fields[id].editingBy = field.editingBy;
          if (state.fields[id].field.extra && field.field.extra) {
            for (const key of Object.keys(field.field.extra)) {
              const typedKey = key as keyof FieldType["extra"];
              if (
                !isEqual(
                  state.fields[id].field.extra[typedKey],
                  field.field.extra[typedKey],
                )
              ) {
                state.fields[id].field.extra[typedKey] =
                  field.field.extra[typedKey];
              }
            }
            for (const key of Object.keys(state.fields[id].field.extra)) {
              if (!(key in field.field.extra)) {
                delete state.fields[id].field.extra[
                  key as keyof FieldType["extra"]
                ];
              }
            }
          }
        }
      }
      for (const id of state.fieldIds) {
        if (!incoming[id]) {
          delete state.fields[id];
          const magicFieldType = Object.entries(state.magicFields).find(
            ([, fieldId]) => fieldId === id,
          );
          if (magicFieldType) {
            delete state.magicFields[magicFieldType[0] as MagicFieldTypes];
          }
          if (state.fieldOrder.includes(id)) {
            state.fieldOrder.splice(state.fieldOrder.indexOf(id), 1);
          }
          state.fieldIds.splice(state.fieldIds.indexOf(id), 1);
        }
      }
    });
    get().revalidateErrors();
    set((state) => {
      if (state.loadingFields) state.loadingFields = false;
    });
  },
  setExpandedFieldId: (fieldId) => {
    set((state) => {
      state.expandedFieldId = fieldId;
    });
  },
  setFieldsLocker: (locker) =>
    set((state) => {
      state.fieldsLocker = locker;
    }),
});
