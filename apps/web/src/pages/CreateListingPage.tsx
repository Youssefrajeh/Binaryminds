import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Nav } from "../components/Nav";
import api from "../lib/api";
import axios from "axios";

type Category = {
  id: string;
  name: string;
  slug: string;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Unable to read the photo."));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read the photo."));
    };

    reader.readAsDataURL(file);
  });
}

export function CreateListingPage() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [condition, setCondition] = useState("");

  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await api.get<Category[]>("/listings/categories");
        setCategories(response.data);
      } catch (err: any) {
        setError(
          err.response?.data?.error || "Failed to load marketplace categories",
        );
      } finally {
        setLoadingCategories(false);
      }
    }

    loadCategories();
  }, []);

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    const invalidFile = files.find((file) => !allowedTypes.includes(file.type));

    if (invalidFile) {
      setError("Only JPG, PNG, and WebP images are allowed.");
      e.target.value = "";
      return;
    }

    const tooLarge = files.find((file) => file.size > 2 * 1024 * 1024);

    if (tooLarge) {
      setError("Each photo must be smaller than 2 MB.");
      e.target.value = "";
      return;
    }

    if (photos.length + files.length > 5) {
      setError("You can upload a maximum of 5 photos.");
      e.target.value = "";
      return;
    }

    setError("");

    setPhotos((current) => [...current, ...files]);

    const previews = files.map((file) => URL.createObjectURL(file));

    setPhotoPreviews((current) => [...current, ...previews]);

    e.target.value = "";
  }

  function removePhoto(index: number) {
    URL.revokeObjectURL(photoPreviews[index]);

    setPhotos((current) =>
      current.filter((_, photoIndex) => photoIndex !== index),
    );

    setPhotoPreviews((current) =>
      current.filter((_, photoIndex) => photoIndex !== index),
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    setError("");
    setSuccess("");

    // Validate form
    if (!title.trim() || !description.trim()) {
      setError("Title and description are required.");
      return;
    }

    if (!categoryId || !condition) {
      setError("Please select a category and condition.");
      return;
    }

    if (price.trim() === "" || !Number.isFinite(Number(price))) {
      setError("Please enter a valid price.");
      return;
    }

    const priceCents = Math.round(Number(price) * 100);

    if (priceCents < 0 || !Number.isSafeInteger(priceCents)) {
      setError("Please enter a valid price.");
      return;
    }

    if (photos.length === 0) {
      setError("Please add at least one photo.");
      return;
    }

    setSubmitting(true);

    try {
      // Convert selected photos into data URLs
      const images = await Promise.all(
        photos.map(async (file) => ({
          url: await fileToDataUrl(file),
        })),
      );

      // Send listing to backend
      const response = await api.post("/listings", {
        title: title.trim(),
        description: description.trim(),
        priceCents,
        categoryId,
        condition,
        images,
      });

      setSuccess("Your listing has been published successfully!");

      console.log("Created listing:", response.data);

      // Clear form after successful submission
      setTitle("");
      setDescription("");
      setPrice("");
      setCategoryId("");
      setCondition("");
      setPhotos([]);

      photoPreviews.forEach((preview) => {
        URL.revokeObjectURL(preview);
      });

      setPhotoPreviews([]);
    } catch (err: unknown) {
      console.error("Create listing error:", err);

      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.error ||
            "Failed to create listing. Please try again.",
        );
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <Nav />

      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
        <Link to="/profile" className="link text-sm">
          ← Back to profile
        </Link>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
          Sell an item
        </h1>

        <p className="mt-1.5 text-sm text-ink-soft">
          Create a marketplace listing for other Fanshawe students.
        </p>

        <div className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          {error && <div className="alert-error mb-6">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <div className="alert-error">{error}</div>}

            {success && (
              <div
                role="status"
                className="mb-6 rounded-lg border border-green-300 bg-green-50 p-4 text-green-800"
              >
                {success}
              </div>
            )}

            <div>
              <label htmlFor="listing-title" className="field-label">
                Title *
              </label>

              <input
                id="listing-title"
                type="text"
                maxLength={100}
                placeholder="e.g. Calculus textbook"
                className="field-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="listing-description" className="field-label">
                Description *
              </label>

              <textarea
                id="listing-description"
                rows={5}
                maxLength={2000}
                placeholder="Describe the item and its condition..."
                className="field-input resize-none"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />

              <p className="mt-1 text-xs text-muted">
                Tell buyers about the item.
              </p>
            </div>

            <div>
              <label htmlFor="listing-price" className="field-label">
                Price *
              </label>

              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                  $
                </span>

                <input
                  id="listing-price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="field-input pl-7"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="listing-category" className="field-label">
                Category *
              </label>

              <select
                id="listing-category"
                className="field-input"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                disabled={loadingCategories}
              >
                <option value="">
                  {loadingCategories
                    ? "Loading categories..."
                    : "Select a category"}
                </option>

                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="listing-condition" className="field-label">
                Condition *
              </label>

              <select
                id="listing-condition"
                className="field-input"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                required
              >
                <option value="">Select condition</option>
                <option value="NEW">New</option>
                <option value="LIKE_NEW">Like new</option>
                <option value="GOOD">Good</option>
                <option value="FAIR">Fair</option>
                <option value="POOR">Poor</option>
              </select>
            </div>

            <div>
              <label htmlFor="listing-photos" className="field-label">
                Photos *
              </label>

              <input
                id="listing-photos"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handlePhotoChange}
                className="field-input"
              />

              <p className="mt-1 text-xs text-muted">
                Add up to 5 photos. JPG, PNG, or WebP. Maximum 2 MB each.
              </p>

              {photoPreviews.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {photoPreviews.map((preview, index) => (
                    <div
                      key={preview}
                      className="relative overflow-hidden rounded-xl border border-line bg-surface"
                    >
                      <img
                        src={preview}
                        alt={`Listing photo ${index + 1}`}
                        className="aspect-square w-full object-cover"
                      />

                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute right-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-xs text-white hover:bg-black"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="btn-primary px-6"
                disabled={submitting || loadingCategories}
              >
                {submitting ? "Publishing..." : "Create listing"}
              </button>

              <Link to="/profile" className="btn-secondary px-6">
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
