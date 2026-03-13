import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import SmartCrop from "@/pages/smart-crop";
import AutoDucking from "@/pages/auto-ducking";
import Highlights from "@/pages/highlights";
import ColorGrade from "@/pages/color-grade";
import VocalIsolate from "@/pages/vocal-isolate";
import MotionTrack from "@/pages/motion-track";
import StyleStudio from "@/pages/style-studio";
import ViralCombo from "@/pages/combos/viral";
import PodcastCombo from "@/pages/combos/podcast";
import ActionCombo from "@/pages/combos/action";
import CinematicCombo from "@/pages/combos/cinematic";
import MemeCombo from "@/pages/combos/meme";
import { MainLayout } from "@/components/layout";

function Router() {
  return (
    <MainLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/smart-crop" component={SmartCrop} />
        <Route path="/auto-ducking" component={AutoDucking} />
        <Route path="/highlights" component={Highlights} />
        <Route path="/color-grade" component={ColorGrade} />
        <Route path="/vocal-isolate" component={VocalIsolate} />
        <Route path="/motion-track" component={MotionTrack} />
        <Route path="/style-studio" component={StyleStudio} />
        <Route path="/combos/viral" component={ViralCombo} />
        <Route path="/combos/podcast" component={PodcastCombo} />
        <Route path="/combos/action" component={ActionCombo} />
        <Route path="/combos/cinematic" component={CinematicCombo} />
        <Route path="/combos/meme" component={MemeCombo} />
        <Route component={NotFound} />
      </Switch>
    </MainLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
