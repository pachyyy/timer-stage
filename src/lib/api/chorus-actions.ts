/**
 * Client-side wrappers around the Chorus API routes — the counterpart of room-actions.ts. Every
 * controller mutation resolves with the fresh ChorusControlPayload; callers feed it to
 * useChorusControl's `applyControl` so the operator's own screen updates instantly.
 */
import { ActionError } from './room-actions'
import type { ChorusControlPayload } from '@/lib/chorus/types'

export { ActionError }

async function request<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ActionError(typeof body?.error === 'string' ? body.error : `Request failed: ${res.status}`, res.status)
  }
  return res.json()
}

const send = <T = ChorusControlPayload>(method: string, url: string, body: unknown) =>
  request<T>(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

const action = (code: string, token: string, body: Record<string, unknown>) =>
  send('POST', `/api/chorus/${code}/actions`, { token, ...body })

export interface CreatedChorus {
  code: string
  controllerToken: string
  presenterToken: string
}

export const chorusActions = {
  create: (input: { name: string; questions: string[]; linkRoomId?: string; roomToken?: string }) =>
    send<CreatedChorus>('POST', '/api/chorus', input),
  load: (code: string, token: string) =>
    request<ChorusControlPayload>(`/api/chorus/${code}/questions?token=${encodeURIComponent(token)}`, {
      cache: 'no-store',
    }),

  present: (code: string, token: string) => action(code, token, { action: 'present' }),
  next: (code: string, token: string) => action(code, token, { action: 'next' }),
  prev: (code: string, token: string) => action(code, token, { action: 'prev' }),
  goto: (code: string, token: string, questionId: string) => action(code, token, { action: 'goto', questionId }),
  end: (code: string, token: string) => action(code, token, { action: 'end' }),
  font: (code: string, token: string, deltaPercent: number) => action(code, token, { action: 'font', deltaPercent }),

  addQuestion: (code: string, token: string, prompt: string) =>
    send('POST', `/api/chorus/${code}/questions`, { token, prompt }),
  updateQuestion: (code: string, token: string, questionId: string, prompt: string) =>
    send('PATCH', `/api/chorus/${code}/questions/${questionId}`, { token, prompt }),
  deleteQuestion: (code: string, token: string, questionId: string) =>
    request<ChorusControlPayload>(
      `/api/chorus/${code}/questions/${questionId}?token=${encodeURIComponent(token)}`,
      { method: 'DELETE' },
    ),
  reorderQuestions: (code: string, token: string, order: string[]) =>
    send('PATCH', `/api/chorus/${code}/questions`, { token, order }),
  rename: (code: string, token: string, name: string) => send('PATCH', `/api/chorus/${code}`, { token, name }),

  setAnswerHidden: (code: string, token: string, answerId: string, hidden: boolean) =>
    send<{ ok: true }>('PATCH', `/api/chorus/${code}/answers/${answerId}`, { token, hidden }),

  link: (code: string, token: string, roomId: string, roomToken: string) =>
    send('POST', `/api/chorus/${code}/link`, { token, roomId, roomToken }),
  unlink: (code: string, token: string) =>
    request<ChorusControlPayload>(`/api/chorus/${code}/link?token=${encodeURIComponent(token)}`, { method: 'DELETE' }),
}

/** The presenter window's URL. Opened with a fixed window name so pressing the button again
 * focuses the already-open window instead of stacking a second one. */
export function presenterUrl(code: string, presenterToken: string): string {
  return `/c/${code}/present?t=${encodeURIComponent(presenterToken)}`
}

export function openPresenterWindow(code: string, presenterToken: string) {
  const win = window.open(presenterUrl(code, presenterToken), `chorus-present-${code}`, 'popup,width=1280,height=720')
  win?.focus()
}
