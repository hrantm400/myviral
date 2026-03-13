import { useState } from "react";
import { motion } from "framer-motion";
import { AudioLines, Mic, Loader2, Play } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function VocalIsolator() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [projectName, setProjectName] = useState("");
  const [sourceMedia, setSourceMedia] = useState<File | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("sourceMedia", sourceMedia!);
      if (projectName) formData.append("name", projectName);

      const res = await fetch("/api/projects/isolate", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setSourceMedia(null);
      setProjectName("");
      toast({ title: "Pipeline started", description: "Vocal isolation processing in background" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const canSubmit = sourceMedia && !uploadMutation.isPending;

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Vocal Isolator</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Remove background noise, wind, and echo. Export studio-quality audio with broadcast normalization.
        </p>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-6">
          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Project Name</label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Cleaned Audio/Video"
                className="max-w-md"
              />
            </div>

            <div className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center max-w-md">
              <div className="flex gap-2 mb-3 text-muted-foreground">
                <Mic className="w-8 h-8" />
              </div>
              <span className="text-sm font-medium mb-2">Video or Audio Source</span>
              <p className="text-[10px] text-muted-foreground text-center mb-4 max-w-[200px]">
                Upload an MP4 video or an MP3/WAV file. Noise reduction will be applied automatically.
              </p>
              <input type="file" accept="video/*,audio/*" onChange={e => setSourceMedia(e.target.files?.[0] || null)} className="text-xs" />
            </div>

            <Button onClick={() => uploadMutation.mutate()} disabled={!canSubmit} className="w-full sm:w-auto">
              {uploadMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
              Clean Audio
            </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
