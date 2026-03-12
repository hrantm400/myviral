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
import StyleStudio from "@/pages/style-studio";
import { MainLayout } from "@/components/layout";

function Router() {
  return (
    <MainLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/smart-crop" component={SmartCrop} />
        <Route path="/auto-ducking" component={AutoDucking} />
        <Route path="/highlights" component={Highlights} />
        <Route path="/style-studio" component={StyleStudio} />
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
