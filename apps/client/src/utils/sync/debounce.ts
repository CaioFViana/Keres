type Timeout = ReturnType<typeof setTimeout>;

export function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number = 1000) {
  // Default to 1000ms
  let timeout: Timeout | undefined = undefined;

  const debounced: F & { cancel?: () => void } = ((...args: Parameters<F>): void => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func(...args);
    }, waitFor);
  }) as F & { cancel?: () => void }; // Assert the type of debounced

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = undefined; // Clear the timeout ID after canceling
    }
  };

  return debounced;
}
