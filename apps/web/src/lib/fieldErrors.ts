export type Errors<F extends string> = Partial<Record<F, string>>;

/** Props that link an input to its error message for screen readers */
export function errorProps<F extends string>(errors: Errors<F>, prefix: string, field: F) {
  return errors[field]
    ? { "aria-invalid": true, "aria-describedby": `${prefix}-${field}-error` }
    : {};
}
