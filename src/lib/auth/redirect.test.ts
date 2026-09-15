import { describe, expect, it } from 'vitest'
import { safeCallbackUrl } from './redirect'

describe('safeCallbackUrl', () => {
  it('passes through a same-origin relative path', () => {
    expect(safeCallbackUrl('/r/ABC123')).toBe('/r/ABC123')
    expect(safeCallbackUrl('/dashboard')).toBe('/dashboard')
  })

  it('falls back on a protocol-relative URL', () => {
    expect(safeCallbackUrl('//evil.com')).toBe('/dashboard')
  })

  it('falls back on an absolute URL', () => {
    expect(safeCallbackUrl('https://evil.com')).toBe('/dashboard')
  })

  it('falls back on a non-path value', () => {
    expect(safeCallbackUrl('javascript:alert(1)')).toBe('/dashboard')
    expect(safeCallbackUrl('dashboard')).toBe('/dashboard')
  })

  it('falls back on empty or missing input', () => {
    expect(safeCallbackUrl('')).toBe('/dashboard')
    expect(safeCallbackUrl(null)).toBe('/dashboard')
    expect(safeCallbackUrl(undefined)).toBe('/dashboard')
  })
})
