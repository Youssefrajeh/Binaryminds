import type { Errors } from "../lib/fieldErrors";

export function FieldError<F extends string>({
  errors,
  prefix,
  field,
}: {
  errors: Errors<F>;
  prefix: string;
  field: F;
}) {
  if (!errors[field]) return null;
  return (
    <p id={`${prefix}-${field}-error`} className="mt-1 text-xs text-danger">
      {errors[field]}
    </p>
  );
}
