"use client";

import type { Id } from "../../../convex/_generated/dataModel";
import { prepareImageForUpload } from "@/lib/image";

export const EVIDENCE_TYPES = ["receipt", "delivery_photo", "handover_doc", "staff_note", "before_photo", "after_photo"] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

/** Accept attribute for evidence/receipt pickers. */
export const EVIDENCE_ACCEPT = "image/*,application/pdf";

/**
 * Upload one evidence file to Convex storage.
 * Images are EXIF-stripped + compressed via canvas re-encode (src/lib/image.ts); PDFs go up as-is.
 */
export async function uploadEvidenceFile(file: File, getUploadUrl: () => Promise<string>): Promise<Id<"_storage">> {
  const body: Blob = file.type.startsWith("image/") ? await prepareImageForUpload(file) : file;
  const url = await getUploadUrl();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": body.type || file.type || "application/octet-stream" },
    body,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
  return storageId;
}
