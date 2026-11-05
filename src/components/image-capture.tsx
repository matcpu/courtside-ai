"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  Camera,
  ImagePlus,
  RotateCcw,
  Check,
  X,
  ShieldCheck,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  captureDimensions,
  imageFileError,
  cameraErrorMessage,
  IMAGE_LIMIT,
} from "@/lib/image-capture";
function cameraCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
) {
  const dim = captureDimensions(width, height),
    canvas = document.createElement("canvas");
  canvas.width = dim.width;
  canvas.height = dim.height;
  const ctx = canvas.getContext("2d");
  if (!ctx)
    throw Error(
      "Camera capture is unavailable. Upload an existing image instead.",
    );
  ctx.drawImage(source, 0, 0, dim.width, dim.height);
  return canvas;
}
async function encodeCamera(
  canvas: HTMLCanvasElement,
  kind: "scoresheet" | "document",
) {
  let blob: Blob | null = null;
  for (const quality of [0.92, 0.84, 0.76]) {
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (blob && blob.size <= IMAGE_LIMIT) break;
  }
  if (!blob || imageFileError(blob))
    throw Error(
      "The captured photo could not fit the 6 MB limit while preserving detail. Retake it or choose a supported image.",
    );
  return new File(
    [blob],
    kind === "document" ? "proof-of-age-camera.jpg" : "scoresheet-camera.jpg",
    { type: blob.type },
  );
}
function usePreview(file: File | null) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}
export function ImageCapture({
  value,
  onChange,
  disabled = false,
  kind,
  inputLabel,
  previewAlt,
  onBusyChange,
}: {
  value: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  kind: "scoresheet" | "document";
  inputLabel: string;
  previewAlt: string;
  onBusyChange?: (busy: boolean) => void;
}) {
  const id = useId(),
    gallery = useRef<HTMLInputElement>(null),
    native = useRef<HTMLInputElement>(null),
    video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    attempt = useRef(0),
    mounted = useRef(true);
  const [mode, setMode] = useState<"choose" | "opening" | "camera" | "review">(
      "choose",
    ),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [candidate, setCandidate] = useState<File | null>(null),
    [processing, setProcessing] = useState(false);
  const preview = usePreview(value),
    capturePreview = usePreview(candidate);
  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setReady(false);
  }, []);
  const cancel = useCallback(() => {
    attempt.current++;
    stop();
    setMode("choose");
    setCandidate(null);
    setProcessing(false);
  }, [stop]);
  useEffect(() => {
    mounted.current = true;
    const hide = () => {
      if (document.visibilityState === "hidden") cancel();
    };
    window.addEventListener("pagehide", cancel);
    document.addEventListener("visibilitychange", hide);
    return () => {
      mounted.current = false;
      attempt.current++;
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
      window.removeEventListener("pagehide", cancel);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [cancel]);
  useEffect(() => {
    if (disabled) cancel();
  }, [disabled, cancel]);
  const busy = mode !== "choose" || processing;
  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);
  async function start() {
    if (disabled) return;
    const current = ++attempt.current;
    stop();
    setCandidate(null);
    setError("");
    setMode("opening");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "This browser cannot show a live camera. Use your device camera below or upload an existing image.",
      );
      setMode("choose");
      return;
    }
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 2560 },
          height: { ideal: 1920 },
        },
      });
      if (!mounted.current || attempt.current !== current) {
        next.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = next;
      setMode("camera");
      next.getVideoTracks().forEach((t) => {
        t.onended = () => {
          if (mounted.current && stream.current === next) {
            cancel();
            setError(
              "Camera disconnected. Reopen it or upload an existing image.",
            );
          }
        };
      });
    } catch (e) {
      if (mounted.current && attempt.current === current) {
        stop();
        setError(cameraErrorMessage(e));
        setMode("choose");
      }
    }
  }
  useEffect(() => {
    if (mode !== "camera" || !video.current || !stream.current) return;
    video.current.srcObject = stream.current;
    video.current.scrollIntoView({ block: "center", behavior: "auto" });
    void video.current.play().catch(() => {
      cancel();
      setError(
        "The live preview could not start. Use your device camera or upload an existing image.",
      );
    });
  }, [mode, cancel]);
  async function choose(file: File | undefined, fromCamera = false) {
    if (!file) return;
    const current = ++attempt.current;
    stop();
    setMode("choose");
    setCandidate(null);
    setError("");
    onChange(null);
    const issue = imageFileError(file);
    if (
      issue &&
      !(
        fromCamera &&
        file.size > IMAGE_LIMIT &&
        file.size <= 40 * 1024 * 1024 &&
        ["image/jpeg", "image/png", "image/webp"].includes(file.type)
      )
    ) {
      setError(issue);
      return;
    }
    setProcessing(true);
    try {
      const url = URL.createObjectURL(file);
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () =>
            image.naturalWidth && image.naturalHeight
              ? resolve(image)
              : reject(Error());
          image.onerror = () => reject(Error());
          image.src = url;
        });
        const selected = fromCamera
          ? await encodeCamera(
              cameraCanvas(img, img.naturalWidth, img.naturalHeight),
              kind,
            )
          : file;
        if (mounted.current && attempt.current === current) onChange(selected);
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      if (mounted.current && attempt.current === current)
        setError(
          e instanceof Error && e.message
            ? e.message
            : "This image could not be read. Choose an undamaged JPEG, PNG or WebP image or retake the photo.",
        );
    } finally {
      if (mounted.current && attempt.current === current) setProcessing(false);
    }
  }
  async function capture() {
    if (!video.current || !ready || disabled) return;
    const current = ++attempt.current;
    setProcessing(true);
    setError("");
    try {
      const v = video.current,
        canvas = cameraCanvas(v, v.videoWidth, v.videoHeight);
      stop();
      const file = await encodeCamera(canvas, kind);
      if (!mounted.current || current !== attempt.current) return;
      setCandidate(file);
      setMode("review");
    } catch (e) {
      if (mounted.current && current === attempt.current) {
        stop();
        setMode("choose");
        setError((e as Error).message);
      }
    } finally {
      if (mounted.current && current === attempt.current) setProcessing(false);
    }
  }
  return (
    <section
      className="image-capture"
      aria-label={
        kind === "document" ? "Proof of age capture" : "Scoresheet capture"
      }
      aria-busy={processing}
    >
      <div className="capture-actions">
        <Button
          type="button"
          disabled={disabled || processing || mode === "opening"}
          onClick={() => void start()}
        >
          <Camera size={19} aria-hidden="true" />
          {kind === "document" ? "Take a photo" : "Take photo"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || processing}
          onClick={() => {
            cancel();
            gallery.current?.click();
          }}
        >
          <ImagePlus size={19} aria-hidden="true" />
          {kind === "document"
            ? "Upload an existing photo"
            : "Upload existing image"}
        </Button>
      </div>
      <input
        ref={gallery}
        tabIndex={-1}
        id={id + "-gallery"}
        className="capture-file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label={inputLabel}
        disabled={disabled}
        onChange={(e) => {
          void choose(e.currentTarget.files?.[0]);
          e.currentTarget.value = "";
        }}
      />
      <input
        ref={native}
        tabIndex={-1}
        className="capture-file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        aria-label={
          kind === "document"
            ? "Take a photo with your camera (where supported)"
            : "Native scoresheet camera"
        }
        disabled={disabled}
        onChange={(e) => {
          void choose(e.currentTarget.files?.[0], true);
          e.currentTarget.value = "";
        }}
      />
      <p className="capture-guidance">
        Place the {kind === "document" ? "document" : "scoresheet"} flat. Keep
        every required detail sharp and visible. Avoid glare and shadows.
        {kind === "document"
          ? " Cover unrelated identification numbers and personal information."
          : ""}
      </p>
      <p className="small-muted">
        JPEG, PNG or WebP · up to 6 MB. PDF and HEIC are not supported. Only use
        synthetic records for demos.
      </p>
      {error && (
        <p role="alert" className="capture-error">
          {error}
        </p>
      )}
      {mode === "opening" && (
        <p role="status">
          Waiting for camera permission… You can cancel or upload an image
          instead.
        </p>
      )}
      {(mode === "opening" || mode === "camera") && (
        <div className="camera-panel">
          {mode === "camera" && (
            <div className="camera-view">
              <video
                ref={video}
                autoPlay
                muted
                playsInline
                aria-label="Live camera preview"
                onLoadedMetadata={() => setReady(true)}
                onError={() => {
                  cancel();
                  setError(
                    "Camera preview failed. Use your device camera or upload an image.",
                  );
                }}
              />
              <div className="camera-guide" aria-hidden="true" />
              <span className="camera-hint">
                Keep the whole page inside the frame
              </span>
            </div>
          )}
          <div className="capture-actions">
            {mode === "camera" && (
              <Button
                type="button"
                disabled={!ready || processing}
                onClick={() => void capture()}
              >
                <Camera size={21} aria-hidden="true" />
                {processing ? "Preparing photo…" : "Capture photo"}
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={cancel}>
              <X size={17} aria-hidden="true" />
              Cancel camera
            </Button>
          </div>
        </div>
      )}
      {mode === "review" && candidate && capturePreview && (
        <div className="capture-preview">
          <h3>Review your photo</h3>
          <img src={capturePreview} alt="Captured photo to review" />
          <p>
            Check that the text is sharp and the full page is visible. Capturing
            a photo does not upload it.
          </p>
          <div className="capture-actions">
            <Button
              type="button"
              disabled={disabled}
              onClick={() => {
                onChange(candidate);
                setCandidate(null);
                setMode("choose");
              }}
            >
              <Check size={18} aria-hidden="true" />
              Use photo
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={disabled}
              onClick={() => void start()}
            >
              <RotateCcw size={17} aria-hidden="true" />
              Retake photo
            </Button>
            <Button type="button" variant="ghost" onClick={cancel}>
              Cancel photo
            </Button>
          </div>
        </div>
      )}
      {processing && mode === "choose" && (
        <p role="status">Checking your image…</p>
      )}
      {value && preview && mode === "choose" && (
        <div className="capture-preview">
          <h3>
            {kind === "document"
              ? "Check your selected document"
              : "Ready for upload"}
          </h3>
          <p>
            {value.name} · {(value.size / (1024 * 1024)).toFixed(2)} MB
          </p>
          <img
            src={preview}
            alt={previewAlt}
            onError={() => {
              onChange(null);
              setError("Image preview failed. Retake or choose another image.");
            }}
          />
          <p>
            Make sure the important text is readable. Nothing uploads until you
            submit.
          </p>
          <div className="capture-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={disabled}
              onClick={() => void start()}
            >
              <RotateCcw size={16} aria-hidden="true" />
              Retake photo
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={disabled}
              onClick={() => {
                onChange(null);
                setError("");
              }}
            >
              Remove selected {kind === "document" ? "document" : "image"}
            </Button>
          </div>
        </div>
      )}
      {mode === "choose" && (
        <Button
          type="button"
          variant="ghost"
          disabled={disabled || processing}
          onClick={() => native.current?.click()}
        >
          Use device camera instead
        </Button>
      )}
      <p className="capture-privacy">
        <ShieldCheck size={15} aria-hidden="true" />
        Camera images stay on this device until you confirm and submit them.
        Camera availability depends on your browser and device.
      </p>
    </section>
  );
}
