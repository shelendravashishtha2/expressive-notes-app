import ExportWorker from '../workers/exportWorker.js?worker';

function createAbortError() {
  return new DOMException('Export cancelled by user.', 'AbortError');
}

function abortIfNeeded(signal) {
  if (signal?.aborted) throw createAbortError();
}

function report(callback, value) {
  if (typeof callback === 'function') callback(value);
}

function workerCountFor(totalDocuments) {
  const cores = navigator.hardwareConcurrency || 4;
  const suggested = Math.max(1, Math.floor(cores / 2));
  return Math.max(1, Math.min(totalDocuments, Math.min(4, suggested)));
}

export async function prepareExportPlanWithWorkers(plan, options = {}) {
  const {
    signal,
    onStage,
    onProgress
  } = options;

  const documents = plan?.documents || [];
  if (!documents.length) {
    return { ...plan, documents: [] };
  }

  abortIfNeeded(signal);
  report(onStage, 'Spawning export workers');
  report(onProgress, 8);

  const workers = Array.from(
    { length: workerCountFor(documents.length) },
    () => new ExportWorker()
  );
  const preparedDocuments = new Array(documents.length);
  let nextIndex = 0;
  let completed = 0;
  let finishedWorkers = 0;
  let settled = false;
  let abortHandler = null;

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      workers.forEach((worker) => worker.terminate());
    };

    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        ...plan,
        documents: preparedDocuments
      });
    };

    abortHandler = () => fail(createAbortError());
    signal?.addEventListener('abort', abortHandler, { once: true });

    const assignTask = (worker) => {
      if (settled) return;
      if (signal?.aborted) {
        fail(createAbortError());
        return;
      }

      if (nextIndex >= documents.length) {
        finishedWorkers += 1;
        if (completed >= documents.length && finishedWorkers >= workers.length) {
          finish();
        }
        return;
      }

      const taskIndex = nextIndex;
      nextIndex += 1;

      worker.onmessage = (message) => {
        if (settled) return;
        if (signal?.aborted) {
          fail(createAbortError());
          return;
        }
        const data = message.data || {};

        if (data.type === 'prepare-error') {
          fail(new Error(data.error || 'Export worker failed.'));
          return;
        }

        if (data.type !== 'prepared-document') return;

        preparedDocuments[taskIndex] = data.payload;
        completed += 1;
        report(onStage, `Preparing chapters in workers (${completed}/${documents.length})`);
        report(onProgress, 8 + Math.round((completed / documents.length) * 32));

        assignTask(worker);
      };

      worker.onerror = (error) => {
        fail(error instanceof Error ? error : new Error('Export worker crashed.'));
      };

      worker.postMessage({
        type: 'prepare-document',
        taskId: `${taskIndex}-${Date.now()}`,
        payload: documents[taskIndex]
      });
    };

    workers.forEach(assignTask);
  }).finally(() => {
    if (abortHandler) {
      signal?.removeEventListener?.('abort', abortHandler);
    }
  });
}
