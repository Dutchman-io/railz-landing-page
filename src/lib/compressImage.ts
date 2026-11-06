import { LocalDocument } from "./kyc";

/**
 * Shrink a captured photo before uploading it. (Web port of zemfi-mobile's
 * expo-image-manipulator version: same exports, done on a <canvas>.)
 *
 * A modern phone camera produces 3-5MB per shot — far more than a reviewer
 * needs to read an ID, and enough to make uploads slow and expensive on mobile
 * data.
 *
 * 1600px on the long edge keeps the text on a driving licence or passport
 * legible while landing comfortably under 1MB.
 */
const MAX_EDGE = 1600;
const QUALITY = 0.7;

/**
 * PDFs are passed through untouched: the canvas only handles images, and a
 * document someone deliberately attached as a PDF should reach the reviewer as
 * they sent it.
 */
const isImage = (doc: LocalDocument): boolean =>
  (doc.mimeType ?? "").startsWith("image/");

/**
 * Size of the file behind an object URL, or null if it cannot be read.
 *
 * Null means UNKNOWN, never zero: a failed read must not be reported as an
 * empty file, and callers decide what to do without a number rather than being
 * handed a wrong one.
 */
export async function fileSizeBytes(uri: string): Promise<number | null> {
  try {
    const blob = await (await fetch(uri)).blob();
    return blob.size;
  } catch {
    return null;
  }
}

export const formatBytes = (bytes: number | null): string =>
  bytes === null ? "unknown size" : `${(bytes / 1024 / 1024).toFixed(1)}MB`;

const toJpeg = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Encoding failed"))),
      "image/jpeg",
      quality,
    ),
  );

/**
 * @param quality JPEG quality; the selfie passes a higher one, since the
 *   partner's face match needs the detail heavy compression smears.
 */
export async function compressDocument(
  doc: LocalDocument,
  quality = QUALITY,
): Promise<LocalDocument> {
  if (!isImage(doc)) return doc;

  try {
    // createImageBitmap applies the EXIF orientation, so a phone photo comes
    // out upright once re-encoded without its metadata.
    const bitmap = await createImageBitmap(doc.file);
    // Only ever scale DOWN: upscaling inflates the file and adds no detail.
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No canvas");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await toJpeg(canvas, quality);

    return {
      ...doc,
      uri: URL.createObjectURL(blob),
      file: blob,
      // The output is re-encoded as JPEG regardless of what went in, so the
      // name and type must follow — a PNG name on JPEG bytes makes the server's
      // type check disagree with the content.
      mimeType: "image/jpeg",
      name: doc.name.replace(/\.[^.]+$/, "") + ".jpg",
    };
  } catch {
    // Compression is an optimisation, not a gate. If it fails, upload the
    // original rather than blocking someone's verification over it.
    return doc;
  }
}
