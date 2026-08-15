/** The identity fields needed to decide whether a content row needs writing. */
export interface ContentSeedVersion {
  readonly entry_id: string;
  readonly kind: string;
  readonly content_version: string;
}

/** Local rows that are missing remotely or differ in kind/payload version. */
export function contentRowsNeedingUpsert<T extends ContentSeedVersion>(
  local: readonly T[],
  remote: readonly ContentSeedVersion[],
): T[] {
  const remoteById = new Map(remote.map((row) => [row.entry_id, row]));
  return local.filter((candidate) => {
    const current = remoteById.get(candidate.entry_id);
    return (
      current === undefined ||
      current.kind !== candidate.kind ||
      current.content_version !== candidate.content_version
    );
  });
}
