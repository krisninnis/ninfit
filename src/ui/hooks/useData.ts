import { useCallback, useMemo, useState } from 'react';
import { readAppData } from '../../app/appData';
import { getAppContext } from '../../app/bootstrap';
import { nowTimestamp, todayISO } from '../../domain/dates';
import { buildDailyCsv } from '../../io/exportCsv';
import { buildBackup } from '../../io/exportJson';
import { downloadFile, isDownloadSupported } from '../../io/download';
import { commitImport, prepareImport, type PreparedImport } from '../../io/importJson';
import type { StorageIssue } from '../../storage/repository';
import type { AppMeta } from '../../domain/types';

/**
 * The Data screen's orchestration.
 *
 * Ordering that matters: `lastExportedAt` is stamped only AFTER the file has been
 * handed to the browser. Recording a backup that never happened would be worse than
 * recording none at all.
 */

export type DataStatus =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'exported'; filename: string }
  | { kind: 'imported'; written: number; removed: number }
  | { kind: 'error'; messages: string[] };

export interface DataState {
  meta: AppMeta | undefined;
  issues: StorageIssue[];
  isPersistent: boolean;
  canDownload: boolean;
  status: DataStatus;
  /** Set once a file has been validated and is waiting for confirmation. */
  pending: PreparedImport | undefined;

  exportBackup: () => void;
  exportCsv: () => void;
  chooseFile: (text: string) => void;
  cancelImport: () => void;
  confirmImport: () => void;
}

export function useData(): DataState {
  const context = useMemo(() => getAppContext(), []);
  const repository = context.repository;

  const [status, setStatus] = useState<DataStatus>({ kind: 'idle' });
  const [pending, setPending] = useState<PreparedImport | undefined>(undefined);
  const [revision, setRevision] = useState(0);

  const meta = useMemo(() => {
    void revision;
    return repository.getMeta();
  }, [repository, revision]);

  const issues = useMemo(() => {
    void revision;
    return repository.getIssues();
  }, [repository, revision]);

  const exportBackup = useCallback(() => {
    setStatus({ kind: 'working' });
    try {
      const backup = buildBackup(repository);
      downloadFile(backup);
      // Only now is it true that a backup exists.
      repository.updateMeta({ lastExportedAt: nowTimestamp() });
      setRevision((value) => value + 1);
      setStatus({ kind: 'exported', filename: backup.filename });
    } catch (error) {
      setStatus({ kind: 'error', messages: [`The backup could not be saved. ${String(error)}`] });
    }
  }, [repository]);

  const exportCsv = useCallback(() => {
    setStatus({ kind: 'working' });
    try {
      const file = buildDailyCsv(readAppData(repository), { today: todayISO() });
      downloadFile(file);
      // Deliberately does NOT touch lastExportedAt: a CSV is not a restorable backup.
      setStatus({ kind: 'exported', filename: file.filename });
    } catch (error) {
      setStatus({ kind: 'error', messages: [`The file could not be saved. ${String(error)}`] });
    }
  }, [repository]);

  const chooseFile = useCallback((text: string) => {
    const result = prepareImport(text);
    if (!result.ok) {
      setPending(undefined);
      setStatus({ kind: 'error', messages: result.errors });
      return;
    }
    // Validated, but nothing is written until the user confirms.
    setPending(result.prepared);
    setStatus({ kind: 'idle' });
  }, []);

  const cancelImport = useCallback(() => {
    setPending(undefined);
    setStatus({ kind: 'idle' });
  }, []);

  const confirmImport = useCallback(() => {
    if (pending === undefined) return;
    setStatus({ kind: 'working' });

    const result = commitImport(repository, pending, {
      backupCurrentData: () => {
        if (!isDownloadSupported()) return false;
        downloadFile(buildBackup(repository));
        return true;
      },
    });

    if (!result.ok) {
      setStatus({ kind: 'error', messages: result.errors });
      return;
    }

    setPending(undefined);
    setStatus({ kind: 'imported', written: result.dailyLogsWritten, removed: result.dailyLogsRemoved });
  }, [pending, repository]);

  return {
    meta,
    issues,
    isPersistent: context.isPersistent,
    canDownload: isDownloadSupported(),
    status,
    pending,
    exportBackup,
    exportCsv,
    chooseFile,
    cancelImport,
    confirmImport,
  };
}
