/**
 * Checks a selfie in the browser, before it is sent, for what makes the
 * partner's face match fail on a real customer: no face, someone else in
 * shot, too far, turned away, eyes shut, too dark or blurred.
 *
 * The web counterpart of zemfi-mobile's lib/selfieCheck.ts, with the same
 * issues, thresholds and wording. Mobile finds the face with ML Kit; here it
 * is MediaPipe's Face Landmarker, loaded only when a selfie is checked. Its
 * model is served by this site (public/models); the WebAssembly runtime comes
 * from jsDelivr, pinned to the installed package version.
 *
 * Guidance, not security. Anyone can get past a check in their own browser;
 * the face match and liveness on the server are what decide. So only "no
 * face" and "more than one face" refuse the photo. Everything else can be
 * overridden, and a check that cannot run lets the photo through.
 */
import type { FaceLandmarker, FaceLandmarkerResult } from "@mediapipe/tasks-vision";

export type SelfieIssue =
  | "NO_FACE"
  | "MANY_FACES"
  | "TOO_FAR"
  | "OFF_CENTRE"
  | "TURNED"
  | "EYES_CLOSED"
  | "TOO_DARK"
  | "TOO_BRIGHT"
  | "BLURRED";

/** What to tell the user for each issue (mobile's text, "phone" made "camera"). */
export const SELFIE_ISSUE_TEXT: Record<SelfieIssue, string> = {
  NO_FACE: "We could not find a face. Hold the camera at eye level and look at it.",
  MANY_FACES: "Only your face should be in the photo.",
  TOO_FAR: "Move a little closer, so your face fills most of the photo.",
  OFF_CENTRE: "Centre your face in the photo.",
  TURNED: "Look straight at the camera, with your head level.",
  EYES_CLOSED: "Keep your eyes open.",
  TOO_DARK: "The photo is too dark. Face a window or a light.",
  TOO_BRIGHT: "The photo is too bright. Move out of direct light.",
  BLURRED: "The photo is blurred. Hold the camera still.",
};

/** Issues that refuse the photo; the rest can be overridden. */
export const BLOCKING: readonly SelfieIssue[] = ["NO_FACE", "MANY_FACES"];

export interface SelfieCheckResult {
  /** Most important first. Empty when the photo looks fine. */
  issues: SelfieIssue[];
  /** True when any issue refuses the photo. */
  blocked: boolean;
}

/** Face width as a share of the photo's shorter side. */
const MIN_FACE_SHARE = 0.22;
/** How far the face centre may sit from the photo centre, as a share of each side. */
const MAX_CENTRE_OFFSET = 0.22;
/** Head angles, in degrees. */
const MAX_YAW = 20;
const MAX_PITCH = 20;
const MAX_ROLL = 15;
const MIN_EYE_OPEN = 0.3;
/** Mean brightness, 0-255. */
const MIN_BRIGHTNESS = 55;
const MAX_BRIGHTNESS = 230;
/** Variance of the Laplacian over the face, on a 128 px grey copy. Low on purpose. */
const MIN_SHARPNESS = 12;

const PASS: SelfieCheckResult = { issues: [], blocked: false };

/** Keep in step with @mediapipe/tasks-vision in package.json. */
const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm";
const MODEL_URL = "/models/face_landmarker.task";

let landmarker: Promise<FaceLandmarker> | null = null;

function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarker) {
    landmarker = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
      const options = (delegate: "GPU" | "CPU") => ({
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: "IMAGE" as const,
        // Two, so a second face in shot is seen rather than ignored.
        numFaces: 2,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });
      try {
        return await FaceLandmarker.createFromOptions(fileset, options("GPU"));
      } catch {
        return await FaceLandmarker.createFromOptions(fileset, options("CPU"));
      }
    })();
    // A failed load is retried on the next photo instead of being cached.
    landmarker.catch(() => {
      landmarker = null;
    });
  }
  return landmarker;
}

/** Start loading the detector early (e.g. when the camera opens). */
export function preloadSelfieCheck(): void {
  void getLandmarker().catch(() => {});
}

export async function checkSelfie(file: Blob): Promise<SelfieCheckResult> {
  try {
    // Decoded upright, so the face box and the size describe the same picture
    // whatever the EXIF said.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    try {
      const detector = await getLandmarker();
      const found = detector.detect(bitmap);
      const faces = found.faceLandmarks.length;
      if (faces === 0) return result(["NO_FACE"]);
      if (faces > 1) return result(["MANY_FACES"]);
      const box = faceBox(found, bitmap.width, bitmap.height);
      const issues = geometryIssues(found, box, bitmap.width, bitmap.height);
      issues.push(...pixelIssues(bitmap, box));
      return result(issues);
    } finally {
      bitmap.close();
    }
  } catch {
    // Detection is unavailable or failed: the server still checks the photo.
    return PASS;
  }
}

