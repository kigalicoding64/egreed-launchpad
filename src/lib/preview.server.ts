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
  /** The in-app path this document represents (e.g. "/", "/about"). */
  path: string;
  /** Discoverable pages inside the served directory, as app paths. */
  routes: string[];
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

/** Normalise an app path to a leading-slash form. */
function normalisePath(path?: string | null) {
  const p = (path ?? "/").trim();
  if (!p || p === "/") return "/";
  const clean = p.split("#")[0].split("?")[0];
  return ("/" + clean.replace(/^\/+/, "")).replace(/\/{2,}/g, "/");
}

/** Turn a repo file path (relative to the served dir) into an app path. */
function fileToRoute(rel: string) {
  if (rel === "index.html") return "/";
  if (rel.endsWith("/index.html")) return "/" + rel.slice(0, -"/index.html".length);
  return "/" + rel.replace(/\.html$/, "");
}

/**
 * Client-side navigation bridge injected into every preview document.
 * Intercepts link clicks, form GETs and History API calls so multi-page and
 * SPA routes are reported to the dashboard shell, which rebuilds the frame.
 */
function navBridge(basePath: string, currentPath: string) {
  const cfg = JSON.stringify({ base: basePath, path: currentPath });
  return `<script>(function(){
var C=${cfg};
function post(m){try{parent.postMessage(Object.assign({__egreedPreview:1},m),'*')}catch(e){}}
function toApp(u){
  try{
    var url=new URL(u,document.baseURI);
    if(url.origin!==location.origin&&url.hostname!=='raw.githubusercontent.com')return null;
    var p=url.pathname;
    var i=p.indexOf(C.base);
    var rel=i>=0?p.slice(i+C.base.length):p.replace(/^\\//,'');
    return {path:'/'+rel.replace(/^\\//,''),hash:url.hash,search:url.search};
  }catch(e){return null}
}
document.addEventListener('click',function(e){
  if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
  var a=e.target&&e.target.closest?e.target.closest('a'):null;
  if(!a)return;
  var href=a.getAttribute('href');
  if(!href)return;
  if(/^(mailto:|tel:|javascript:|data:)/i.test(href))return;
  if(href.charAt(0)==='#')return; /* in-page anchors work natively */
  if(a.target&&a.target!=='_self'){e.preventDefault();post({type:'external',href:new URL(href,document.baseURI).href});return}
  var isAbs=/^https?:\\/\\//i.test(href);
  if(isAbs){
    var u=new URL(href);
    if(u.hostname!=='raw.githubusercontent.com'){e.preventDefault();post({type:'external',href:u.href});return}
  }
  var t=toApp(href);
  if(!t)return;
  e.preventDefault();
  post({type:'navigate',path:t.path,hash:t.hash});
},true);
document.addEventListener('submit',function(e){
  var f=e.target;
  if(!f||(f.method||'get').toLowerCase()!=='get')return;
  var action=f.getAttribute('action');
  if(!action)return;
  var t=toApp(action);
  if(!t)return;
  e.preventDefault();
  post({type:'navigate',path:t.path});
},true);
['pushState','replaceState'].forEach(function(k){
  var orig=history[k];
  history[k]=function(s,t,u){
    try{orig.apply(history,arguments)}catch(e){}
    if(u){var r=toApp(u);if(r)post({type:'spa',path:r.path,hash:r.hash})}
  };
});
window.addEventListener('hashchange',function(){post({type:'hash',hash:location.hash})});
/* Forward runtime console output + errors to the dashboard console panel. */
function fmt(a){try{return Array.prototype.slice.call(a).map(function(x){
  if(typeof x==='string')return x;
  try{return JSON.stringify(x)}catch(e){return String(x)}
}).join(' ')}catch(e){return ''}}
['log','info','warn','error','debug'].forEach(function(lvl){
  var orig=console[lvl];
  console[lvl]=function(){try{post({type:'console',level:lvl,text:fmt(arguments)})}catch(e){}
    try{orig&&orig.apply(console,arguments)}catch(e){}};
});
window.addEventListener('error',function(e){
  post({type:'console',level:'error',text:(e.message||'Script error')+(e.filename?' ('+e.filename+':'+e.lineno+')':'')});
});
window.addEventListener('unhandledrejection',function(e){
  post({type:'console',level:'error',text:'Unhandled promise rejection: '+String((e.reason&&e.reason.message)||e.reason)});
});
document.addEventListener('DOMContentLoaded',function(){post({type:'ready',title:document.title,path:C.path})});
post({type:'ready',title:document.title,path:C.path});
})();</script>`;
}

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
  /** In-app path to render, e.g. "/about". Defaults to "/". */
  path?: string;
  /** Edited files from the workspace editor, keyed by repo-relative path. */
  overlay?: Record<string, string>;
}): Promise<PreviewResult> {
  const warnings: string[] = [];
  const overlay = opts.overlay ?? {};
  const ref = parseRepo(opts.repositoryUrl, opts.repositoryName);
  if (!ref) throw new Error("Could not determine the GitHub owner/repo for this project.");

  const branch = opts.branch || "main";
  let commit: {
    sha: string;
    commit: { message: string; author: { name: string; date: string } };
  } | null = null;
  try {
    commit = await ghJson<{
      sha: string;
      commit: { message: string; author: { name: string; date: string } };
    }>(`${GH_API}/repos/${ref.owner}/${ref.repo}/commits/${encodeURIComponent(branch)}`);
  } catch {
    commit = null;
  }

  if (!commit) {
    throw new Error(
      `We couldn't access ${ref.owner}/${ref.repo} on branch “${branch}”. Check that the repository is public, the branch still exists, and your connected GitHub account has permission. If it is private, reconnect GitHub with access to this repository, then retry.`,
    );
  }

  const sha = commit.sha;
  const envTag = envScriptTag(opts.env);
  const requested = normalisePath(opts.path);
  const read = async (p: string) =>
    Object.prototype.hasOwnProperty.call(overlay, p) ? overlay[p] : await rawFile(ref, sha, p);

  if (Object.keys(overlay).length) {
    warnings.push(
      `${Object.keys(overlay).length} workspace edit(s) applied on top of the repository for this preview.`,
    );
  }

  // Full file listing — used for route discovery and path resolution.
  const tree = await ghJson<{ tree: { path: string; type: string }[] }>(
    `${GH_API}/repos/${ref.owner}/${ref.repo}/git/trees/${sha}?recursive=1`,
  );
  const files = Array.from(
    new Set([
      ...(tree?.tree ?? []).filter((t) => t.type === "blob").map((t) => t.path),
      ...Object.keys(overlay),
    ]),
  );

  // 1. Try to serve a real static entry point from the repo.
  for (const path of ENTRY_CANDIDATES) {
    if (files.length && !files.includes(path)) continue;
    const entryHtml = await read(path);
    if (!entryHtml) continue;


    const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    const base = rawBase(ref, sha, dir);
    const prefix = dir ? `${dir}/` : "";

    // Every .html file inside the served directory is a navigable route.
    const routes = Array.from(
      new Set(
        files
          .filter((f) => f.endsWith(".html") && (!prefix || f.startsWith(prefix)))
          .map((f) => fileToRoute(f.slice(prefix.length)))
          .filter((r) => !r.includes("node_modules")),
      ),
    ).sort((a, b) => (a === "/" ? -1 : b === "/" ? 1 : a.localeCompare(b)));

    // Resolve the requested app path to a concrete file in the repo.
    let servedPath = path;
    let html: string | null = entryHtml;
    if (requested !== "/") {
      const rel = requested.replace(/^\//, "").replace(/\/$/, "");
      const candidates = [rel, `${rel}.html`, `${rel}/index.html`].filter((c) =>
        c.endsWith(".html"),
      );
      let found: string | null = null;
      for (const c of candidates) {
        const full = `${prefix}${c}`;
        if (files.length && !files.includes(full)) continue;
        const body = await read(full);
        if (body) {
          found = full;
          html = body;
          break;
        }
      }
      if (found) {
        servedPath = found;
      } else {
        // SPA fallback: serve the entry document and let the app's router
        // handle the path (matches how static hosts serve SPAs).
        html = entryHtml;
        servedPath = path;
        warnings.push(
          `No static file matched ${requested} — served ${path} as a single-page-app fallback so the app's own router can handle the route.`,
        );
      }
    }

    const nav = navBridge(new URL(base).pathname, requested);
    const spaInit =
      servedPath === path && requested !== "/"
        ? `<script>try{history.replaceState({}, '', ${JSON.stringify(requested)})}catch(e){}</script>`
        : "";
    const head = `\n<base href="${base}">\n${envTag}${spaInit}`;
    const withEnv = /<head(\s[^>]*)?>/i.test(html!)
      ? html!.replace(/<head(\s[^>]*)?>/i, (m) => `${m}${head}`)
      : `<head>${head}</head>${html}`;

    return {
      html: withEnv.includes("</body>")
        ? withEnv.replace(/<\/body>/i, `${nav}</body>`)
        : withEnv + nav,
      commitHash: sha,
      commitMessage: commit.commit.message.split("\n")[0],
      commitAuthor: commit.commit.author?.name ?? null,
      commitDate: commit.commit.author?.date ?? null,
      source: "static-entry",
      entryPath: servedPath,
      path: requested,
      routes: routes.length ? routes : ["/"],
      warnings,
    };
  }

  // 2. No static entry — render the repository README as a real content preview.
  warnings.push(
    "No prebuilt index.html found in the repository, so the README and repository contents are rendered instead. Commit a build output (dist/ or public/) to preview the compiled app.",
  );

  const readme =
    (await read("README.md")) ?? (await read("readme.md")) ?? null;

  const topLevel = files
    .filter((p) => !p.includes("/"))
    .slice(0, 40)
    .map((p) => `<li><code>${escapeHtml(p)}</code></li>`)
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
    path: "/",
    routes: ["/"],
    warnings,
  };
}

