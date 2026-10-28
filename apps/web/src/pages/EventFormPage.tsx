import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Nav } from "../components/Nav";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FieldError } from "../components/FieldError";
import { errorProps, type Errors } from "../lib/fieldErrors";
import { useAuth } from "../context/AuthContext";
import { apiErrorMessage } from "../lib/errors";
import {
  cancelEvent,
  canOrganizeEvents,
  createEvent,
  getEvent,
  updateEvent,
  type CampusEvent,
} from "../services/eventService";

type Field = "title" | "description" | "date" | "startTime" | "endTime" | "location";

const emptyForm = {
  title: "",
  description: "",
  date: "",
  startTime: "",
  endTime: "",
  location: "",
};

type Form = typeof emptyForm;

// Date and time inputs work in local time; the API stores ISO date-times
function toIso(date: string, time: string) {
  return new Date(`${date}T${time}`).toISOString();
}

function toForm(event: CampusEvent): Form {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  return {
    title: event.title,
    description: event.description,
    // en-CA formats as YYYY-MM-DD; toTimeString starts with HH:MM in local time
    date: start.toLocaleDateString("en-CA"),
    startTime: start.toTimeString().slice(0, 5),
    endTime: end.toTimeString().slice(0, 5),
    location: event.location,
  };
}

function validate(form: Form): Errors<Field> {
  const errors: Errors<Field> = {};
  if (!form.title.trim()) errors.title = "Title is required.";
  if (!form.description.trim()) errors.description = "Description is required.";
  if (!form.location.trim()) errors.location = "Location is required.";
  if (!form.date) errors.date = "Date is required.";
  if (!form.startTime) errors.startTime = "Start time is required.";
  if (!form.endTime) errors.endTime = "End time is required.";

  if (form.date && form.startTime) {
    if (new Date(`${form.date}T${form.startTime}`).getTime() <= Date.now()) {
      errors.startTime = "The event must start in the future.";
    }
    if (form.endTime && form.endTime <= form.startTime) {
      errors.endTime = "End time must be after the start time.";
    }
  }
  return errors;
}

