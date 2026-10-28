import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Nav } from "../components/Nav";
import { useAuth } from "../context/AuthContext";
import { apiErrorMessage } from "../lib/errors";
import { fileToDataUrl, photoError } from "../lib/image";
import {
  createListing,
  getCategories,
  getListing,
  updateListing,
  type Category,
} from "../services/listingService";

const MAX_PHOTOS = 5;

/** A photo already on the listing (url) or one picked in this form (file) */
type Photo = { preview: string; url?: string; file?: File };

/** Create and edit share this form; /marketplace/:id/edit loads the listing first */
export function CreateListingPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingListing, setLoadingListing] = useState(isEdit);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [condition, setCondition] = useState("");

  const [photos, setPhotos] = useState<Photo[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");

  // Object URLs for picked files must be released when they go away
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(
    () => () => {
      photosRef.current.forEach((photo) => {
        if (photo.file) URL.revokeObjectURL(photo.preview);
      });
    },
    [],
  );

  useEffect(() => {
    async function loadCategories() {
      try {
        setCategories(await getCategories());
      } catch (err) {
        setError(apiErrorMessage(err, "Failed to load marketplace categories"));
      } finally {
        setLoadingCategories(false);
      }
    }

    loadCategories();
  }, []);

  useEffect(() => {
    if (!id) return;

    async function loadListing(listingId: string) {
      try {
        const listing = await getListing(listingId);
        if (listing.seller.id !== user?.id) {
          setLoadError("You can only edit your own listings.");
          return;
        }
        setTitle(listing.title);
        setDescription(listing.description);
        setPrice((listing.priceCents / 100).toFixed(2));
        setCategoryId(listing.category.id);
        setCondition(listing.condition);
        setPhotos(listing.images.map((image) => ({ preview: image.url, url: image.url })));
      } catch (err) {
        setLoadError(apiErrorMessage(err, "Failed to load the listing."));
      } finally {
        setLoadingListing(false);
      }
    }

    loadListing(id);
  }, [id, user?.id]);

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";

    if (files.length === 0) {
      return;
    }

    const problem = files.map(photoError).find(Boolean);
    if (problem) {
      setError(problem);
      return;
    }

    if (photos.length + files.length > MAX_PHOTOS) {
      setError("You can upload a maximum of 5 photos.");
      return;
    }

    setError("");
    setPhotos((current) => [
      ...current,
      ...files.map((file) => ({ file, preview: URL.createObjectURL(file) })),
    ]);
  }

  function removePhoto(index: number) {
    const photo = photos[index];
    if (photo.file) URL.revokeObjectURL(photo.preview);
    setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index));
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
      // Existing photos are already data URLs; new ones are converted here
      const images = await Promise.all(
        photos.map(async (photo) => ({
          url: photo.url ?? (await fileToDataUrl(photo.file!)),
        })),
      );

      const input = {
        title: title.trim(),
        description: description.trim(),
        priceCents,
        categoryId,
        condition,
        images,
      };

      if (id) {
        await updateListing(id, input);
        navigate(`/marketplace/${id}`, { state: { flash: "Your listing has been updated." } });
        return;
      }

      await createListing(input);

      setSuccess("Your listing has been published successfully!");

      // Clear form after successful submission
      setTitle("");
      setDescription("");
      setPrice("");
      setCategoryId("");
      setCondition("");
      photos.forEach((photo) => {
        if (photo.file) URL.revokeObjectURL(photo.preview);
      });
      setPhotos([]);
    } catch (err) {
      console.error("Save listing error:", err);

      setError(
        apiErrorMessage(
          err,
          isEdit ? "Failed to update listing. Please try again." : "Failed to create listing. Please try again.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  const backTo = isEdit ? `/marketplace/${id}` : "/profile";

  return (
    <div className="min-h-screen bg-canvas">
      <Nav />

      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
        <Link to={backTo} className="link text-sm">
          {isEdit ? "← Back to listing" : "← Back to profile"}
        </Link>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
          {isEdit ? "Edit listing" : "Sell an item"}
        </h1>

        <p className="mt-1.5 text-sm text-ink-soft">
          {isEdit
            ? "Update the details buyers see."
            : "Create a marketplace listing for other Fanshawe students."}
        </p>

        {loadingListing && (
          <p role="status" className="mt-8 text-sm text-ink-soft">
            Loading listing...
          </p>
        )}

        {loadError && (
          <div role="alert" className="alert-error mt-8">
            {loadError}
          </div>
        )}

        {!loadingListing && !loadError && (
          <div className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div role="alert" className="alert-error">
                  {error}
                </div>
              )}

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
                  aria-describedby="listing-photos-hint"
                />

                <p id="listing-photos-hint" className="mt-1 text-xs text-muted">
                  Add up to 5 photos. JPG, PNG, or WebP. Maximum 2 MB each.
                </p>

                {photos.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {photos.map((photo, index) => (
                      <div
                        key={photo.preview}
                        className="relative overflow-hidden rounded-xl border border-line bg-surface"
                      >
                        <img
                          src={photo.preview}
                          alt={`Listing photo ${index + 1}`}
                          className="aspect-square w-full object-cover"
                        />

                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute right-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-xs text-white hover:bg-black"
                          aria-label={`Remove photo ${index + 1}`}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  className="btn-primary px-6"
                  disabled={submitting || loadingCategories}
                >
                  {submitting
                    ? isEdit
                      ? "Saving..."
                      : "Publishing..."
                    : isEdit
                      ? "Save changes"
                      : "Create listing"}
                </button>

                <Link to={backTo} className="btn-secondary px-6">
                  Cancel
                </Link>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
