/**
 * Presentation clickers send keys to whichever window has focus — during a show, usually the
 * presenter window. That window can't act on them (it only holds the read-only presenter token),
 * so it forwards these to the control window that opened it, which owns Next/Previous.
 */
export const CHORUS_NAV_KEYS = ['ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp'] as const
export const CHORUS_KEY_MESSAGE = 'chorus-key'

export type ChorusNavDirection = 'next' | 'prev'

export function navDirection(key: string): ChorusNavDirection | null {
  if (key === 'ArrowRight' || key === 'PageDown') return 'next'
  if (key === 'ArrowLeft' || key === 'PageUp') return 'prev'
  return null
}

export interface ChorusKeyMessage {
  type: typeof CHORUS_KEY_MESSAGE
  code: string
  key: string
}

export function isChorusKeyMessage(data: unknown, code: string): data is ChorusKeyMessage {
  if (typeof data !== 'object' || data === null) return false
  const msg = data as Partial<ChorusKeyMessage>
  return msg.type === CHORUS_KEY_MESSAGE && msg.code === code && typeof msg.key === 'string'
}
