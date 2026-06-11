export interface Debounced<T extends (...args: never[]) => void> {
  (...args: Parameters<T>): void;
  cancel(): void;
}

/** Returns a debounced wrapper that delays calls until `delayMs` of quiet time. */
export function debounce<T extends (...args: never[]) => void>(fn: T, delayMs: number): Debounced<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const wrapper = (...args: Parameters<T>) => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, delayMs);
  };
  wrapper.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  };
  return wrapper;
}
