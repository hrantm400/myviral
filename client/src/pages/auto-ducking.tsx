import { motion } from "framer-motion";
import { Mic2, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function AutoDucking() {
  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Auto-Ducking</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Smart audio engineering that automatically lowers background music when a voice is speaking.
        </p>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-12 text-center border-dashed border-2 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6">
            <Mic2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">Coming Soon</h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            Upload your vocal track and background music. Our engine will use FFmpeg sidechain compression to automatically duck the music level in real-time.
          </p>
          <div className="flex items-center gap-2 text-sm text-amber-500 bg-amber-500/10 px-4 py-2 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            <span>Audio processing pipeline in development.</span>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
