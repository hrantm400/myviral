import { motion } from "framer-motion";
import { Scissors, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function SmartCrop() {
  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Smart Crop</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Automatically track faces and objects to crop 16:9 videos into dynamic 9:16 vertical shorts.
        </p>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-12 text-center border-dashed border-2 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
            <Scissors className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-2">Coming Soon</h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            We are working hard to integrate OpenCV and advanced FFmpeg filters to automatically track faces and frame your videos perfectly.
          </p>
          <div className="flex items-center gap-2 text-sm text-amber-500 bg-amber-500/10 px-4 py-2 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            <span>Under development in the upcoming sprint.</span>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
