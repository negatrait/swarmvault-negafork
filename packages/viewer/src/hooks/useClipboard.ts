/**
 * Custom hook to safely write text to the system clipboard.
 *
 * @summary Provides a safe interface to navigator.clipboard.writeText.
 * @returns An object containing the copyToClipboard function.
 */
export function useClipboard() {
  /**
   * Attempts to copy the provided text to the clipboard.
   *
   * @param text - The string to copy.
   * @returns A promise that resolves to true if the copy was successful, false otherwise.
   */
  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  return { copyToClipboard };
}
