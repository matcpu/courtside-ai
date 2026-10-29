import { describe, expect, it } from "vitest";
import { Worker } from "node:worker_threads";
import { collectLocalOCRWorker } from "../src/lib/local-ocr";

const workerOptions = { eval: true, stdout: true, stderr: true } as const;
describe("bounded local OCR execution ownership", () => {
  it("terminates a worker after a successful result even if it keeps running", async () => {
    const worker = new Worker(
      `
      const { parentPort } = require("node:worker_threads");
      parentPort.postMessage({ ok: true, text: "Synthetic private text", confidence: 91 });
      setInterval(() => {}, 1000);
    `,
      workerOptions,
    );
    await expect(collectLocalOCRWorker(worker, 2000)).resolves.toEqual({
      text: "Synthetic private text",
      confidence: 91,
    });
    expect(worker.threadId).toBe(-1);
  });

  it("terminates initialization that never resolves and its nested worker", async () => {
    const shared = new SharedArrayBuffer(8),
      state = new Int32Array(shared);
    const worker = new Worker(
      `
      const { Worker, workerData } = require("node:worker_threads");
      new Worker(\`
        const { workerData } = require("node:worker_threads");
        const state = new Int32Array(workerData);
        Atomics.store(state, 0, 1);
        setInterval(() => Atomics.add(state, 1, 1), 5);
      \`, { eval: true, workerData });
      new Promise(() => {}); // Simulated Tesseract initialization never returns a handle.
    `,
      { ...workerOptions, workerData: shared },
    );
    try {
      // Only test setup waits for this heartbeat. Production starts its deadline
      // immediately after constructing the worker, before engine initialization.
      await expect
        .poll(() => Atomics.load(state, 0), { timeout: 3000 })
        .toBe(1);
      await expect(collectLocalOCRWorker(worker, 75)).rejects.toThrow(
        "Local OCR deadline",
      );
    } finally {
      await worker.terminate();
    }
    expect(worker.threadId).toBe(-1);
    const stoppedAt = Atomics.load(state, 1);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(Atomics.load(state, 1)).toBe(stoppedAt);
  });

  it("cleans up initialization errors without exposing private diagnostics", async () => {
    const worker = new Worker(
      `throw new Error("synthetic private diagnostic")`,
      workerOptions,
    );
    await expect(collectLocalOCRWorker(worker, 2000)).rejects.toThrow(
      "Local OCR worker failed",
    );
    expect(worker.threadId).toBe(-1);
  });

  it("cleans up malformed results and premature exits", async () => {
    const malformed = new Worker(
      `require("node:worker_threads").parentPort.postMessage({ ok: true, text: "x", confidence: 900 }); setInterval(() => {}, 1000);`,
      workerOptions,
    );
    await expect(collectLocalOCRWorker(malformed, 2000)).rejects.toThrow(
      "did not complete",
    );
    expect(malformed.threadId).toBe(-1);
    const exited = new Worker(`process.exit(0);`, workerOptions);
    await expect(collectLocalOCRWorker(exited, 2000)).rejects.toThrow(
      "exited before completion",
    );
    expect(exited.threadId).toBe(-1);
  });

  it("does not leak a worker when a caller supplies an invalid deadline", async () => {
    const worker = new Worker(`setInterval(() => {}, 1000);`, workerOptions);
    await expect(collectLocalOCRWorker(worker, 20_000)).rejects.toThrow(
      "Invalid local OCR deadline",
    );
    expect(worker.threadId).toBe(-1);
  });
});
