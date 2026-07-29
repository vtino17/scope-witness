import { sha256 } from "./canonical.js";
import type {
  ChangedFile,
  DiffHunk,
  DiffInventory,
} from "./types.js";

interface MutableFile extends Omit<ChangedFile, "hunks"> {
  hunks: Array<Omit<DiffHunk, "id">>;
}

const parseRange = (header: string): [number, number, number, number] => {
  const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(header);
  if (!match) return [0, 0, 0, 0];
  return [
    Number(match[1]),
    Number(match[2] ?? 1),
    Number(match[3]),
    Number(match[4] ?? 1),
  ];
};

export async function parseUnifiedDiff(patch: string): Promise<DiffInventory> {
  const lines = patch.replace(/\r\n/g, "\n").split("\n");
  const files: MutableFile[] = [];
  let file: MutableFile | undefined;
  let hunk: Omit<DiffHunk, "id"> | undefined;
  const closeHunk = (): void => {
    if (file && hunk) {
      file.hunks.push(hunk);
      file.additions += hunk.additions;
      file.deletions += hunk.deletions;
    }
    hunk = undefined;
  };
  for (const line of lines) {
    const fileMatch = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (fileMatch) {
      closeHunk();
      file = {
        oldPath: fileMatch[1]!,
        path: fileMatch[2]!,
        kind: "modified",
        additions: 0,
        deletions: 0,
        binary: false,
        hunks: [],
      };
      files.push(file);
      continue;
    }
    if (!file) continue;
    if (line.startsWith("new file mode ")) file.kind = "added";
    if (line.startsWith("deleted file mode ")) file.kind = "deleted";
    if (line.startsWith("rename from ")) {
      file.kind = "renamed";
      file.oldPath = line.slice("rename from ".length);
    }
    if (line.startsWith("rename to ")) file.path = line.slice("rename to ".length);
    if (line.startsWith("Binary files ") || line === "GIT binary patch") file.binary = true;
    if (line.startsWith("@@ ")) {
      closeHunk();
      const [oldStart, oldLines, newStart, newLines] = parseRange(line);
      hunk = { header: line, oldStart, oldLines, newStart, newLines, additions: 0, deletions: 0, content: "" };
      continue;
    }
    if (hunk) {
      hunk.content += `${line}\n`;
      if (line.startsWith("+") && !line.startsWith("+++")) hunk.additions++;
      if (line.startsWith("-") && !line.startsWith("---")) hunk.deletions++;
    }
  }
  closeHunk();
  const completed: ChangedFile[] = [];
  for (const entry of files) {
    const hunks: DiffHunk[] = [];
    for (const item of entry.hunks) {
      hunks.push({
        ...item,
        id: (await sha256(`${entry.path}\n${item.header}\n${item.content}`)).slice(0, 16),
      });
    }
    completed.push({ ...entry, hunks });
  }
  const additions = completed.reduce((sum, entry) => sum + entry.additions, 0);
  const deletions = completed.reduce((sum, entry) => sum + entry.deletions, 0);
  return {
    files: completed,
    totalFiles: completed.length,
    additions,
    deletions,
    changedLines: additions + deletions,
    patchHash: await sha256(patch.replace(/\r\n/g, "\n")),
  };
}
