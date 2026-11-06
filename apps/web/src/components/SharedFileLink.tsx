import { useState } from "react";
import { safeAttachmentUrl, sharedFileIdFrom } from "@campushub/shared";
import { downloadSharedFile } from "../lib/files";

/** Downloads a stored file through the API, or links to an older external attachment. */
export function SharedFileLink({ url, name, label = name }: { url: string; name: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileId = sharedFileIdFrom(url);
  const safeUrl = safeAttachmentUrl(url);

  async function download(id: string) {
    setBusy(true); setError("");
    try { await downloadSharedFile(id, name); }
    catch { setError("This file is no longer available."); }
    finally { setBusy(false); }
  }

  if (fileId) return <>
    <button type="button" className="link break-all text-left" disabled={busy} onClick={() => download(fileId)}>{busy ? "Downloading..." : label}</button>
    {error && <p role="alert" className="mt-1 text-danger">{error}</p>}
  </>;
  if (safeUrl) return <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="link break-all">{label}</a>;
  return <span className="break-all">{name} (link unavailable)</span>;
}
