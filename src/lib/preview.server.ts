/**
 * Real repository preview builder.
 *
 * Pulls the actual contents of the user's GitHub repository at the latest
 * commit and assembles a self-contained HTML document that can be rendered
 * inside a sandboxed iframe — no domain, DNS or SSL required.
 */

const GH_API = "https://api.github.com";

export interface RepoRef {
  owner: string;
  repo: string;
}

export interface PreviewResult {
  html: string;
  commitHash: string | null;
  commitMessage: string | null;
  commitAuthor: string | null;
  commitDate: string | null;
  source: string;
  entryPath: string | null;
  warnings: string[];
}

export function parseRepo(repositoryUrl: string, repositoryName: string): RepoRef | null {
  const fromUrl = repositoryUrl?.match(/github\.com[/:]([^/]+)\/([^/#?]+)/i);
  if (fromUrl) return { owner: fromUrl[1], repo: fromUrl[2].replace(/\.git$/, "") };
  const parts = (repositoryName ?? "").split("/");
  if (parts.length === 2 && parts[0] && parts[1]) return { owner: parts[0], repo: parts[1] };
  return null;
}

const ghHeaders: Record<string, string> = {
  Accept: "application/vnd.github+json",
  "User-Agent": "egreed-deploy-preview",
};

async function ghJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { headers: ghHeaders });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

async function rawFile(ref: RepoRef, sha: string, path: string): Promise<string | null> {
  const res = await fetch(
    `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${sha}/${path}`,
    { headers: { "User-Agent": "egreed-deploy-preview" } },
  );
  if (!res.ok) return null;
  const text = await res.text();
  return text.length > 800_000 ? text.slice(0, 800_000) : text;
}

function rawBase(ref: RepoRef, sha: string, dir: string) {
  const clean = dir ? `${dir.replace(/\/$/, "")}/` : "";
  return `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${sha}/${clean}`;
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Very small markdown → HTML renderer for README fallbacks. */
function renderMarkdown(md: string) {
  const lines = escapeHtml(md).split("\n");
  const out: string[] = [];
  let inCode = false;
  let inList = false;
  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      out.push(inCode ? "</code></pre>" : "<pre><code>");
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      out.push(line);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      out.push(`<h${heading[1].length}>${heading[2]}</h${heading[1].length}>`);
      continue;
    }
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${li[1]}</li>`);
      continue;
    }
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
    if (!line.trim()) out.push("");
    else out.push(`<p>${line}</p>`);
  }
  if (inList) out.push("</ul>");
  if (inCode) out.push("</code></pre>");
  return out
    .join("\n")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

const SHELL_CSS = `
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
background:#0b0f0e;color:#e6efec;line-height:1.6}
.wrap{max-width:820px;margin:0 auto;padding:40px 24px 64px}
h1,h2,h3,h4{font-weight:650;line-height:1.25;margin:1.6em 0 .5em;color:#f4faf8}
h1{font-size:1.9rem;margin-top:0}
a{color:#34d3a6}
p{margin:.7em 0;color:#c3d2cd}
ul{padding-left:1.2rem;color:#c3d2cd}
code{background:#16211e;padding:.15em .4em;border-radius:6px;font-size:.87em;color:#7ee7c2}
pre{background:#111a18;border:1px solid #1e2c28;border-radius:12px;padding:16px;overflow:auto}
pre code{background:none;padding:0;color:#cfe9e0}
.badge{display:inline-flex;align-items:center;gap:8px;border:1px solid #1e5f4b;background:#0f2b23;
color:#34d3a6;border-radius:999px;padding:6px 14px;font-size:.75rem;letter-spacing:.02em}
.meta{margin-top:18px;border:1px solid #1e2c28;background:#0f1614;border-radius:14px;padding:16px;
font-size:.82rem;color:#94a8a2}
.meta b{color:#e6efec;font-weight:600}
hr{border:0;border-top:1px solid #1e2c28;margin:32px 0}
`;

function shell(title: string, body: string, envScript: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><style>${SHELL_CSS}</style>${envScript}</head>
<body><div class="wrap">${body}</div></body></html>`;
}

function envScriptTag(env: Record<string, string>) {
  return `<script>window.__ENV__=${JSON.stringify(env).replace(/</g, "\\u003c")};window.process={env:window.__ENV__};</script>`;
}

const ENTRY_CANDIDATES = [
  "index.html",
  "public/index.html",
  "dist/index.html",
  "build/index.html",
  "docs/index.html",
  "src/index.html",
  "app/index.html",
];

/**
 * Build a real preview document for a repository at its latest commit.
 */
export async function buildRepoPreview(opts: {
  repositoryUrl: string;
  repositoryName: string;
  branch: string;
  projectName: string;
  framework: string;
  env: Record<string, string>;
}): Promise<PreviewResult> {
  const warnings: string[] = [];
  const ref = parseRepo(opts.repositoryUrl, opts.repositoryName);
  if (!ref) throw new Error("Could not determine the GitHub owner/repo for this project.");

  const branch = opts.branch || "main";
  const commit = await ghJson<{
    sha: string;
    commit: { message: string; author: { name: string; date: string } };
  }>(`${GH_API}/repos/${ref.owner}/${ref.repo}/commits/${encodeURIComponent(branch)}`);

  if (!commit) {
    throw new Error(
      `GitHub could not be reached for ${ref.owner}/${ref.repo}@${branch}. Check the repository is public and the branch exists.`,
    );
  }

  const sha = commit.sha;
  const envTag = envScriptTag(opts.env);

  // 1. Try to serve a real static entry point from the repo.
  for (const path of ENTRY_CANDIDATES) {
    const html = await rawFile(ref, sha, path);
    if (!html) continue;
    const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    const base = rawBase(ref, sha, dir);
    const doc = html
      .replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n<base href="${base}">\n${envTag}`)
      .replace(/^(?![\s\S]*<head)/i, () => "");
    const withEnv = /<head/i.test(html)
      ? doc
      : `<head><base href="${base}">${envTag}</head>${html}`;
    return {
      html: withEnv,
      commitHash: sha,
      commitMessage: commit.commit.message.split("\n")[0],
      commitAuthor: commit.commit.author?.name ?? null,
      commitDate: commit.commit.author?.date ?? null,
      source: "static-entry",
      entryPath: path,
      warnings,
    };
  }

  // 2. No static entry — render the repository README as a real content preview.
  warnings.push(
    "No prebuilt index.html found in the repository, so the README and repository contents are rendered instead. Commit a build output (dist/ or public/) to preview the compiled app.",
  );

  const readme =
    (await rawFile(ref, sha, "README.md")) ?? (await rawFile(ref, sha, "readme.md")) ?? null;

  const tree = await ghJson<{ tree: { path: string; type: string }[] }>(
    `${GH_API}/repos/${ref.owner}/${ref.repo}/git/trees/${sha}`,
  );
  const topLevel = (tree?.tree ?? [])
    .slice(0, 40)
    .map((t) => `<li><code>${escapeHtml(t.path)}${t.type === "tree" ? "/" : ""}</code></li>`)
    .join("");

  const body = `
<div class="badge">● Preview build · ${escapeHtml(sha.slice(0, 7))}</div>
<h1>${escapeHtml(opts.projectName)}</h1>
<div class="meta">
  <div><b>Repository</b> ${escapeHtml(ref.owner)}/${escapeHtml(ref.repo)}</div>
  <div><b>Branch</b> ${escapeHtml(branch)}</div>
  <div><b>Commit</b> ${escapeHtml(commit.commit.message.split("\n")[0])}</div>
  <div><b>Framework</b> ${escapeHtml(opts.framework)}</div>
  <div><b>Preview env vars</b> ${Object.keys(opts.env).length} injected as <code>window.__ENV__</code></div>
</div>
<hr>
${readme ? renderMarkdown(readme) : "<p>No README found in this repository.</p>"}
<hr>
<h3>Repository contents</h3>
<ul>${topLevel || "<li><code>(empty)</code></li>"}</ul>`;

  return {
    html: shell(`${opts.projectName} — preview`, body, envTag),
    commitHash: sha,
    commitMessage: commit.commit.message.split("\n")[0],
    commitAuthor: commit.commit.author?.name ?? null,
    commitDate: commit.commit.author?.date ?? null,
    source: "repository",
    entryPath: null,
    warnings,
  };
}
