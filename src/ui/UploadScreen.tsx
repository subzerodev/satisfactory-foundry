import { useState } from "react";
import { fileToDocsText } from "./decode.ts";

interface UploadScreenProps {
  reason: "empty" | "stale" | "upload-error";
  message?: string;
  onUpload(text: string): void;
}

/**
 * First-boot / re-upload screen. The `stale` copy is deliberately generic: the
 * data layer drops the stale cause (version mismatch, IDB failure, corrupt
 * payload are indistinguishable by design, catalog-store.ts:75-80), so the copy
 * must not assert one. Decode goes through the shared BOM-sniffing core.
 */
export function UploadScreen({ reason, message, onUpload }: UploadScreenProps) {
  const [busy, setBusy] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      onUpload(await fileToDocsText(file));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="upload-screen">
      <h1>satisfactory-foundry</h1>
      <p>
        Upload the game's <code>Docs.json</code> to begin. It lives at{" "}
        <code>&lt;install&gt;/CommunityResources/Docs/&lt;locale&gt;.json</code>{" "}
        and is cached after upload.
      </p>
      {reason === "stale" && (
        <p className="upload-notice">
          Your cached catalog couldn't be loaded — please re-upload Docs.json.
        </p>
      )}
      {reason === "upload-error" && message !== undefined && (
        <p className="upload-error">{message}</p>
      )}
      <input
        type="file"
        accept="application/json,.json"
        disabled={busy}
        onChange={handleFile}
      />
    </div>
  );
}
