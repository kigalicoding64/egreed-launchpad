import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Github, Loader2, Unplug, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/dashboard/DashboardShell";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  useProfile,
  useGithubConnections,
  useConnectGithub,
  useDisconnectGithub,
} from "@/lib/queries";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { data: profile, isLoading } = useProfile();
  const { data: connections } = useGithubConnections();
  const connect = useConnectGithub();
  const disconnect = useDisconnectGithub();
  const [ghUser, setGhUser] = useState("");

  const initials = (profile?.name || profile?.email || "U").slice(0, 2).toUpperCase();

  return (
    <div>
      <PageHeader title="Settings" description="Manage your account and integrations." />

      <div className="space-y-6">
        {/* Account */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold text-foreground">Account</h2>
          {isLoading ? (
            <Skeleton className="mt-4 h-16" />
          ) : (
            <div className="mt-4 flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary/15 text-primary">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={profile?.name ?? ""} readOnly />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={profile?.email ?? ""} readOnly />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* GitHub */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-background">
                <Github className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold text-foreground">GitHub</h2>
                <p className="text-sm text-muted-foreground">
                  Connect the EGREED Deploy GitHub App to import repositories.
                </p>
              </div>
            </div>
            {connections && connections.length > 0 && (
              <StatusBadge tone="success" label={`${connections.length} connected`} />
            )}
          </div>

          {connections && connections.length > 0 && (
            <div className="mt-5 space-y-2">
              {connections.map((gh) => (
                <div
                  key={gh.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-4"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={gh.avatar_url ?? undefined} />
                      <AvatarFallback>
                        {gh.github_username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">@{gh.github_username}</p>
                      <p className="text-xs text-muted-foreground">
                        Connected {format(new Date(gh.connected_at), "PPP")}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      disconnect.mutate(gh.id, {
                        onSuccess: () => toast.success("GitHub account disconnected"),
                      })
                    }
                    disabled={disconnect.isPending}
                  >
                    <Unplug className="h-4 w-4" /> Disconnect
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="gh">
                {connections && connections.length > 0
                  ? "Add another GitHub account or organization"
                  : "GitHub username or organization"}
              </Label>
              <Input
                id="gh"
                value={ghUser}
                onChange={(e) => setGhUser(e.target.value)}
                placeholder="egreed-labs"
              />
            </div>
            <Button
              variant="hero"
              onClick={() =>
                connect.mutate(ghUser.trim(), {
                  onSuccess: () => {
                    setGhUser("");
                    toast.success("GitHub account connected");
                  },
                  onError: (e) =>
                    toast.error(e instanceof Error ? e.message : "Could not connect"),
                })
              }
              disabled={connect.isPending || !ghUser.trim()}
            >
              {connect.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Github className="h-4 w-4" />
              )}
              {connections && connections.length > 0 ? "Add account" : "Connect"}
            </Button>
          </div>
        </section>

        {/* Security */}
        <section className="flex items-start gap-3 rounded-2xl border border-border bg-card/40 p-6">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <h2 className="font-semibold text-foreground">Security</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Credentials are stored securely, webhook payloads are signature-verified, and each
              deployment runs in an isolated environment.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
