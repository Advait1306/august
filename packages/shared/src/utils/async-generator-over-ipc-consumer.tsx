import { randomUUID } from "crypto";
import { ipcRenderer } from "electron";

export function asyncGeneratorOverIPCConsumer<T>(f: (id: string) => void) {
  const id = randomUUID();

  // Internal queues + state
  const queue: Array<{ value: T; done: boolean }> = [];
  let done = false;
  let error: Error | null = null;

  let pendingResolve: ((v: IteratorResult<any>) => void) | null = null;
  let pendingReject: ((e: any) => void) | null = null;

  const onChunk = (_: any, msg: T) => {
    const item = { value: msg, done: false as const };
    if (pendingResolve) {
      const r = pendingResolve;
      pendingResolve = null;
      pendingReject = null;
      r(item);
    } else {
      queue.push(item);
    }
  };

  const onDone = () => {
    done = true;
    if (pendingResolve) {
      const r = pendingResolve;
      pendingResolve = null;
      pendingReject = null;
      r({ value: undefined, done: true });
    }
    cleanup();
  };

  const onError = (_: any, msg: any) => {
    error = new Error(msg.message);
    if (pendingReject) {
      const rej = pendingReject;
      pendingResolve = null;
      pendingReject = null;
      rej(error);
    }
    cleanup();
  };

  function cleanup() {
    ipcRenderer.removeListener(`stream:chunk-${id}`, onChunk);
    ipcRenderer.removeListener(`stream:done-${id}`, onDone);
    ipcRenderer.removeListener(`stream:error-${id}`, onError);
  }

  ipcRenderer.on(`stream:chunk-${id}`, onChunk);
  ipcRenderer.on(`stream:done-${id}`, onDone);
  ipcRenderer.on(`stream:error-${id}`, onError);

  f(id);

  const iterator: AsyncIterator<any> = {
    next() {
      if (error) return Promise.reject(error);
      if (queue.length) {
        return Promise.resolve(queue.shift()!);
      }
      if (done) return Promise.resolve({ value: undefined, done: true });
      return new Promise<IteratorResult<any>>((resolve, reject) => {
        pendingResolve = resolve;
        pendingReject = reject;
      });
    },
    return() {
      // Consumer stopped early — cancel upstream if you support it
      cleanup();
      return Promise.resolve({ value: undefined, done: true });
    },
    throw(err) {
      cleanup();
      return Promise.reject(err);
    },
  };

  return {
    [Symbol.asyncIterator]() {
      return iterator;
    },
  };
}
