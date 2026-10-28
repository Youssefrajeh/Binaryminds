import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router";
import { Nav } from "../components/Nav";
import { apiErrorMessage } from "../lib/errors";
import { fileToDataUrl, photoError } from "../lib/image";
import {
  createLostFoundPost,
  LOST_FOUND_CATEGORIES,
  type LostFoundCategory,
  type LostFoundKind,
} from "../services/lostFoundService";

type Field = "kind" | "title" | "description" | "category" | "location" | "occurredOn" | "photo";
type FieldErrors = Partial<Record<Field, string>>;

// en-CA formats as YYYY-MM-DD, which is what <input type="date"> uses
function today() {
  return new Date().toLocaleDateString("en-CA");
}

const emptyForm = {
  kind: "" as LostFoundKind | "",
  title: "",
  description: "",
  category: "" as LostFoundCategory | "",
  location: "",
  occurredOn: "",
};

function validate(form: typeof emptyForm): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.kind) errors.kind = "Choose whether you lost or found this item.";
  if (!form.title.trim()) errors.title = "Title is required.";
  if (!form.description.trim()) errors.description = "Description is required.";
  if (!form.category) errors.category = "Select a category.";
  if (!form.location.trim()) errors.location = "Location is required.";
  if (!form.occurredOn) {
    errors.occurredOn = "Date is required.";
  } else if (form.occurredOn > today()) {
    errors.occurredOn = "Date cannot be in the future.";
  }
  return errors;
}

/** Props that link an input to its error message for screen readers */
function errorProps(errors: FieldErrors, field: Field) {
  return errors[field]
    ? { "aria-invalid": true, "aria-describedby": `lf-${field}-error` }
    : {};
}

function FieldError({ errors, field }: { errors: FieldErrors; field: Field }) {
  if (!errors[field]) return null;
  return (
    <p id={`lf-${field}-error`} className="mt-1 text-xs text-danger">
      {errors[field]}
    </p>
  );
}

export function CreateLostFoundPage() {
  const [form, setForm] = useState(emptyForm);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  function update<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    // Clear a field's error as soon as the user fixes it
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const problem = photoError(file);
    if (problem) {
      setErrors((current) => ({ ...current, photo: problem }));
      return;
    }

    setErrors((current) => ({ ...current, photo: undefined }));
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function removePhoto() {
    setPhoto(null);
    setPhotoPreview("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError("");
    setSuccess(false);

    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await createLostFoundPost({
        kind: form.kind as LostFoundKind,
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category as LostFoundCategory,
        location: form.location.trim(),
        occurredOn: form.occurredOn,
        imageUrl: photo ? await fileToDataUrl(photo) : null,
      });

      setSuccess(true);
      setForm(emptyForm);
      removePhoto();
    } catch (err) {
      setSubmitError(apiErrorMessage(err, "Failed to create post. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <Nav />

      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
        <Link to="/lost-found" className="link text-sm">
          ← Back to Lost &amp; Found
        </Link>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
          Report a lost or found item
        </h1>

        <p className="mt-1.5 text-sm text-ink-soft">
          Help reunite Fanshawe students with their belongings.
        </p>

        <div className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            {submitError && (
              <div role="alert" className="alert-error">
                {submitError}
              </div>
            )}

            {success && (
              <div role="status" className="alert-success">
                Your post is live.{" "}
                <Link to="/lost-found" className="font-semibold underline underline-offset-4">
                  View all posts
                </Link>
              </div>
            )}

            <fieldset aria-describedby={errors.kind ? "lf-kind-error" : undefined}>
              <legend className="field-label">Type *</legend>
              <div className="grid grid-cols-2 gap-3">
                {(["LOST", "FOUND"] as const).map((kind) => (
                  <label
                    key={kind}
                    className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                      form.kind === kind
                        ? "border-brand bg-brand-soft text-brand"
                        : "border-line bg-surface text-ink-soft hover:bg-canvas"
                    }`}
                  >
                    <input
                      type="radio"
                      name="lf-kind"
                      value={kind}
                      checked={form.kind === kind}
                      onChange={() => update("kind", kind)}
                      className="sr-only"
                    />
                    {kind === "LOST" ? "I lost something" : "I found something"}
                  </label>
                ))}
              </div>
              <FieldError errors={errors} field="kind" />
            </fieldset>

            <div>
              <label htmlFor="lf-title" className="field-label">
                Title *
              </label>
              <input
                id="lf-title"
                type="text"
                maxLength={100}
                placeholder="e.g. Black backpack with laptop"
                className="field-input"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                {...errorProps(errors, "title")}
              />
              <FieldError errors={errors} field="title" />
            </div>

            <div>
              <label htmlFor="lf-description" className="field-label">
                Description *
              </label>
              <textarea
                id="lf-description"
                rows={4}
                maxLength={2000}
                placeholder="Colour, brand, distinguishing marks..."
                className="field-input resize-none"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                {...errorProps(errors, "description")}
              />
              <FieldError errors={errors} field="description" />
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="lf-category" className="field-label">
                  Category *
                </label>
                <select
                  id="lf-category"
                  className="field-input"
                  value={form.category}
                  onChange={(e) => update("category", e.target.value as LostFoundCategory)}
                  {...errorProps(errors, "category")}
                >
                  <option value="">Select a category</option>
                  {LOST_FOUND_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <FieldError errors={errors} field="category" />
              </div>

              <div>
                <label htmlFor="lf-date" className="field-label">
                  Date {form.kind === "FOUND" ? "found" : "lost"} *
                </label>
                <input
                  id="lf-date"
                  type="date"
                  max={today()}
                  className="field-input"
                  value={form.occurredOn}
                  onChange={(e) => update("occurredOn", e.target.value)}
                  {...errorProps(errors, "occurredOn")}
                />
                <FieldError errors={errors} field="occurredOn" />
              </div>
            </div>

            <div>
              <label htmlFor="lf-location" className="field-label">
                Location *
              </label>
              <input
                id="lf-location"
                type="text"
                maxLength={120}
                placeholder="e.g. Library, 2nd floor"
                className="field-input"
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
                {...errorProps(errors, "location")}
              />
              <FieldError errors={errors} field="location" />
            </div>

            <div>
              <label htmlFor="lf-photo" className="field-label">
                Photo
              </label>
              <input
                id="lf-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoChange}
                className="field-input"
                aria-describedby={errors.photo ? "lf-photo-error" : "lf-photo-hint"}
                aria-invalid={errors.photo ? true : undefined}
              />
              {errors.photo ? (
                <FieldError errors={errors} field="photo" />
              ) : (
                <p id="lf-photo-hint" className="mt-1 text-xs text-muted">
                  Optional. JPG, PNG, or WebP. Maximum 2 MB.
                </p>
              )}

              {photoPreview && (
                <div className="relative mt-4 w-40 overflow-hidden rounded-xl border border-line">
                  <img
                    src={photoPreview}
                    alt="Selected item photo"
                    className="aspect-square w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="absolute right-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-xs text-white hover:bg-black"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="submit" className="btn-primary px-6" disabled={submitting}>
                {submitting ? "Posting..." : "Create post"}
              </button>
              <Link to="/lost-found" className="btn-secondary px-6">
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
