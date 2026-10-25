import { Link } from "@tanstack/react-router";
import { Languages } from "lucide-react";
import { useLanguage, type Language } from "@/lib/language";
import mark from "@/assets/nivara-mark.png";

export function Header({ right }: { right?: React.ReactNode }) {
  const { t, language, setLanguage } = useLanguage();
  return (
    <header className="sticky top-0 z-[1100] border-b bg-card/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-4">
        <Link to="/" className="flex items-center gap-2">
          <img src={mark} alt="Nivara logo" className="h-9 w-auto" />
          <div className="leading-tight">
            <div className="font-display text-xl font-bold text-deep">Nivara</div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-primary">{t("Flood Resilience")}</div>
          </div>
        </Link>
        <nav className="ml-6 hidden gap-1 text-sm font-medium md:flex">
          <Link to="/authority" className="rounded-lg px-3 py-2 text-muted-foreground hover:bg-secondary" activeProps={{ className: "bg-primary-soft text-deep" }}>{t("Authority Command")}</Link>
          <Link to="/rescue" className="rounded-lg px-3 py-2 text-muted-foreground hover:bg-secondary" activeProps={{ className: "bg-primary-soft text-deep" }}>{t("Rescue Teams")}</Link>
          <Link to="/citizen" className="rounded-lg px-3 py-2 text-muted-foreground hover:bg-secondary" activeProps={{ className: "bg-primary-soft text-deep" }}>{t("Citizen Safety")}</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground"><Languages className="h-4 w-4"/><select aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value as Language)} className="max-w-28 rounded-md border bg-card px-2 py-1.5 text-foreground"><option value="en">English</option><option value="te">తెలుగు</option><option value="hi">हिन्दी</option></select></label>
          <div className="hidden sm:block">{right}</div>
        </div>
      </div>
    </header>
  );
}
