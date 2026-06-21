import { useCallback, useEffect, useRef, useState } from 'react';
import PdfExportWorker from '../workers/pdfExportWorker.js?worker';

const initialTaskState = {
  taskId: '',
  status: 'idle',
  stage: 'Idle',
  progress: 0,
  error: '',
  request: null,
  filename: ''
};

const RUNNING_STATUSES = new Set(['queued', 'preparing', 'rendering', 'finalizing']);

function safePercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function createTaskId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `export-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function downloadArrayBuffer(arrayBuffer, filename) {
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || 'notes.pdf';
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 2500);
}

export function useExportTask() {
  const workerRef = useRef(null);
  const activeTaskIdRef = useRef('');
  const lastProgressPaintRef = useRef(0);
  const [task, setTask] = useState(initialTaskState);

  const terminateWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  const resetTask = useCallback(() => {
    terminateWorker();
    activeTaskIdRef.current = '';
    lastProgressPaintRef.current = 0;
    setTask(initialTaskState);
  }, [terminateWorker]);

  const cancelExport = useCallback(() => {
    const taskId = activeTaskIdRef.current;
    terminateWorker();
    activeTaskIdRef.current = '';
    setTask((current) => ({
      ...current,
      taskId,
      status: 'cancelled',
      stage: 'Cancelled',
      progress: 0,
      error: '',
      request: null
    }));
  }, [terminateWorker]);

  const startExport = useCallback((request) => {
    if (!request?.plan?.documents?.length) return;

    terminateWorker();

    const taskId = createTaskId();
    const filename = request.filename || 'notes.pdf';
    const worker = new PdfExportWorker();
    workerRef.current = worker;
    activeTaskIdRef.current = taskId;
    lastProgressPaintRef.current = 0;

    setTask({
      taskId,
      status: 'queued',
      stage: 'Starting background export',
      progress: 3,
      error: '',
      request,
      filename
    });

    worker.onmessage = (message) => {
      const data = message.data || {};
      if (data.taskId !== activeTaskIdRef.current) return;

      if (data.type === 'progress') {
        const now = performance.now();
        const nextProgress = safePercent(data.progress);
        const shouldPaint = now - lastProgressPaintRef.current > 80 || nextProgress >= 100;
        if (!shouldPaint) return;
        lastProgressPaintRef.current = now;

        setTask((current) => {
          if (current.taskId !== data.taskId) return current;
          return {
            ...current,
            status: RUNNING_STATUSES.has(data.status) ? data.status : current.status,
            stage: data.stage || current.stage,
            progress: Math.max(current.progress || 0, nextProgress),
            error: ''
          };
        });
        return;
      }

      if (data.type === 'completed') {
        terminateWorker();
        activeTaskIdRef.current = '';
        try {
          downloadArrayBuffer(data.arrayBuffer, data.filename || filename);
          setTask((current) => ({
            ...current,
            taskId: data.taskId,
            status: 'completed',
            stage: 'Download started',
            progress: 100,
            error: '',
            request: null,
            filename: data.filename || filename
          }));
        } catch (error) {
          setTask((current) => ({
            ...current,
            taskId: data.taskId,
            status: 'error',
            stage: 'Download failed',
            progress: current.progress,
            error: error?.message || 'The PDF was generated, but the browser download failed.',
            request: null
          }));
        }
        return;
      }

      if (data.type === 'error') {
        terminateWorker();
        activeTaskIdRef.current = '';
        setTask((current) => ({
          ...current,
          taskId: data.taskId,
          status: 'error',
          stage: 'Export failed',
          progress: current.progress,
          error: data.error || 'Unable to generate the PDF.',
          request: null
        }));
      }
    };

    worker.onerror = (error) => {
      if (taskId !== activeTaskIdRef.current) return;
      terminateWorker();
      activeTaskIdRef.current = '';
      setTask((current) => ({
        ...current,
        taskId,
        status: 'error',
        stage: 'Export failed',
        progress: current.progress,
        error: error?.message || 'PDF export worker crashed.',
        request: null
      }));
    };

    worker.postMessage({
      type: 'start-pdf-export',
      taskId,
      payload: {
        plan: request.plan,
        filename,
        generatedAt: request.generatedAt
      }
    });
  }, [terminateWorker]);

  useEffect(() => () => terminateWorker(), [terminateWorker]);

  return {
    task,
    startExport,
    cancelExport,
    resetTask,
    isExportRunning: RUNNING_STATUSES.has(task.status)
  };
}
