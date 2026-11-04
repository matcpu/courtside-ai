export const IMAGE_LIMIT = 6 * 1024 * 1024;
export function imageFileError(
  file: Pick<File, "type" | "size">,
): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    return "Choose a JPEG, PNG or WebP image under 6 MB. PDF and HEIC files are not supported; export a supported image or take a photo.";
  if (!file.size || file.size > IMAGE_LIMIT)
    return "Choose a non-empty JPEG, PNG or WebP image under 6 MB.";
  return null;
}
export function captureDimensions(
  width: number,
  height: number,
  maxEdge = 3000,
) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 1 ||
    height < 1
  )
    throw new Error(
      "The camera is not ready. Wait for the live preview, then try again.",
    );
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
export function cameraErrorMessage(e: unknown) {
  const name = (e as { name?: string })?.name;
  return name === "NotAllowedError"
    ? "Camera permission was not granted. Allow camera access in your browser settings, use your device camera below, or upload an existing image."
    : name === "NotFoundError"
      ? "No camera is available. Connect a camera, use your device camera below, or upload an existing image."
      : name === "NotReadableError"
        ? "The camera could not be opened. Close other apps using it and try again, or upload an existing image."
        : "The live camera is unavailable. Try your device camera below or upload an existing image.";
}
