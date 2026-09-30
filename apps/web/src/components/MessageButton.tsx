import { useState } from "react";
import { useNavigate } from "react-router";
import type { ConversationDto } from "@campushub/shared";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

interface MessageButtonProps {
  recipientId: string;
  className?: string;
  label?: string;
}

/**
 * Opens (or starts) a DM with another student. Drop it on profiles, listings
 * and lost & found posts.
 */
export function MessageButton({ recipientId, className = "btn-primary", label = "Message" }: MessageButtonProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (user?.id === recipientId) return null;

  async function handleClick() {
    setError("");
    setLoading(true);
    try {
      const res = await api.post<ConversationDto>("/conversations", { recipientId });
      navigate(`/messages/${res.data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || "Could not start a conversation");
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button type="button" onClick={handleClick} disabled={loading} className={className}>
        {loading ? "Opening…" : label}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
