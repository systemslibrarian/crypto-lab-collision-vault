// Off-main-thread hashing. The SHAttered PDFs are ~400 KB each and we hash them
// under five algorithms; doing that on the UI thread would jank the page. The
// worker hashes a file under all requested algorithms and reports incremental
// progress (one tick per algorithm) so the UI can drive an aria-live indicator.

import { hashBytes, bytesToHex, selfTest, type HashAlgorithm } from '../hashing/index';

export interface HashRequest {
  id: number;
  kind: 'hash';
  bytes: Uint8Array;
  algos: HashAlgorithm[];
}

export interface SelfTestRequest {
  id: number;
  kind: 'selftest';
}

export type WorkerRequest = HashRequest | SelfTestRequest;

export interface ProgressMessage {
  id: number;
  type: 'progress';
  algo: HashAlgorithm;
  done: number;
  total: number;
}

export interface HashDoneMessage {
  id: number;
  type: 'done';
  results: Partial<Record<HashAlgorithm, string>>;
}

export interface SelfTestMessage {
  id: number;
  type: 'selftest';
  ok: boolean;
  failures: string[];
}

export interface ErrorMessage {
  id: number;
  type: 'error';
  message: string;
}

export type WorkerResponse =
  | ProgressMessage
  | HashDoneMessage
  | SelfTestMessage
  | ErrorMessage;

const ctx = self as unknown as Worker;

ctx.addEventListener('message', async (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data;
  try {
    if (req.kind === 'selftest') {
      const { ok, failures } = await selfTest();
      ctx.postMessage({ id: req.id, type: 'selftest', ok, failures } satisfies SelfTestMessage);
      return;
    }
    const results: Partial<Record<HashAlgorithm, string>> = {};
    const total = req.algos.length;
    for (let i = 0; i < total; i++) {
      const algo = req.algos[i];
      const digest = await hashBytes(algo, req.bytes);
      results[algo] = bytesToHex(digest);
      ctx.postMessage({
        id: req.id,
        type: 'progress',
        algo,
        done: i + 1,
        total
      } satisfies ProgressMessage);
    }
    ctx.postMessage({ id: req.id, type: 'done', results } satisfies HashDoneMessage);
  } catch (err) {
    ctx.postMessage({
      id: req.id,
      type: 'error',
      message: (err as Error).message ?? String(err)
    } satisfies ErrorMessage);
  }
});
