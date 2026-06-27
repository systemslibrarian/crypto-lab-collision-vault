// Thin client over the hashing worker used by the UI. If the worker cannot be
// constructed (older browser, blocked worker), it transparently falls back to
// hashing on the main thread so the demo still works — just without the
// off-thread benefit. Either way, failures surface; nothing is silently blank.

import {
  hashBytes,
  bytesToHex,
  selfTest as mainThreadSelfTest,
  type HashAlgorithm,
  type SelfTestResult
} from './index';
import type { WorkerRequest, WorkerResponse } from '../workers/hash.worker';

export type ProgressCallback = (algo: HashAlgorithm, done: number, total: number) => void;

interface Pending {
  resolve: (results: Partial<Record<HashAlgorithm, string>>) => void;
  reject: (err: Error) => void;
  selfResolve?: (r: SelfTestResult) => void;
  onProgress?: ProgressCallback;
}

export class HashClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();

  constructor() {
    try {
      this.worker = new Worker(new URL('../workers/hash.worker.ts', import.meta.url), {
        type: 'module'
      });
      this.worker.addEventListener('message', (ev: MessageEvent<WorkerResponse>) =>
        this.onMessage(ev.data)
      );
      this.worker.addEventListener('error', () => {
        // Construction succeeded but the worker errored fatally. Reject every
        // in-flight request (so the UI surfaces an error instead of hanging on a
        // spinner) and drop to the main-thread fallback for future calls.
        const err = new Error('Hashing worker crashed.');
        for (const [, entry] of this.pending) entry.reject(err);
        this.pending.clear();
        this.worker = null;
      });
    } catch {
      this.worker = null;
    }
  }

  /** True when hashing runs off the main thread. */
  get offMainThread(): boolean {
    return this.worker !== null;
  }

  private onMessage(msg: WorkerResponse): void {
    const entry = this.pending.get(msg.id);
    if (!entry) return;
    switch (msg.type) {
      case 'progress':
        entry.onProgress?.(msg.algo, msg.done, msg.total);
        break;
      case 'done':
        this.pending.delete(msg.id);
        entry.resolve(msg.results);
        break;
      case 'selftest':
        this.pending.delete(msg.id);
        entry.selfResolve?.({ ok: msg.ok, failures: msg.failures });
        break;
      case 'error':
        this.pending.delete(msg.id);
        entry.reject(new Error(msg.message));
        break;
    }
  }

  /** Validate every known-answer vector. */
  async selfTest(): Promise<SelfTestResult> {
    if (!this.worker) return mainThreadSelfTest();
    const id = this.nextId++;
    return new Promise<SelfTestResult>((resolve, reject) => {
      this.pending.set(id, {
        resolve: () => {},
        reject,
        selfResolve: resolve
      });
      this.worker!.postMessage({ id, kind: 'selftest' } satisfies WorkerRequest);
    });
  }

  /** Hash one file under all requested algorithms, reporting per-algo progress. */
  async hashFile(
    bytes: Uint8Array,
    algos: HashAlgorithm[],
    onProgress?: ProgressCallback
  ): Promise<Partial<Record<HashAlgorithm, string>>> {
    if (!this.worker) return this.hashOnMainThread(bytes, algos, onProgress);
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress });
      // Structured-clone the bytes (no transfer) so the caller keeps its copy
      // for the byte-diff viewer.
      this.worker!.postMessage({ id, kind: 'hash', bytes, algos } satisfies WorkerRequest);
    });
  }

  private async hashOnMainThread(
    bytes: Uint8Array,
    algos: HashAlgorithm[],
    onProgress?: ProgressCallback
  ): Promise<Partial<Record<HashAlgorithm, string>>> {
    const results: Partial<Record<HashAlgorithm, string>> = {};
    for (let i = 0; i < algos.length; i++) {
      const algo = algos[i];
      results[algo] = bytesToHex(await hashBytes(algo, bytes));
      onProgress?.(algo, i + 1, algos.length);
      // Yield so a large main-thread hash still lets the UI paint progress.
      await new Promise((r) => setTimeout(r, 0));
    }
    return results;
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
