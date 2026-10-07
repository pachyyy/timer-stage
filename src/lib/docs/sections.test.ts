import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import en from '../../../messages/en.json'
import id from '../../../messages/id.json'
import { DOC_SECTIONS, docHref, findDocSection } from './sections'

// A missing message only throws when that page renders, and a missing GIF is just a broken image —
// neither fails the build, so check both here.
describe('DOC_SECTIONS', () => {
  it.each(DOC_SECTIONS.map((s) => [s.key, s] as const))('%s has copy in every locale and a GIF', (_, section) => {
    for (const messages of [en, id]) {
      const copy = messages.docs.sections[section.key]
      expect(copy.title).toBeTruthy()
      expect(copy.lead).toBeTruthy()
      expect(copy.tip).toBeTruthy()
      expect(copy.steps.length).toBeGreaterThan(0)
    }
    expect(existsSync(path.join(__dirname, '../../../public/docs', `${section.slug}.gif`))).toBe(true)
  })

  it('serves Overview at /docs and the rest under it', () => {
    expect(docHref(DOC_SECTIONS[0])).toBe('/docs')
    expect(docHref(findDocSection('run-timer')!)).toBe('/docs/run-timer')
    expect(findDocSection('nope')).toBeUndefined()
  })
})
