export type UploadKind = "photos" | "references";

export function blobPathname(venueId: string, kind: UploadKind, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `venues/${venueId}/${kind}/${Date.now()}-${safeName}`;
}
