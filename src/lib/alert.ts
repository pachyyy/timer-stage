/**
 * Shared vibrate+flash cue for anything a viewer needs to notice without staring at the screen: a
 * controller message arriving, or the viewer's own promotion to controller. Vibration is Android
 * only — iOS Safari has never implemented the Vibration API and the call is a silent no-op there —
 * so the visual flash is what actually reaches every viewer; vibration is a bonus, not the
 * mechanism. Chrome also withholds it until the page has had at least one user interaction, which
 * the viewer's tap-to-fullscreen handler generally satisfies.
 */
export const ALERT_FLASH_DURATION_MS = 1200
const VIBRATE_PATTERN = [120, 60, 120]

/**
 * Routed through a helper (rather than calling the setter directly at the call site) to match the
 * idiom used in use-participant.ts for the react-hooks/set-state-in-effect lint rule.
 */
export function fireAlert(onFlash: (on: boolean) => void) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(VIBRATE_PATTERN)
  }
  onFlash(true)
}
