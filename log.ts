let warningDisabled = false;
export function disableWarnings() {
  warningDisabled = true;
}

export function warn(...args: any[]) {
  if (warningDisabled) {
    return;
  }

  console.warn('[use-memory-value]', ...args);
}
