import {
  Boxes,
  FileCode2,
  Globe,
  Server,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const ROOT_DOMAIN = "egreedtech.org";
export const PLATFORM_DOMAIN = "deploy.egreedtech.org";
export const COMPANY = "EGREED Technology";

export type ProjectStatus =
  | "queued"
  | "building"
  | "deploying"
  | "online"
  | "failed"
  | "paused";

export type DeploymentStatus =
  | "queued"
  | "building"
  | "deploying"
  | "online"
  | "failed"
  | "canceled";

export type SslStatus = "pending" | "active" | "failed";
export type DnsStatus = "pending" | "active" | "failed";
export type EnvTarget = "production" | "preview" | "development";

// CNAME target that project subdomains point at (the platform ingress host).
export const DNS_TARGET = "ingress.egreedtech.org";

export interface Profile {
  id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface GithubConnection {
  id: string;
  user_id: string;
  github_username: string;
  github_user_id: string | null;
  avatar_url: string | null;
  account_type: string;
  installation_id: string | null;
  connected_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  repository_name: string;
  repository_url: string;
  framework: string;
  build_command: string | null;
  install_command?: string | null;
  start_command?: string | null;
  output_dir?: string | null;

  branch: string;
  status: ProjectStatus;
  domain: string | null;
  auto_deploy: boolean;
  source_type?: "github" | "upload" | string;

  created_at: string;
  updated_at: string;
}

export interface Deployment {
  id: string;
  project_id: string;
  user_id: string;
  commit_hash: string | null;
  commit_message: string | null;
  branch: string;
  status: DeploymentStatus;
  build_logs: string | null;
  triggered_by: string;
  progress: number;
  github_event: string | null;
  deploy_url: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
}

export interface Domain {
  id: string;
  project_id: string;
  user_id: string;
  subdomain: string;
  full_domain: string;
  ssl_status: SslStatus;
  dns_status: DnsStatus;
  cloudflare_record_id: string | null;
  dns_type: string;
  dns_target: string | null;
  last_checked_at: string | null;
  ssl_provisioned_at: string | null;
  ssl_renewed_at: string | null;
  ssl_expires_at: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface EnvVar {
  id: string;
  project_id: string;
  user_id: string;
  key: string;
  value: string;
  target: EnvTarget;
  created_at: string;
}

/* ---------- Frameworks & detection ---------- */

export interface FrameworkMeta {
  id: string;
  label: string;
  icon: LucideIcon;
  buildCommand: string;
  installCommand: string;
  startCommand: string;
  outputDir: string;
  detectFile: string;
}

export const FRAMEWORKS: Record<string, FrameworkMeta> = {
  nextjs: {
    id: "nextjs",
    label: "Next.js",
    icon: Boxes,
    buildCommand: "next build",
    installCommand: "npm install",
    startCommand: "next start -p $PORT",
    outputDir: ".next",
    detectFile: "next.config.js",
  },
  react: {
    id: "react",
    label: "React (Vite)",
    icon: Zap,
    buildCommand: "npm run build",
    installCommand: "npm install",
    startCommand: "serve -s dist -l $PORT",
    outputDir: "dist",
    detectFile: "vite.config.ts",
  },
  node: {
    id: "node",
    label: "Node.js",
    icon: Server,
    buildCommand: "npm run build --if-present",
    installCommand: "npm install",
    startCommand: "npm start",
    outputDir: ".",
    detectFile: "server.js",
  },
  python: {
    id: "python",
    label: "Python",
    icon: FileCode2,
    buildCommand: "pip install -r requirements.txt",
    installCommand: "python -m venv .venv && . .venv/bin/activate",
    startCommand: "gunicorn app:app --bind 0.0.0.0:$PORT",
    outputDir: ".",
    detectFile: "requirements.txt",
  },
  static: {
    id: "static",
    label: "Static HTML",
    icon: Globe,
    buildCommand: "—",
    installCommand: "—",
    startCommand: "serve . -l $PORT",
    outputDir: ".",
    detectFile: "index.html",
  },
};

export function frameworkMeta(id: string): FrameworkMeta {
  return FRAMEWORKS[id] ?? FRAMEWORKS.static;
}

/* ---------- Build plan ---------- */

export interface BuildPlan {
  framework: string;
  installCommand: string;
  buildCommand: string;
  startCommand: string;
  outputDir: string;
  /** Short notes explaining how each value was detected. */
  notes: string[];
}

/** Framework defaults, optionally overridden by stored project values. */
export function buildPlanFor(
  framework: string,
  overrides?: {
    build_command?: string | null;
    install_command?: string | null;
    start_command?: string | null;
    output_dir?: string | null;
  },
): BuildPlan {
  const fm = frameworkMeta(framework);
  return {
    framework: fm.id,
    installCommand: overrides?.install_command || fm.installCommand,
    buildCommand: overrides?.build_command || fm.buildCommand,
    startCommand: overrides?.start_command || fm.startCommand,
    outputDir: overrides?.output_dir || fm.outputDir,
    notes: [],
  };
}

/**
 * Inspect uploaded/repository files and refine the framework defaults using the
 * project's real package.json scripts when they exist.
 */
export function detectBuildPlan(
  files: Record<string, string> | undefined,
  framework: string,
): BuildPlan {
  const plan = buildPlanFor(framework);
  const notes: string[] = [`Framework detected: ${frameworkMeta(framework).label}`];
  const pkgRaw = files?.["package.json"];

  if (pkgRaw) {
    try {
      const pkg = JSON.parse(pkgRaw) as {
        scripts?: Record<string, string>;
        packageManager?: string;
      };
      const scripts = pkg.scripts ?? {};
      const pm = pkg.packageManager?.startsWith("pnpm")
        ? "pnpm"
        : pkg.packageManager?.startsWith("yarn")
          ? "yarn"
          : files?.["pnpm-lock.yaml"]
            ? "pnpm"
            : files?.["yarn.lock"]
              ? "yarn"
              : files?.["bun.lockb"]
                ? "bun"
                : "npm";
      plan.installCommand = pm === "npm" ? "npm install" : `${pm} install`;
      notes.push(`Package manager: ${pm} (from lockfile / package.json)`);
      if (scripts.build) {
        plan.buildCommand = `${pm} run build`;
        notes.push(`Build script found: "${scripts.build}"`);
      }
      if (scripts.start) {
        plan.startCommand = pm === "npm" ? "npm start" : `${pm} start`;
        notes.push(`Start script found: "${scripts.start}"`);
      } else if (scripts.preview) {
        plan.startCommand = `${pm} run preview`;
        notes.push(`No start script — using "preview".`);
      }
    } catch {
      notes.push("package.json could not be parsed — using framework defaults.");
    }
  } else if (files) {
    notes.push("No package.json — treating this as a static site.");
  }

  if (files) {
    if (files["dist/index.html"] || files["vite.config.ts"] || files["vite.config.js"]) {
      plan.outputDir = "dist";
    } else if (files["next.config.js"] || files["next.config.mjs"]) {
      plan.outputDir = ".next";
    } else if (files["build/index.html"]) {
      plan.outputDir = "build";
    }
  }

  plan.notes = notes;
  return plan;
}


/* ---------- Slug / subdomain ---------- */

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Platform root domain chosen by an admin (falls back to ROOT_DOMAIN). */
let activeRootDomain = ROOT_DOMAIN;
export function setActiveRootDomain(domain: string | null | undefined) {
  activeRootDomain = domain || ROOT_DOMAIN;
}
export function getActiveRootDomain() {
  return activeRootDomain;
}

export function subdomainFor(name: string, root: string = activeRootDomain): string {
  const slug = slugify(name) || "app";
  return `${slug}.${root}`;
}

/* ---------- Status metadata ---------- */

export type Tone = "success" | "warning" | "danger" | "muted" | "info";

export const PROJECT_STATUS_META: Record<ProjectStatus, { label: string; tone: Tone }> = {
  queued: { label: "Queued", tone: "muted" },
  building: { label: "Building", tone: "warning" },
  deploying: { label: "Deploying", tone: "info" },
  online: { label: "Online", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  paused: { label: "Paused", tone: "muted" },
};

export const DEPLOY_STATUS_META: Record<DeploymentStatus, { label: string; tone: Tone }> = {
  queued: { label: "Queued", tone: "muted" },
  building: { label: "Building", tone: "warning" },
  deploying: { label: "Deploying", tone: "info" },
  online: { label: "Online", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  canceled: { label: "Canceled", tone: "muted" },
};

export const SSL_STATUS_META: Record<SslStatus, { label: string; tone: Tone }> = {
  pending: { label: "Provisioning", tone: "warning" },
  active: { label: "Active", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
};

export const DNS_STATUS_META: Record<DnsStatus, { label: string; tone: Tone }> = {
  pending: { label: "Propagating", tone: "warning" },
  active: { label: "Resolved", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
};

/* ---------- SSL certificate issuance progress ---------- */

export interface SslProgress {
  /** 0–100 completion of the certificate issuance workflow. */
  percent: number;
  /** Short human-readable stage label. */
  stage: string;
  tone: Tone;
  /** True when the workflow has stopped with an error. */
  error: boolean;
  /** Longer explanation / error detail for the UI. */
  detail: string;
}

/**
 * Derive certificate issuance progress from a domain's DNS + SSL status.
 * Issuance is gated on DNS: a cert can only be signed once the record resolves.
 */
export function sslProgress(domain: {
  dns_status: DnsStatus;
  ssl_status: SslStatus;
  full_domain: string;
}): SslProgress {
  if (domain.ssl_status === "failed") {
    return {
      percent: 100,
      stage: "Issuance failed",
      tone: "danger",
      error: true,
      detail: "The certificate authority rejected the request. Retry provisioning to try again.",
    };
  }
  if (domain.dns_status === "failed") {
    return {
      percent: 40,
      stage: "DNS error",
      tone: "danger",
      error: true,
      detail: `DNS record for ${domain.full_domain} could not be created or resolved. Certificate issuance is blocked until DNS is fixed.`,
    };
  }
  if (domain.ssl_status === "active") {
    return {
      percent: 100,
      stage: "Certificate issued",
      tone: "success",
      error: false,
      detail: "HTTPS is live and the certificate auto-renews before expiry.",
    };
  }
  // ssl pending
  if (domain.dns_status === "active") {
    return {
      percent: 70,
      stage: "Issuing certificate",
      tone: "warning",
      error: false,
      detail: "DNS resolved — requesting and validating the TLS certificate.",
    };
  }
  return {
    percent: 30,
    stage: "Awaiting DNS propagation",
    tone: "info",
    error: false,
    detail: "Waiting for the CNAME record to propagate before requesting a certificate.",
  };
}


/* ---------- Deployment job phases (state machine) ---------- */

export interface DeployPhase {
  status: DeploymentStatus;
  progress: number;
  label: string;
  log: string;
}

/** Ordered phases the deployment engine advances through. */
export const DEPLOY_PHASES: DeployPhase[] = [
  { status: "building", progress: 10, label: "Cloning repository", log: "> Cloning repository from GitHub …" },
  { status: "building", progress: 30, label: "Installing dependencies", log: "> Installing dependencies …" },
  { status: "building", progress: 55, label: "Building project", log: "> Running build …" },
  { status: "deploying", progress: 75, label: "Creating container", log: "> Creating isolated container …" },
  { status: "deploying", progress: 88, label: "Configuring domain & SSL", log: "> Configuring domain and provisioning SSL …" },
  { status: "online", progress: 100, label: "Live", log: "✓ Deployment successful" },
];

/* ---------- Sample repositories (GitHub connect flow, data-only) ---------- */

export interface SampleRepo {
  name: string;
  fullName: string;
  description: string;
  framework: string;
  language: string;
  private: boolean;
  updated: string;
  stars: number;
}

export const SAMPLE_REPOS: SampleRepo[] = [
  {
    name: "muhazi-dental-clinic",
    fullName: "egreed-labs/muhazi-dental-clinic",
    description: "Patient management & booking system for Muhazi Dental Clinic.",
    framework: "nextjs",
    language: "TypeScript",
    private: true,
    updated: "2 hours ago",
    stars: 4,
  },
  {
    name: "school-system",
    fullName: "egreed-labs/school-system",
    description: "Student records, grading and attendance platform.",
    framework: "react",
    language: "TypeScript",
    private: false,
    updated: "yesterday",
    stars: 27,
  },
  {
    name: "kigali-market-api",
    fullName: "egreed-labs/kigali-market-api",
    description: "REST API powering the Kigali online marketplace.",
    framework: "node",
    language: "JavaScript",
    private: true,
    updated: "3 days ago",
    stars: 12,
  },
  {
    name: "my-ai-app",
    fullName: "egreed-labs/my-ai-app",
    description: "AI assistant with a Python inference backend.",
    framework: "python",
    language: "Python",
    private: false,
    updated: "last week",
    stars: 58,
  },
  {
    name: "egreedtech-landing",
    fullName: "egreed-labs/egreedtech-landing",
    description: "Marketing site for EGREED Technology.",
    framework: "static",
    language: "HTML",
    private: false,
    updated: "2 weeks ago",
    stars: 9,
  },
  {
    name: "clinic-portal",
    fullName: "egreed-labs/clinic-portal",
    description: "Multi-tenant clinic administration dashboard.",
    framework: "nextjs",
    language: "TypeScript",
    private: true,
    updated: "1 month ago",
    stars: 3,
  },
];

export const DEPLOY_STEPS = [
  "Connecting to GitHub",
  "Cloning repository",
  "Installing dependencies",
  "Building project",
  "Creating container",
  "Configuring domain",
  "Enabling SSL",
  "Deployment successful",
];

export function buildLogsFor(project: {
  repository_name: string;
  framework: string;
  build_command: string | null;
  domain: string | null;
}): string {
  const fm = frameworkMeta(project.framework);
  const cmd = project.build_command || fm.buildCommand;
  const lines = [
    `> Connecting to GitHub …`,
    `✓ Authenticated via EGREED Deploy GitHub App`,
    `> Cloning ${project.repository_name} (branch: main)`,
    `✓ Repository cloned`,
    `> Detected framework: ${fm.label}`,
    `> Installing dependencies …`,
    `✓ Dependencies installed`,
    `> Running build: ${cmd}`,
    `✓ Build completed`,
    `> Creating isolated container …`,
    `✓ Container started`,
    `> Configuring domain ${project.domain ?? "—"}`,
    `✓ CNAME record created via Cloudflare DNS`,
    `> Provisioning SSL certificate …`,
    `✓ HTTPS enabled`,
    `✓ Deployment successful — live at https://${project.domain ?? ""}`,
  ];
  return lines.join("\n");
}
