/**
 * Augments React's JSX types to include the Invoker Commands API attributes.
 * These are newly-available attributes (Chrome/Edge 135, Firefox 144, Safari 26.2).
 *
 * References:
 *   - https://developer.chrome.com/docs/web-platform/invokers
 *   - modern-web-guidance: declarative-dialog-popover-control
 */

declare namespace React {
  interface ButtonHTMLAttributes<T> {
    /** ID of the target dialog or popover element to control. */
    commandfor?: string;
    /**
     * Invoker command to execute on the target:
     *   'show-modal' | 'close' | 'show-popover' | 'hide-popover' | 'toggle-popover'
     */
    command?: string;
  }

  interface HTMLAttributes<T> {
    /** closedby attribute for <dialog> (light-dismiss behaviour). */
    closedby?: 'any' | 'closerequest' | 'none';
  }
}
