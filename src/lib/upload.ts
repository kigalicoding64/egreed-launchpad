import { unzipSync, strFromU8 } from "fflate";

export interface ParsedUpload {
  files: Record<string, string>;
  skipped: string[];
  totalBytes: number;
}

const MAX_FILE_BYTES = 400_000;
const MAX_FILES = 400;
const MAX_TOTAL_BYTES = 8_000_000;

const TEXT_EXT = new RegExp(
  "\\.(html?|css|scss|sass|less|js|mjs|cjs|jsx|ts|tsx|json|md|markdown|txt|svg|xml|yml|yaml|toml|env|csv|graphql|vue|svelte|astro|py|rb|php|go|rs|java|sh|lock)$",
  "i",
);

const IGNORE = /(^|\/)(node_modules|\.git|\.next|\.cache|dist\/assets\/.*\.map|__MACOSX)(\/|$)/i;

/** Strip a single common top-level folder (as produced by GitHub ZIP exports). */
function stripCommonRoot(paths: string[]) {
  const roots = new Set(paths.map((p) => p.split("/")[0]));
  if (roots.size !== 1) return null;
  const only = [...roots][0];
  if (paths.every((p) => p.includes("/"))) return `${only}/`;
  return null;
}

function normalise(files: Record<string, string>): Record<string, string> {
  const paths = Object.keys(files);
  const root = stripCommonRoot(paths);
  if (!root) return files;
  const out: Record<string, string> = {};
  for (const [p, c] of Object.entries(files)) out[p.slice(root.length)] = c;
  return out;
}

/** Read a ZIP archive, a folder selection, or loose files into a path→text map. */
export async function parseUpload(fileList: FileList | File[]): Promise<ParsedUpload> {
  const input = Array.from(fileList);
  const files: Record<string, string> = {};
  const skipped: string[] = [];
  let totalBytes = 0;

  const add = (path: string, bytes: number, read: () => Promise<string> | string) => {
    if (IGNORE.test(path)) return null;
    if (!TEXT_EXT.test(path)) {
      skipped.push(path);
      return null;
    }
    if (bytes > MAX_FILE_BYTES || totalBytes + bytes > MAX_TOTAL_BYTES) {
      skipped.push(path);
      return null;
    }
    if (Object.keys(files).length >= MAX_FILES) {
      skipped.push(path);
      return null;
    }
    totalBytes += bytes;
    return read();
  };

  for (const file of input) {
    if (/\.zip$/i.test(file.name)) {
      const buf = new Uint8Array(await file.arrayBuffer());
      const entries = unzipSync(buf);
      for (const [name, data] of Object.entries(entries)) {
        if (name.endsWith("/")) continue;
        const value = add(name, data.length, () => strFromU8(data));
        if (value !== null) files[name] = value as string;
      }
      continue;
    }
    const rel =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const value = add(rel, file.size, () => file.text());
    if (value !== null) files[rel] = await value;
  }

  return { files: normalise(files), skipped, totalBytes };
}

/** Best-effort framework detection from an uploaded file set. */
export function detectFramework(files: Record<string, string>): string {
  const pkg = files["package.json"];
  if (pkg) {
    const lower = pkg.toLowerCase();
    if (lower.includes('"next"')) return "next";
    if (lower.includes('"vite"') || lower.includes('"react"')) return "vite";
    if (lower.includes('"astro"')) return "astro";
    return "node";
  }
  if (Object.keys(files).some((p) => p.endsWith("index.html"))) return "static";
  return "static";
}