/* ------------------------------------------------------------------ *
 * Uploaded-project previews (ZIP / folder uploads, no repository)
 * ------------------------------------------------------------------ */

function resolveRel(from: string, href: string) {
  const dir = from.includes("/") ? from.slice(0, from.lastIndexOf("/")) : "";
  const parts = (dir ? `${dir}/${href}` : href).split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

/** Inline same-project stylesheets and scripts so the frame is self-contained. */
function inlineAssets(html: string, entry: string, files: Record<string, string>) {
  let out = html.replace(
    /<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/gi,
    (tag) => {
      const m = tag.match(/href=["']([^"']+)["']/i);
      if (!m || /^(https?:)?\/\//i.test(m[1])) return tag;
      const css = files[resolveRel(entry, m[1].split("?")[0])];
      return css === undefined ? tag : `<style>${css}</style>`;
    },
  );
  out = out.replace(/<script\b([^>]*)><\/script>/gi, (tag, attrs: string) => {
    const m = attrs.match(/src=["']([^"']+)["']/i);
    if (!m || /^(https?:)?\/\//i.test(m[1])) return tag;
    const js = files[resolveRel(entry, m[1].split("?")[0])];
    if (js === undefined) return tag;
    const type = /type=["']module["']/i.test(attrs) ? ' type="module"' : "";
    return `<script${type}>${js.replace(/<\/script>/gi, "<\\/script>")}</script>`;
  });
  return out;
}

const UPLOAD_ENTRY_DIRS = ["", "public/", "dist/", "build/", "src/", "app/"];

/** Build a preview document from files the user uploaded (ZIP or folder). */
export async function buildUploadPreview(opts: {
  projectName: string;
  framework: string;
  env: Record<string, string>;
  files: Record<string, string>;
  path?: string;
}): Promise<PreviewResult> {
  const warnings: string[] = [];
  const files = opts.files;
  const paths = Object.keys(files);
  const envTag = envScriptTag(opts.env);
  const requested = normalisePath(opts.path);

  if (!paths.length) {
    throw new Error(
      "We couldn't access any uploaded source files. Check that the ZIP or folder finished uploading and that you still have permission to this project, then upload the source again if needed.",
    );
  }

  let entry: string | null = null;
  for (const dir of UPLOAD_ENTRY_DIRS) {
    if (files[`${dir}index.html`] !== undefined) {
      entry = `${dir}index.html`;
      break;
    }
  }
  if (!entry) entry = paths.find((p) => p.endsWith(".html")) ?? null;

  if (entry) {
    const dir = entry.includes("/") ? entry.slice(0, entry.lastIndexOf("/")) : "";
    const prefix = dir ? `${dir}/` : "";
    const routes = Array.from(
      new Set(
        paths
          .filter((f) => f.endsWith(".html") && (!prefix || f.startsWith(prefix)))
          .map((f) => fileToRoute(f.slice(prefix.length))),
      ),
    ).sort((a, b) => (a === "/" ? -1 : b === "/" ? 1 : a.localeCompare(b)));

    let served = entry;
    if (requested !== "/") {
      const rel = requested.replace(/^\//, "").replace(/\/$/, "");
      const candidate = [`${prefix}${rel}`, `${prefix}${rel}.html`, `${prefix}${rel}/index.html`]
        .filter((c) => c.endsWith(".html"))
        .find((c) => files[c] !== undefined);
      if (candidate) served = candidate;
      else
        warnings.push(
          `No uploaded file matched ${requested} — served ${entry} as a single-page-app fallback.`,
        );
    }

    const doc = inlineAssets(files[served], served, files);
    const nav = navBridge("/", requested);
    const spaInit =
      served === entry && requested !== "/"
        ? `<script>try{history.replaceState({}, '', ${JSON.stringify(requested)})}catch(e){}</script>`
        : "";
    const head = `\n${envTag}${spaInit}`;
    const withEnv = /<head(\s[^>]*)?>/i.test(doc)
      ? doc.replace(/<head(\s[^>]*)?>/i, (m) => `${m}${head}`)
      : `<head>${head}</head>${doc}`;

    return {
      html: withEnv.includes("</body>")
        ? withEnv.replace(/<\/body>/i, `${nav}</body>`)
        : withEnv + nav,
      commitHash: null,
      commitMessage: "Uploaded files",
      commitAuthor: null,
      commitDate: null,
      source: "upload",
      entryPath: served,
      path: requested,
      routes: routes.length ? routes : ["/"],
      warnings,
    };
  }

  warnings.push(
    "No index.html was found in the upload, so the project's README and file list are shown instead.",
  );
  const readme = files["README.md"] ?? files["readme.md"] ?? null;
  const list = paths
    .slice(0, 60)
    .map((p) => `<li><code>${escapeHtml(p)}</code></li>`)
    .join("");
  const body = `
<div class="badge">● Uploaded project preview</div>
<h1>${escapeHtml(opts.projectName)}</h1>
<div class="meta">
  <div><b>Source</b> Uploaded files (${paths.length})</div>
  <div><b>Framework</b> ${escapeHtml(opts.framework)}</div>
  <div><b>Preview env vars</b> ${Object.keys(opts.env).length} injected as <code>window.__ENV__</code></div>
</div>
<hr>
${readme ? renderMarkdown(readme) : "<p>No README included in this upload.</p>"}
<hr>
<h3>Files</h3>
<ul>${list}</ul>`;

  return {
    html: shell(`${opts.projectName} — preview`, body, envTag),
    commitHash: null,
    commitMessage: "Uploaded files",
    commitAuthor: null,
    commitDate: null,
    source: "upload",
    entryPath: null,
    path: "/",
    routes: ["/"],
    warnings,
  };
}
