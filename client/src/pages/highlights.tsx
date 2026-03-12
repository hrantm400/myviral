import { motion } from "framer-motion";
import { Wand2, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function Highlights() {
  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Podcast Highlights</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Batch process long podcasts or streams. AI will automatically find and cut 5-10 of the best viral moments.
        </p>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-12 text-center border-dashed border-2 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-6">
            <Wand2 className="w-8 h-8 text-violet-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">Coming Soon</h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            This powerful batch processing tool uses Gemini to analyze hour-long transcripts, score emotional peaks, and extract viral clips automatically.
          </p>
          <div className="flex items-center gap-2 text-sm text-amber-500 bg-amber-500/10 px-4 py-2 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            <span>AI extraction model is being refined.</span>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
