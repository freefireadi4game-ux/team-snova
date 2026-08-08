import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { Users, Trophy, LayoutDashboard, Map as MapIcon, Link as LinkIcon, ScanText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const TABS = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/players", label: "Players", icon: Users, exact: false },
  { to: "/admin/aliases", label: "Name Map", icon: ScanText, exact: false },
  { to: "/admin/tournaments", label: "Tournaments", icon: Trophy, exact: false },
  { to: "/admin/maps", label: "Maps", icon: MapIcon, exact: false },
  { to: "/admin/invites", label: "Invites", icon: LinkIcon, exact: false },
];

function AdminLayout() {
  return (
    <Layout>
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.25em] text-neon">Admin Panel</div>
        <h1 className="a-slide-blur font-display text-3xl md:text-4xl gradient-text">Control Center</h1>
      </div>

      <div className="glass i-lift rounded-2xl p-1.5 mb-6 inline-flex flex-wrap gap-1">
        {TABS.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            activeProps={{ className: "!bg-neon-soft !text-neon" }}
            activeOptions={{ exact: t.exact }}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </Link>
        ))}
      </div>

      <Outlet />
    </Layout>
  );
}
