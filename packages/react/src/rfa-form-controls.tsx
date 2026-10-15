"use client";
import type { ReactElement } from "react";
import { DateField, DateTimeField, type DateFieldProps } from "./form-controls";

/** Older names for the shared form controls in ./form-controls. New code uses Select, DateField and DateTimeField directly. */
export { Select as RfaSelect, parseTimeText as rfaParseTime, type SelectOption as RfaSelectOption } from "./form-controls";

/** A date field, or date and time with `withTime`. */
export function RfaDateField({ withTime = false, ...props }: DateFieldProps & { withTime?: boolean }): ReactElement {
  return withTime ? <DateTimeField {...props} /> : <DateField {...props} />;
}
