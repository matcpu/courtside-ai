# Camera capture and private review

Both **Scoresheets** and the secure guardian portal use the same `ImageCapture` component. Choose **Take photo** to request a live camera, **Capture photo** to make a local image, **Retake photo** if needed and **Use photo** to confirm it. Nothing uploads at capture or confirmation. Scoresheets require a selected game and **Upload and review**. Guardians still provide both required consents and choose **Submit proof and guardian consent**.

The rear-facing camera is preferred, with a desktop webcam accepted when available. Permission is requested only after Take photo. Live preview is muted/playsinline and includes a framing guide. Capture, cancel, a hidden page, navigation/unmount and late permission responses stop camera tracks. Preview object URLs are revoked when replaced or removed. Gallery selection also stops an active camera. Unsupported/denied/unavailable cameras have explicit guidance, **Use device camera instead** and normal file upload.

## Formats and quality

JPEG, PNG and WebP remain supported; the final upload limit remains 6 MB. Existing gallery files over the limit or unreadable image bytes are rejected locally, and the server independently validates the real file. PDF/HEIC remain unsupported. Embedded captures and supported native-camera files are normalized locally to JPEG with a maximum 3000-pixel long edge, preserving aspect ratio and never upscaling. High-quality encoding is attempted first, with bounded quality reduction to fit the existing limit. Native files above 40 MB are rejected before decoding. If a legible capture cannot fit, the user must retake it or choose a supported image. There is no claim of a general client-side blur detector: users inspect sharpness in the preview and reviewers use existing local OCR/readability warnings.

## Existing decisions and privacy

Scoresheets retain private Storage, duplicate handling, authorized processing and explicit human confirmation. While inference is paused, Upload and review truthfully uses the manual path with empty scores/statistics until review; no result becomes official on capture/upload. Existing genuine Muse Spark extractions remain separate, timestamped evidence.

Guardian camera files use the same one-player invitation, private signed upload, required consent, bounded server-local OCR, duplicate/similarity checks and administrator original inspection. Declared birth dates are never overwritten by OCR. No guardian file is sent to Meta or another external model. Automated findings cannot approve, reject, suspend or accuse a player. Tenant permissions, retention/deletion and audit history are unchanged.

## Verified scope

- Desktop Chrome and iPhone-size mobile Chromium: actual `getUserMedia`, video-to-canvas JPEG, capture/retake/confirmation, no automatic upload, stopped tracks, permission denial, late permission cancellation, navigation cleanup, oversize/unreadable-file rejection, native-photo normalization and explicit upload retry.
- A genuinely blurred synthetic JPEG upload returned unable-to-assess/unreadable findings, retained pending human review and left the declared date unchanged.
- Real Chrome permission denial is set through browser permission controls. No-device faults are deliberately injected test cases, not a claim that physical unplugging was tested.
- Production guardian workflow: synthetic virtual-camera JPEG and ordinary PNG upload, consent, pending review, original inspection, resubmission, human approval and readiness. Production scoresheet WebP upload/retry and an actual coach camera-JPEG upload reach manual review. No new schedule was published.
- Chrome camera tests use a clearly fictional Y4M virtual-camera feed. They exercise real browser APIs; they do not certify physical optics, focus, lighting or operating-system permission dialogs.
- Physical iPhone Safari, Android Chrome and physical desktop webcam testing were unavailable. Standards-based rear-camera preference, playsinline and native capture fallback are implemented, but physical/native-picker behavior remains unverified.

All development data is synthetic. Meta inference stays disabled. Source and test credentials/feeds remain private where appropriate. The audio-pending demo labels virtual-camera footage and retains the seven founder narration slots; no public video publication or entry submission is authorized here.
