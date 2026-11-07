/** Date to display for a record: the seeded story date for demo rows, otherwise the real creation time. */
export function shownAt(d: { _creationTime: number; seededAt?: number }): number {
  return d.seededAt ?? d._creationTime;
}