export function EventFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [form, setForm] = useState<Form>(emptyForm);
  const [event, setEvent] = useState<CampusEvent | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState("");
  const [errors, setErrors] = useState<Errors<Field>>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  useEffect(() => {
    if (!id) return;
    let stale = false;

    async function load(eventId: string) {
      try {
        const loaded = await getEvent(eventId);
        if (stale) return;
        setEvent(loaded);
        setForm(toForm(loaded));
      } catch (err) {
        if (!stale) setLoadError(apiErrorMessage(err, "Failed to load the event."));
      } finally {
        if (!stale) setLoading(false);
      }
    }

    load(id);
    return () => {
      stale = true;
    };
  }, [id]);

  function update(key: Field, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError("");

    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const input = {
      title: form.title.trim(),
      description: form.description.trim(),
      startsAt: toIso(form.date, form.startTime),
      endsAt: toIso(form.date, form.endTime),
      location: form.location.trim(),
    };

    setSubmitting(true);
    try {
      if (id) {
        await updateEvent(id, input);
        navigate("/events", { state: { flash: "Event updated." } });
      } else {
        await createEvent(input);
        navigate("/events", { state: { flash: "Event created." } });
      }
    } catch (err) {
      setSubmitError(apiErrorMessage(err, "Failed to save the event. Please try again."));
      setSubmitting(false);
    }
  }

  async function handleCancelEvent() {
    if (!id) return;
    setCancelError("");
    setCancelling(true);
    try {
      await cancelEvent(id);
      navigate("/events", { state: { flash: "Event cancelled." } });
    } catch (err) {
      setCancelError(apiErrorMessage(err, "Failed to cancel the event."));
      setCancelling(false);
    }
  }

  const organizerName = isEdit
    ? event?.organizer?.profile?.displayName || "CampusHub organizer"
    : user?.profile?.displayName || user?.email || "";

  // Hide the form from people the API would reject anyway
  let blocked = "";
  if (!isEdit && !canOrganizeEvents(user?.role)) {
    blocked = "Only event organizers can create events.";
  } else if (event && event.organizerId !== user?.id) {
    blocked = "Only the event's organizer can edit it.";
  } else if (event?.status === "CANCELLED") {
    blocked = "This event has been cancelled and can no longer be edited.";
  }

  return (
    <div className="min-h-screen bg-canvas">
      <Nav />

      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
        <Link to="/events" className="link text-sm">
          ← Back to events
        </Link>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
          {isEdit ? "Edit event" : "Create an event"}
        </h1>

        {loading && (
          <p role="status" className="mt-8 text-sm text-ink-soft">
            Loading event...
          </p>
        )}

        {(loadError || blocked) && !loading && (
          <div role="alert" className="alert-error mt-8">
            {loadError || blocked}
          </div>
        )}

        {!loading && !loadError && !blocked && (
          <div className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
            <form onSubmit={handleSubmit} noValidate className="space-y-6">
              {submitError && (
                <div role="alert" className="alert-error">
                  {submitError}
                </div>
              )}

              <div>
                <label htmlFor="ev-title" className="field-label">
                  Title *
                </label>
                <input
                  id="ev-title"
                  type="text"
                  maxLength={120}
                  className="field-input"
                  value={form.title}
                  onChange={(e) => update("title", e.target.value)}
                  {...errorProps(errors, "ev", "title")}
                />
                <FieldError errors={errors} prefix="ev" field="title" />
              </div>

              <div>
                <label htmlFor="ev-description" className="field-label">
                  Description *
                </label>
                <textarea
                  id="ev-description"
                  rows={5}
                  maxLength={2000}
                  className="field-input resize-none"
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  {...errorProps(errors, "ev", "description")}
                />
                <FieldError errors={errors} prefix="ev" field="description" />
              </div>

              <div className="grid gap-6 sm:grid-cols-3">
                <div>
                  <label htmlFor="ev-date" className="field-label">
                    Date *
                  </label>
                  <input
                    id="ev-date"
                    type="date"
                    min={new Date().toLocaleDateString("en-CA")}
                    className="field-input"
                    value={form.date}
                    onChange={(e) => update("date", e.target.value)}
                    {...errorProps(errors, "ev", "date")}
                  />
                  <FieldError errors={errors} prefix="ev" field="date" />
                </div>
                <div>
                  <label htmlFor="ev-start" className="field-label">
                    Start time *
                  </label>
                  <input
                    id="ev-start"
                    type="time"
                    className="field-input"
                    value={form.startTime}
                    onChange={(e) => update("startTime", e.target.value)}
                    {...errorProps(errors, "ev", "startTime")}
                  />
                  <FieldError errors={errors} prefix="ev" field="startTime" />
                </div>
                <div>
                  <label htmlFor="ev-end" className="field-label">
                    End time *
                  </label>
                  <input
                    id="ev-end"
                    type="time"
                    className="field-input"
                    value={form.endTime}
                    onChange={(e) => update("endTime", e.target.value)}
                    {...errorProps(errors, "ev", "endTime")}
                  />
                  <FieldError errors={errors} prefix="ev" field="endTime" />
                </div>
              </div>

              <div>
                <label htmlFor="ev-location" className="field-label">
                  Location *
                </label>
                <input
                  id="ev-location"
                  type="text"
                  maxLength={120}
                  placeholder="e.g. Forwell Hall, Room F2010"
                  className="field-input"
                  value={form.location}
                  onChange={(e) => update("location", e.target.value)}
                  {...errorProps(errors, "ev", "location")}
                />
                <FieldError errors={errors} prefix="ev" field="location" />
              </div>

              <div>
                <label htmlFor="ev-organizer" className="field-label">
                  Organizer
                </label>
                <input
                  id="ev-organizer"
                  type="text"
                  className="field-input bg-canvas text-ink-soft"
                  value={organizerName}
                  readOnly
                  aria-describedby="ev-organizer-hint"
                />
                <p id="ev-organizer-hint" className="mt-1 text-xs text-muted">
                  Events are listed under the account that creates them.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button type="submit" className="btn-primary px-6" disabled={submitting || cancelling}>
                  {submitting ? "Saving..." : isEdit ? "Save changes" : "Create event"}
                </button>
                <Link to="/events" className="btn-secondary px-6">
                  Back
                </Link>
                {isEdit && (
                  <button
                    type="button"
                    className="btn-secondary border-danger/40 text-danger hover:bg-danger-soft sm:ml-auto"
                    onClick={() => {
                      setCancelError("");
                      setConfirmOpen(true);
                    }}
                    disabled={submitting || cancelling}
                  >
                    Cancel event
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        <ConfirmDialog
          open={confirmOpen}
          title="Cancel this event?"
          confirmLabel="Cancel event"
          cancelLabel="Keep event"
          busyLabel="Cancelling..."
          busy={cancelling}
          error={cancelError}
          onConfirm={handleCancelEvent}
          onCancel={() => setConfirmOpen(false)}
        >
          <strong className="text-ink">{event?.title}</strong> will be removed from the events list.
          This can't be undone.
        </ConfirmDialog>
      </main>
    </div>
  );
}
