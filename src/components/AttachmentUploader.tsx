"use client";

import { useRef, useState } from "react";
import { getUploadSignatureAction } from "@/app/(protected)/transactions/new/actions";

export interface UploadedAttachment {
  publicId: string;
  secureUrl: string;
  fileName: string;
}

interface AttachmentUploaderProps {
  label: string;
  hint?: string;
  onUploaded: (attachment: UploadedAttachment) => void;
  onRemoved: (publicId: string) => void;
}

interface UploadItem extends UploadedAttachment {
  status: "uploading" | "done" | "error";
}

export function AttachmentUploader({ label, hint, onUploaded, onRemoved }: AttachmentUploaderProps) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const tempId = `pending-${Date.now()}-${file.name}`;
      setItems((prev) => [...prev, { publicId: tempId, secureUrl: "", fileName: file.name, status: "uploading" }]);

      try {
        const signature = await getUploadSignatureAction();
        const body = new FormData();
        body.append("file", file);
        body.append("api_key", signature.apiKey);
        body.append("timestamp", String(signature.timestamp));
        body.append("signature", signature.signature);
        body.append("folder", signature.folder);

        const response = await fetch(`https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`, {
          method: "POST",
          body,
        });
        if (!response.ok) throw new Error("Échec de l'envoi");
        const data = await response.json();

        const uploaded: UploadedAttachment = {
          publicId: data.public_id,
          secureUrl: data.secure_url,
          fileName: file.name,
        };
        setItems((prev) =>
          prev.map((item) => (item.publicId === tempId ? { ...uploaded, status: "done" } : item)),
        );
        onUploaded(uploaded);
      } catch {
        setItems((prev) =>
          prev.map((item) => (item.publicId === tempId ? { ...item, status: "error" } : item)),
        );
      }
    }
  }

  function remove(publicId: string) {
    setItems((prev) => prev.filter((item) => item.publicId !== publicId));
    onRemoved(publicId);
  }

  return (
    <div>
      <p className="text-sm font-medium text-neutral-700">{label}</p>
      {hint ? <p className="text-xs text-neutral-500">{hint}</p> : null}

      <div
        role="button"
        tabIndex={0}
        aria-label={`${label} — glisser-déposer ou appuyer sur Entrée pour choisir un fichier`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        className="mt-1 flex cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed border-neutral-300 bg-neutral-50 px-4 py-4 text-center hover:border-neutral-400"
      >
        <p className="text-sm text-neutral-600">Glisser-déposer ou cliquer pour choisir un fichier</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          aria-label={label}
          tabIndex={-1}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {items.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {items.map((item) => (
            <li
              key={item.publicId}
              className="flex items-center justify-between rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-700"
            >
              <span className="truncate">{item.fileName}</span>
              {item.status === "uploading" ? <span className="text-neutral-400">Envoi…</span> : null}
              {item.status === "error" ? <span className="text-red-600">Échec</span> : null}
              {item.status === "done" ? (
                <button
                  type="button"
                  onClick={() => remove(item.publicId)}
                  className="text-neutral-400 hover:text-red-600"
                >
                  Retirer
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
