/**
 * Pure helpers for agenda drag-reorder. Shared between the optimistic client-side reorder (moving
 * an id from one index to another as the drag ends) and the server route's validation that an
 * incoming `order` array is a genuine permutation of the room's existing timer ids before it's
 * allowed to overwrite every segment's position in one write.
 */

/** Moves the id at `fromIndex` to `toIndex`, leaving every other id's relative order untouched. */
export function applyReorder<T>(ids: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= ids.length ||
    toIndex >= ids.length
  ) {
    return ids
  }
  const next = ids.slice()
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

/** True iff `order` contains exactly the ids in `existingIds`, each exactly once (order-agnostic). */
export function isPermutation(order: string[], existingIds: string[]): boolean {
  if (order.length !== existingIds.length) return false
  const existing = new Set(existingIds)
  const seen = new Set<string>()
  for (const id of order) {
    if (!existing.has(id) || seen.has(id)) return false
    seen.add(id)
  }
  return true
}