function result(issues: SelfieIssue[]): SelfieCheckResult {
  return { issues, blocked: issues.some((i) => BLOCKING.includes(i)) };
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The face's bounding box in pixels, from its landmarks (which are 0-1). */
function faceBox(found: FaceLandmarkerResult, width: number, height: number): Box {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const p of found.faceLandmarks[0]) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return {
    left: Math.max(0, minX) * width,
    top: Math.max(0, minY) * height,
    width: (Math.min(1, maxX) - Math.max(0, minX)) * width,
    height: (Math.min(1, maxY) - Math.max(0, minY)) * height,
  };
}

const degrees = (radians: number) => (radians * 180) / Math.PI;

function geometryIssues(found: FaceLandmarkerResult, box: Box, width: number, height: number): SelfieIssue[] {
  const issues: SelfieIssue[] = [];
  if (box.width / Math.min(width, height) < MIN_FACE_SHARE) issues.push("TOO_FAR");
  const dx = Math.abs(box.left + box.width / 2 - width / 2) / width;
  const dy = Math.abs(box.top + box.height / 2 - height / 2) / height;
  if (dx > MAX_CENTRE_OFFSET || dy > MAX_CENTRE_OFFSET) issues.push("OFF_CENTRE");

  // Head angles from the face's rotation. Only their size is compared, so the
  // sign convention of the matrix does not matter.
  const m = found.facialTransformationMatrixes?.[0]?.data;
  if (m && m.length >= 16) {
    const r = (row: number, col: number) => m[row * 4 + col];
    const yaw = degrees(Math.atan2(-r(2, 0), Math.hypot(r(2, 1), r(2, 2))));
    const pitch = degrees(Math.atan2(r(2, 1), r(2, 2)));
    const roll = degrees(Math.atan2(r(1, 0), r(0, 0)));
    if (Math.abs(yaw) > MAX_YAW || Math.abs(pitch) > MAX_PITCH || Math.abs(roll) > MAX_ROLL) {
      issues.push("TURNED");
    }
  }

  const shapes = found.faceBlendshapes?.[0]?.categories;
  if (shapes) {
    const blink = (name: string) => shapes.find((c) => c.categoryName === name)?.score;
    const left = blink("eyeBlinkLeft");
    const right = blink("eyeBlinkRight");
    if (left !== undefined && right !== undefined && 1 - left < MIN_EYE_OPEN && 1 - right < MIN_EYE_OPEN) {
      issues.push("EYES_CLOSED");
    }
  }
  return issues;
}

/** Brightness of the whole photo and sharpness of the face, from small grey copies. */
function pixelIssues(bitmap: ImageBitmap, box: Box): SelfieIssue[] {
  const issues: SelfieIssue[] = [];
  const whole = greyImage(bitmap, { left: 0, top: 0, width: bitmap.width, height: bitmap.height }, 96);
  const mean = whole.values.reduce((sum, v) => sum + v, 0) / Math.max(whole.values.length, 1);
  if (mean < MIN_BRIGHTNESS) issues.push("TOO_DARK");
  else if (mean > MAX_BRIGHTNESS) issues.push("TOO_BRIGHT");

  const crop = {
    left: Math.round(box.left),
    top: Math.round(box.top),
    width: Math.min(Math.round(box.width), bitmap.width - Math.round(box.left)),
    height: Math.min(Math.round(box.height), bitmap.height - Math.round(box.top)),
  };
  if (crop.width > 16 && crop.height > 16) {
    if (laplacianVariance(greyImage(bitmap, crop, 128)) < MIN_SHARPNESS) issues.push("BLURRED");
  }
  return issues;
}

interface GreyImage {
  width: number;
  height: number;
  /** Row by row, 0-255. */
  values: Float32Array;
}

/** A region of the bitmap, scaled to `targetWidth`, as grey values. */
function greyImage(bitmap: ImageBitmap, region: Box, targetWidth: number): GreyImage {
  const width = targetWidth;
  const height = Math.max(1, Math.round((region.height / region.width) * targetWidth));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No 2D canvas");
  ctx.drawImage(bitmap, region.left, region.top, region.width, region.height, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  const values = new Float32Array(width * height);
  for (let i = 0; i < values.length; i++) {
    values[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  return { width, height, values };
}

/** Variance of the 4-neighbour Laplacian: low when edges are soft. */
function laplacianVariance({ width, height, values }: GreyImage): number {
  const at = (x: number, y: number) => values[y * width + x];
  let n = 0;
  let sum = 0;
  let sumSquares = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const v = at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1) - 4 * at(x, y);
      n++;
      sum += v;
      sumSquares += v * v;
    }
  }
  if (n === 0) return Infinity;
  const mean = sum / n;
  return sumSquares / n - mean * mean;
}
