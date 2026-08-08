import { Link, useRouter } from "@tanstack/react-router";
import { Menu, Trophy, Users, Home, Shield, LogOut, GitCompareArrows, BarChart3, Map as MapIcon, Medal } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useSession, useIsAdmin } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import snovaLogo from "@/assets/snova-logo.jpg.asset.json";
import { PageTransition } from "@/components/PageTransition";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/players", label: "Roster", icon: Users },
  { to: "/tournaments", label: "Tournaments", icon: Trophy },
  { to: "/stats", label: "Stats", icon: BarChart3 },
  { to: "/achievements", label: "Achievements", icon: Medal },
  { to: "/compare", label: "Compare", icon: GitCompareArrows },
  { to: "/maps", label: "Maps", icon: MapIcon },
];

function NavLinks({ onClick, stacked }: { onClick?: () => void; stacked?: boolean }) {
  const { data: isAdmin } = useIsAdmin();
  const { session } = useSession();
  return (
    <nav className={stacked ? "flex flex-col gap-1" : "flex items-center gap-0.5"}>
      {NAV.map((n) => (
        <Link
          key={n.to}
          to={n.to}
          onClick={onClick}
          className="i-ripple i-slide-icon flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-colors"
          activeProps={{ className: "!text-foreground !bg-white/[0.08]" }}
          activeOptions={{ exact: n.to === "/" }}
        >
          <n.icon className="h-4 w-4" />
          {n.label}
        </Link>
      ))}
      {isAdmin && (
        <Link
          to="/admin"
          onClick={onClick}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-neon hover:bg-neon-soft transition-colors"
          activeProps={{ className: "!bg-neon-soft" }}
        >
          <Shield className="h-4 w-4" /> Admin
        </Link>
      )}
      {!session && (
        <Link
          to="/auth"
          onClick={onClick}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Shield className="h-4 w-4" /> Sign in
        </Link>
      )}
    </nav>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { session } = useSession();
  const router = useRouter();

  const signOut = async () => {
    await supabase.auth.signOut();
    router.invalidate();
  };

  return (
    <div className="min-h-screen">
      <header className="a-down sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 lg:px-8">
          <Link to="/" className="i-grow flex items-center gap-3">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10">
              <img src={snovaLogo.url} alt="Team Snova Esp" className="h-full w-full object-cover l-breathe" />
            </div>
            <div className="leading-none">
              <div className="font-display text-sm font-bold tracking-[0.16em] uppercase">Snova</div>
              <div className="mt-1 text-[9px] uppercase tracking-[0.3em] text-muted-foreground">Esports</div>
            </div>
          </Link>

          <div className="hidden lg:flex items-center gap-2">
            <div className="rounded-xl border border-border bg-surface/60 p-1">
              <NavLinks />
            </div>
            {session && (
              <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="lg:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Menu"><Menu className="h-5 w-5" /></Button>
              </SheetTrigger>
              <SheetContent side="right" className="border-border bg-background/95 backdrop-blur-xl">
                <div className="mt-8">
                  <div className="label-eyebrow mb-3">Navigate</div>
                  <NavLinks stacked onClick={() => setOpen(false)} />
                  {session && (
                    <Button variant="ghost" onClick={() => { signOut(); setOpen(false); }} className="mt-4 w-full justify-start">
                      <LogOut className="mr-2 h-4 w-4" /> Sign out
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 pb-28 pt-6 lg:px-8 lg:pb-16 lg:pt-10">
        <PageTransition>{children}</PageTransition>
      </main>

      <footer className="a-fade d-3 border-t border-border py-10 pb-32 lg:pb-10">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center gap-2 px-4 text-center lg:flex-row lg:justify-between lg:text-left">
          <div className="font-display text-sm font-bold uppercase tracking-[0.3em]">Team Snova Esp</div>
          <div className="text-xs text-muted-foreground">Compete. Dominate. Repeat.</div>
        </div>
      </footer>

      <BottomNav />
    </div>
  );
}

function BottomNav() {
  const items = [
    { to: "/", label: "Home", icon: Home, exact: true },
    { to: "/stats", label: "Stats", icon: BarChart3 },
    { to: "/achievements", label: "Awards", icon: Medal },
    { to: "/compare", label: "Compare", icon: GitCompareArrows },
    { to: "/maps", label: "Maps", icon: MapIcon },
  ];
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 pt-6 bg-gradient-to-t from-background via-background/90 to-transparent">
      <nav className="a-up mx-auto flex max-w-md items-center justify-between rounded-2xl border border-border bg-surface/95 p-1.5 backdrop-blur-xl">
        {items.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className="i-ripple flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[9px] uppercase tracking-[0.14em] text-muted-foreground transition-colors active:scale-95"
            activeProps={{ className: "!text-neon !bg-neon-soft" }}
            activeOptions={{ exact: !!n.exact }}
          >
            <n.icon className="h-[18px] w-[18px]" />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
