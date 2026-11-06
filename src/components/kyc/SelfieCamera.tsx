"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { FilePick, IMAGE_ACCEPT } from "./FilePick";

/**
 * The front camera in a dialog, for the Tier 1 selfie. A frame is taken off
 * the <video> onto a <canvas> as JPEG. Where there is no camera, or access is
 * refused, the browser's file chooser stands in (on a phone, `capture="user"`
 * still opens the front camera).
 */
export function SelfieCamera({
  open,
  onClose,
  onCapture,
}: {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const stop = () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    void (async () => {
      setReady(false);
      setFailed(false);
      if (!navigator.mediaDevices?.getUserMedia) {
        setFailed(true);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }
        setReady(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [open]);

  const take = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Not mirrored: the preview is flipped so it reads like a mirror, but the
    // photo itself is the camera's own view, as a phone camera saves it.
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], `selfie-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.95,
    );
  };

  const fallback = (
    <FilePick accept={IMAGE_ACCEPT} capture="user" variant={failed ? "primary" : "ghost"} onFile={onCapture} block>
      Choose a photo instead
    </FilePick>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="A photo of you"
      footer={
        failed ? (
          fallback
        ) : (
          <>
            <Button onClick={take} disabled={!ready} block>
              Take photo
            </Button>
            {fallback}
          </>
        )
      }
    >
      {failed ? (
        <Alert tone="warning">
          <strong className="block">Camera permission needed</strong>
          Allow camera access to take the photo that confirms your identity.
        </Alert>
      ) : (
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black sm:aspect-[4/3]">
          <video ref={videoRef} playsInline muted className="size-full -scale-x-100 object-cover" />
          {!ready && <p className="absolute inset-0 flex items-center justify-center text-sm text-white/80">Starting the camera…</p>}
        </div>
      )}
    </Modal>
  );
}
