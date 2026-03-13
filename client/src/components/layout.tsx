import { Link, useLocation } from "wouter";
import {
  Film,
  Scissors,
  Mic2,
  Wand2,
  Type,
  Settings,
  Sparkles,
  Palette,
  AudioLines,
  Rocket,
  Zap,
  Flame,
  Clapperboard,
  Gamepad2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const NAV_ITEMS = [
  { href: "/", label: "Auto-Shorts (Classic)", icon: Film, description: "Convert 16:9 to 9:16 Sandwich" },
  { href: "/smart-crop", label: "AI Smart Crop", icon: Scissors, description: "Auto face-tracking & cropping" },
  { href: "/auto-ducking", label: "Auto-Ducking", icon: Mic2, description: "Smart background music mixing" },
  { href: "/highlights", label: "Podcast Highlights", icon: Wand2, description: "Batch extraction from long videos" },
  { href: "/color-grade", label: "AI Color Grade", icon: Palette, description: "Cinematic color correction" },
  { href: "/vocal-isolate", label: "Vocal Isolator", icon: AudioLines, description: "Studio quality audio cleaning" },
  { href: "/motion-track", label: "Motion Track", icon: Film, description: "Dynamic object tracking" },
  { href: "/style-studio", label: "Style Studio", icon: Type, description: "Custom subtitle fonts & colors" },
];

const COMBO_ITEMS = [
  { href: "/combos/viral", label: "The Viral YouTuber", icon: Rocket, description: "Highlights + Crop + Color + Subs" },
  { href: "/combos/podcast", label: "Pro Studio Podcast", icon: Mic2, description: "Isolate + Ducking + Subs" },
  { href: "/combos/action", label: "Action Sports Reel", icon: Zap, description: "Crop + Color + Motion Track" },
  { href: "/combos/cinematic", label: "Cinematic Storyteller", icon: Clapperboard, description: "Sandwich + Color + Ducking" },
  { href: "/combos/meme", label: "Faceless Meme Factory", icon: Flame, description: "Isolate + Motion Track + Subs" },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="w-64 border-r border-border bg-card/50 backdrop-blur-sm h-screen flex flex-col sticky top-0">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center">
            <Wand2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">ReelForge</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              Pro Studio
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] gap-1.5 w-full justify-center mt-3">
          <Sparkles className="w-3 h-3 text-primary" />
          Powered by Gemini AI
        </Badge>
      </div>

      <div className="flex-1 px-4 space-y-1 overflow-y-auto">
        <div className="text-xs font-semibold text-muted-foreground mb-3 px-2 mt-4 uppercase tracking-wider">
          AI Tools
        </div>
        {NAV_ITEMS.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href}>
              <a
                className={`flex items-start gap-3 px-3 py-3 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${isActive ? "text-primary" : "group-hover:text-foreground"}`} />
                <div>
                  <div className="text-sm">{item.label}</div>
                  <div className={`text-[10px] mt-0.5 ${isActive ? "text-primary/70" : "text-muted-foreground/70"}`}>
                    {item.description}
                  </div>
                </div>
              </a>
            </Link>
          );
        })}

        <div className="text-xs font-semibold text-amber-500 mb-3 px-2 mt-6 uppercase tracking-wider flex items-center gap-2">
          <Zap className="w-3 h-3" />
          Magic Combos
        </div>
        {COMBO_ITEMS.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href}>
              <a
                className={`flex items-start gap-3 px-3 py-3 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${isActive ? "text-primary" : "group-hover:text-foreground"}`} />
                <div>
                  <div className="text-sm">{item.label}</div>
                  <div className={`text-[10px] mt-0.5 ${isActive ? "text-primary/70" : "text-muted-foreground/70"}`}>
                    {item.description}
                  </div>
                </div>
              </a>
            </Link>
          );
        })}
      </div>

      <div className="p-4 mt-auto">
        <button className="flex items-center gap-3 px-3 py-2 w-full rounded-xl text-muted-foreground hover:bg-muted transition-colors text-sm">
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </div>
    </div>
  );
}

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}
