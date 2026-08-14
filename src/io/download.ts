/**
 * Turning a string into a file the browser saves.
 *
 * The only file in the app that touches Blob, object URLs or the DOM for downloads,
 * so everything else in the io layer stays pure and testable.
 */

export interface DownloadableFile {
  filename: string;
  mimeType: string;
  contents: string;
}

export function isDownloadSupported(): boolean {
  return (
    typeof document !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  );
}

/**
 * Save a file. Throws if the environment cannot do it, so a caller can refuse to
 * proceed rather than assume a backup happened.
 *
 * The object URL is revoked immediately after the click; the browser has already
 * taken the data by then, and leaving them alive leaks the whole file in memory.
 */
export function downloadFile(file: DownloadableFile): void {
  if (!isDownloadSupported()) {
    throw new Error('This browser cannot save files from the page');
  }

  const blob = new Blob([file.contents], { type: `${file.mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.filename;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
