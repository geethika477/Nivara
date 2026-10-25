import { T } from "@/lib/language";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import logo from "@/assets/nivara-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Nivara — Flood Resilience Platform for India" },
      { name: "description", content: "Live flood risk maps, prioritised evacuation zones and infrastructure failure response for every district in India." },
      { property: "og:title", content: "Nivara — Flood Resilience Platform for India" },
      { property: "og:description", content: "Live flood risk maps, prioritised evacuation zones and infrastructure failure response." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-deep"><T text={'Built for India · 700+ districts'}/></span>
            <h1 className="mt-5 text-5xl font-extrabold text-deep"><T text={'See the flood before it arrives.'}/></h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Nivara turns terrain, rainfall and water levels into a live risk map, ranks which areas to evacuate first, and guides rescue teams and citizens along safe routes.
            </p>
          </div>
          <img src={logo} alt="Nivara" width={816} height={816} className="mx-auto w-72" />
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          <Link to="/authority" className="card-surface group p-7 transition hover:-translate-y-1">
            <div className="text-3xl"><T text={'🛡️'}/></div>
            <h2 className="mt-3 text-2xl font-bold text-deep"><T text={'Authority Command'}/></h2>
            <p className="mt-2 text-muted-foreground"><T text={'Disaster management, police, fire and rescue teams. Flood map, evacuation zones and infrastructure dependency response.'}/></p>
            <span className="mt-5 inline-block rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground group-hover:opacity-90"><T text={'Open dashboard →'}/></span>
          </Link>
          <Link to="/rescue" className="card-surface group p-7 transition hover:-translate-y-1">
            <div className="text-3xl">🚤</div>
            <h2 className="mt-3 text-2xl font-bold text-deep"><T text={'Rescue Teams'}/></h2>
            <p className="mt-2 text-muted-foreground"><T text={'Report whether flood zones are evacuated and handle drainage and rescue jobs assigned by the authority.'}/></p>
            <span className="mt-5 inline-block rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground group-hover:opacity-90"><T text={'Open dashboard →'}/></span>
          </Link>
          <Link to="/citizen" className="card-surface group p-7 transition hover:-translate-y-1">
            <div className="text-3xl"><T text={'📍'}/></div>
            <h2 className="mt-3 text-2xl font-bold text-deep"><T text={'Citizen Safety'}/></h2>
            <p className="mt-2 text-muted-foreground"><T text={'Share your location to check the flood risk where you are and get turn-by-turn directions to the nearest safe zone.'}/></p>
            <span className="mt-5 inline-block rounded-lg border border-primary px-4 py-2 font-semibold text-deep group-hover:bg-primary-soft"><T text={'Check my area →'}/></span>
          </Link>
        </div>
      </main>
    </div>
  );
}
