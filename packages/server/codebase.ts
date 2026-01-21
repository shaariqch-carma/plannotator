/**
 * Codebase Operations
 *
 * Server-side file operations for agentic AI review.
 * All operations are secured to the project directory to prevent path traversal.
 */

import { readdir, stat } from "fs/promises";
import { join, resolve, relative, isAbsolute } from "path";

export interface SearchResult {
  file: string;
  line: number;
  content: string;
}

const MAX_FILE_LINES = 1000;
const MAX_SEARCH_RESULTS = 50;

export const validatePath = (
  projectRoot: string,
  requestedPath: string
): string | null => {
  const normalizedRoot = resolve(projectRoot);
  const targetPath = isAbsolute(requestedPath)
    ? resolve(requestedPath)
    : resolve(projectRoot, requestedPath);

  const relativePath = relative(normalizedRoot, targetPath);

  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return null;
  }

  return targetPath;
};

export const readFile = async (
  projectRoot: string,
  path: string,
  maxLines: number = MAX_FILE_LINES
): Promise<string> => {
  const validPath = validatePath(projectRoot, path);
  if (!validPath) {
    throw new Error("Path outside project directory");
  }

  const file = Bun.file(validPath);
  if (!(await file.exists())) {
    throw new Error(`File not found: ${path}`);
  }

  const content = await file.text();
  const lines = content.split("\n");

  if (lines.length > maxLines) {
    return (
      lines.slice(0, maxLines).join("\n") +
      `\n\n... (truncated, showing ${maxLines} of ${lines.length} lines)`
    );
  }

  return content;
};

export interface DirectoryEntry {
  name: string;
  type: "file" | "directory";
}

export const listDirectory = async (
  projectRoot: string,
  path: string
): Promise<DirectoryEntry[]> => {
  const validPath = validatePath(projectRoot, path);
  if (!validPath) {
    throw new Error("Path outside project directory");
  }

  const entries = await readdir(validPath);
  const results: DirectoryEntry[] = [];

  for (const entry of entries) {
    if (entry.startsWith(".")) continue;

    try {
      const entryPath = join(validPath, entry);
      const stats = await stat(entryPath);
      results.push({
        name: entry,
        type: stats.isDirectory() ? "directory" : "file",
      });
    } catch {
      continue;
    }
  }

  return results.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "directory" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
};

export const searchCode = async (
  projectRoot: string,
  pattern: string,
  glob?: string
): Promise<SearchResult[]> => {
  const results: SearchResult[] = [];
  const regex = new RegExp(pattern, "gi");

  const searchDir = async (dir: string) => {
    if (results.length >= MAX_SEARCH_RESULTS) return;

    const validDir = validatePath(projectRoot, dir);
    if (!validDir) return;

    let entries: string[];
    try {
      entries = await readdir(validDir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= MAX_SEARCH_RESULTS) break;
      if (entry.startsWith(".") || entry === "node_modules") continue;

      const entryPath = join(validDir, entry);

      try {
        const stats = await stat(entryPath);

        if (stats.isDirectory()) {
          await searchDir(entryPath);
        } else if (stats.isFile()) {
          if (glob) {
            const globPattern = glob
              .replace(/\./g, "\\.")
              .replace(/\*/g, ".*")
              .replace(/\?/g, ".");
            const globRegex = new RegExp(`^${globPattern}$`);
            if (!globRegex.test(entry)) continue;
          }

          const file = Bun.file(entryPath);
          const content = await file.text();
          const lines = content.split("\n");

          for (let i = 0; i < lines.length; i++) {
            if (results.length >= MAX_SEARCH_RESULTS) break;

            if (regex.test(lines[i])) {
              results.push({
                file: relative(projectRoot, entryPath),
                line: i + 1,
                content: lines[i].trim().slice(0, 200),
              });
              regex.lastIndex = 0;
            }
          }
        }
      } catch {
        continue;
      }
    }
  };

  await searchDir(projectRoot);
  return results;
};
