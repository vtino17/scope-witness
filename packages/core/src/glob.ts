export function matchesGlob(path: string, pattern: string): boolean {
  const directoryToken = "\u0000";
  const token = "\u0001";
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, directoryToken)
    .replace(/\*\*/g, token)
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .replaceAll(directoryToken, "(?:.*/)?")
    .replaceAll(token, ".*");
  return new RegExp(`^${escaped}$`).test(path);
}

export const matchesAny = (path: string, patterns: string[]): boolean =>
  patterns.some((pattern) => matchesGlob(path, pattern));
