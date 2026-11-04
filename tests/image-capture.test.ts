import { describe, it, expect } from "vitest";
import {
  captureDimensions,
  imageFileError,
  cameraErrorMessage,
  IMAGE_LIMIT,
} from "../src/lib/image-capture";
describe("private image capture preparation", () => {
  it("preserves aspect ratio and never upscales camera pixels", () => {
    expect(captureDimensions(4000, 3000)).toEqual({
      width: 3000,
      height: 2250,
    });
    expect(captureDimensions(640, 480)).toEqual({ width: 640, height: 480 });
    expect(captureDimensions(3000, 4000)).toEqual({
      width: 2250,
      height: 3000,
    });
  });
  it("rejects unready frames and unsupported or oversized files", () => {
    expect(() => captureDimensions(0, 0)).toThrow("not ready");
    expect(imageFileError({ type: "image/heic", size: 200 })).toContain("HEIC");
    expect(
      imageFileError({ type: "image/png", size: IMAGE_LIMIT + 1 }),
    ).toContain("under 6 MB");
    expect(imageFileError({ type: "image/png", size: 0 })).toContain(
      "non-empty",
    );
    for (const type of ["image/png", "image/jpeg", "image/webp"])
      expect(imageFileError({ type, size: 100 })).toBeNull();
  });
  it("provides actionable permission, unavailable and busy camera fallback messages", () => {
    expect(cameraErrorMessage({ name: "NotAllowedError" })).toContain(
      "permission",
    );
    expect(cameraErrorMessage({ name: "NotFoundError" })).toContain(
      "No camera",
    );
    expect(cameraErrorMessage({ name: "NotReadableError" })).toContain(
      "other apps",
    );
  });
});
