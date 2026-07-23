import { Link, useRouter } from "@tanstack/react-router";
import { Menu, Trophy, Users, Home, Shield, LogOut, GitCompareArrows } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useSession, useIsAdmin } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import snovaLogo from "@/assets/snova-logo.jpg.asset.json";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/players", label: "Roster", icon: Users },
  { to: "/tournaments", label: "Tournaments", icon: Trophy },
  { to: "/compare", label: "Compare", icon: GitCompareArrows },
];


function NavLinks({ onClick }: { onClick?: () => void }) {
  const { data: isAdmin } = useIsAdmin();
  const { session } = useSession();
  return (
    <nav className="flex flex-col gap-1 md:flex-row md:items-center md:gap-1">
      {NAV.map((n) => (
        <Link
          key={n.to}
          to={n.to}
          onClick={onClick}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
          activeProps={{ className: "!text-foreground !bg-white/5" }}
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
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-neon hover:bg-neon-soft transition-colors"
          activeProps={{ className: "!bg-neon-soft" }}
        >
          <Shield className="h-4 w-4" /> Admin
        </Link>
      )}
      {!session && (
        <Link
          to="/auth"
          onClick={onClick}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Shield className="h-4 w-4" /> Admin Login
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
      <header className="sticky top-0 z-40 border-b border-white/5 backdrop-blur-xl bg-background/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="h-10 w-10 rounded-lg overflow-hidden ring-1 ring-white/10 shadow-lg">
              <img src={snovaLogo.url} alt="Team Snova Esp" className="h-full w-full object-cover" />
            </div>
            <div className="leading-tight">

              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Team</div>
              <div className="text-sm font-black tracking-tight gradient-text">SNOVA ESP</div>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            <NavLinks />
            {session && (
              <Button variant="ghost" size="sm" onClick={signOut} className="ml-1">
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="md:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
              </SheetTrigger>
              <SheetContent side="right" className="glass border-white/10">
                <div className="mt-6">
                  <NavLinks onClick={() => setOpen(false)} />
                  {session && (
                    <Button variant="ghost" onClick={() => { signOut(); setOpen(false); }} className="mt-4 w-full justify-start">
                      <LogOut className="h-4 w-4 mr-2" /> Sign out
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:py-10">{children}</main>

      <footer className="mt-16 border-t border-white/5 py-8 text-center text-xs text-muted-foreground">
        <div className="gradient-text font-bold tracking-[0.3em]">TEAM SNOVA ESP</div>
        <div className="mt-1">Compete. Dominate. Repeat.</div>
      </footer>
    </div>
  );
}
