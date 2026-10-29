import { Worker } from "node:worker_threads";
import { join } from "node:path";

export const LOCAL_OCR_TIMEOUT_MS = 18_000;
export type LocalOCRResult = { text: string; confidence: number };

// The outer worker owns Tesseract's worker from the start of initialization.
// Terminating its environment also terminates child worker threads, including
// a Tesseract worker whose initialization promise never resolved. No image or
// recognized text is written to disk or sent to an external service.
const workerSource = String.raw`
  const { parentPort, workerData } = require("node:worker_threads");
  const { createWorker } = require(workerData.modulePath);
  let engine;
  (async () => {
    try {
      engine = await createWorker("eng", 1, {
        langPath: workerData.langPath,
        workerPath: workerData.workerPath,
        corePath: workerData.corePath,
        cacheMethod: "none",
        logger: () => {},
        errorHandler: () => {},
      });
      const { data } = await engine.recognize(Buffer.from(workerData.image));
      parentPort.postMessage({ ok: true, text: data.text, confidence: data.confidence });
    } catch {
      parentPort.postMessage({ ok: false });
    } finally {
      if (engine) await engine.terminate().catch(() => {});
    }
  })();
`;

/** Available handle is mandatory: this boundary never awaits initialization. */
export async function collectLocalOCRWorker(
  worker: Worker,
  timeoutMs = LOCAL_OCR_TIMEOUT_MS,
): Promise<LocalOCRResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Child output may include library diagnostics. Drain it without retaining
  // or logging it, so recognized identity text cannot enter application logs.
  worker.stdout?.resume();
  worker.stderr?.resume();
  try {
    if (
      !Number.isSafeInteger(timeoutMs) ||
      timeoutMs < 1 ||
      timeoutMs > LOCAL_OCR_TIMEOUT_MS
    )
      throw new Error("Invalid local OCR deadline");
    return await new Promise<LocalOCRResult>((resolve, reject) => {
      worker.once("message", (value: unknown) => {
        if (!value || typeof value !== "object")
          return reject(new Error("Local OCR worker returned invalid output"));
        const output = value as Record<string, unknown>;
        if (
          output.ok !== true ||
          typeof output.text !== "string" ||
          !Number.isFinite(output.confidence) ||
          Number(output.confidence) < 0 ||
          Number(output.confidence) > 100
        )
          return reject(new Error("Local OCR worker did not complete"));
        resolve({ text: output.text, confidence: Number(output.confidence) });
      });
      worker.once("error", () => reject(new Error("Local OCR worker failed")));
      worker.once("exit", () =>
        reject(new Error("Local OCR worker exited before completion")),
      );
      timer = setTimeout(
        () => reject(new Error("Local OCR deadline")),
        timeoutMs,
      );
    });
  } finally {
    if (timer) clearTimeout(timer);
    // Await actual exit before returning, on success, timeout, initialization
    // failure, malformed output, or premature exit. No unresolved engine handle
    // is needed to request cleanup.
    await worker.terminate();
    worker.removeAllListeners();
  }
}

export async function recognizeLocalImage(
  image: Buffer,
): Promise<LocalOCRResult> {
  const worker = new Worker(workerSource, {
    eval: true,
    stdout: true,
    stderr: true,
    workerData: {
      image,
      modulePath: join(process.cwd(), "node_modules/tesseract.js/src/index.js"),
      langPath: join(
        process.cwd(),
        "node_modules/@tesseract.js-data/eng/4.0.0",
      ),
      workerPath: join(
        process.cwd(),
        "node_modules/tesseract.js/src/worker-script/node/index.js",
      ),
      corePath: join(process.cwd(), "node_modules/tesseract.js-core"),
    },
  });
  return collectLocalOCRWorker(worker);
}
