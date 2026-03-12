import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Video,
  Music,
  Image,
  Mic,
  Play,
  Download,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  Wand2,
  Film,
  AudioLines,
  Subtitles,
  FileVideo,
  ArrowRight,
  RefreshCw,
  Clock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CaptionStyleSelector } from "@/components/caption-styles";
import type { Project } from "@shared/schema";

const PIPELINE_STEPS = [
  { key: "uploading", label: "Upload", icon: Upload, description: "Uploading files" },
  { key: "transcription", label: "Transcribe", icon: Mic, description: "AI transcription with word-level timestamps" },
  { key: "video_curation", label: "AI Curation", icon: Sparkles, description: "Gemini selects the best video segments" },
  { key: "audio_mixing", label: "Audio Mix", icon: AudioLines, description: "FFmpeg audio engineering" },
  { key: "video_composition", label: "Compose", icon: Film, description: "9:16 sandwich layout rendering" },
  { key: "subtitle_overlay", label: "Subtitles", icon: Subtitles, description: "Animated captions overlay" },
  { key: "exporting", label: "Export", icon: FileVideo, description: "Dual video export" },
  { key: "complete", label: "Done", icon: CheckCircle2, description: "Processing complete" },
];

function getStepIndex(step: string): number {
  return PIPELINE_STEPS.findIndex((s) => s.key === step);
}

interface FileUploadZoneProps {
  label: string;
  accept: string;
  icon: typeof Video;
  file: File | null;
  onFileSelect: (file: File) => void;
  required?: boolean;
  description: string;
}

function FileUploadZone({
  label,
  accept,
  icon: Icon,
  file,
  onFileSelect,
  required = true,
  description,
}: FileUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) onFileSelect(droppedFile);
    },
    [onFileSelect]
  );

  return (
    <div
      data-testid={`upload-zone-${label.toLowerCase().replace(/\s/g, "-")}`}
      className={`relative rounded-xl border-2 border-dashed transition-all duration-300 cursor-pointer group ${
        isDragOver
          ? "border-primary bg-primary/5 scale-[1.02]"
          : file
            ? "border-emerald-500/50 bg-emerald-500/5"
            : "border-border hover:border-primary/40 hover:bg-muted/30"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      onClick={() => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = accept;
        input.onchange = (e) => {
          const f = (e.target as HTMLInputElement).files?.[0];
          if (f) onFileSelect(f);
        };
        input.click();
      }}
    >
      <div className="flex flex-col items-center justify-center p-6 gap-3">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
            file
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
          }`}
        >
          {file ? (
            <CheckCircle2 className="w-6 h-6" />
          ) : (
            <Icon className="w-6 h-6" />
          )}
        </div>
        <div className="text-center">
          <p className="font-semibold text-sm">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
        {file ? (
          <Badge variant="secondary" className="text-xs max-w-full truncate">
            {file.name}
          </Badge>
        ) : (
          <p className="text-xs text-muted-foreground">
            Drop file or click to browse
          </p>
        )}
      </div>
    </div>
  );
}

function PipelineStatus({ project }: { project: Project }) {
  const currentIndex = getStepIndex(project.currentStep);
  const isFailed = project.status === "failed";
  const isComplete = project.status === "complete";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {PIPELINE_STEPS.map((step, idx) => {
          const StepIcon = step.icon;
          const isActive = idx === currentIndex && !isFailed && !isComplete;
          const isDone = idx < currentIndex || isComplete;
          const isCurrent = idx === currentIndex;

          return (
            <div key={step.key} className="flex items-center">
              <div className="flex flex-col items-center min-w-[56px]">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-500 ${
                    isFailed && isCurrent
                      ? "bg-destructive/10 text-destructive"
                      : isDone
                        ? "bg-emerald-500/10 text-emerald-500"
                        : isActive
                          ? "bg-primary/10 text-primary animate-pulse"
                          : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isFailed && isCurrent ? (
                    <XCircle className="w-4 h-4" />
                  ) : isDone ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : isActive ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <StepIcon className="w-4 h-4" />
                  )}
                </div>
                <span
                  className={`text-[10px] mt-1.5 font-medium text-center leading-tight ${
                    isDone
                      ? "text-emerald-600 dark:text-emerald-400"
                      : isActive
                        ? "text-primary"
                        : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {idx < PIPELINE_STEPS.length - 1 && (
                <div
                  className={`w-4 h-0.5 mt-[-14px] transition-colors duration-500 ${
                    idx < currentIndex || isComplete
                      ? "bg-emerald-500/40"
                      : "bg-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {isFailed
              ? "Pipeline failed"
              : isComplete
                ? "Processing complete"
                : PIPELINE_STEPS[currentIndex]?.description || "Processing..."}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {project.progress}%
          </span>
        </div>
        <Progress
          value={project.progress}
          className={`h-2 ${isFailed ? "[&>div]:bg-destructive" : isComplete ? "[&>div]:bg-emerald-500" : ""}`}
          data-testid="progress-bar"
        />
      </div>

      {isFailed && project.errorMessage && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="rounded-lg bg-destructive/5 border border-destructive/20 p-4"
        >
          <p className="text-sm text-destructive font-medium">Error</p>
          <p className="text-xs text-destructive/80 mt-1">{project.errorMessage}</p>
        </motion.div>
      )}

      {isComplete && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <a
            href={`/api/projects/${project.id}/download/clear`}
            download
            data-testid="download-clear"
          >
            <Card className="p-4 hover:bg-muted/50 transition-colors cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <FileVideo className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">Clear Version</p>
                  <p className="text-xs text-muted-foreground">
                    No subtitles or logo
                  </p>
                </div>
                <Download className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Card>
          </a>

          <a
            href={`/api/projects/${project.id}/download/caption`}
            download
            data-testid="download-caption"
          >
            <Card className="p-4 hover:bg-muted/50 transition-colors cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 text-violet-500 flex items-center justify-center">
                  <Subtitles className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">Caption Version</p>
                  <p className="text-xs text-muted-foreground">
                    With subtitles & logo
                  </p>
                </div>
                <Download className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Card>
          </a>
        </motion.div>
      )}
    </motion.div>
  );
}

function ProjectCard({ project, onDelete }: { project: Project; onDelete: (id: number) => void }) {
  const isProcessing = !["complete", "failed"].includes(project.status);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card className="p-5 space-y-4" data-testid={`project-card-${project.id}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                project.status === "complete"
                  ? "bg-emerald-500/10 text-emerald-500"
                  : project.status === "failed"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-primary/10 text-primary"
              }`}
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : project.status === "complete" ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <XCircle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-sm" data-testid={`text-project-name-${project.id}`}>
                {project.name}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <Clock className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {new Date(project.createdAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(project.id)}
            data-testid={`button-delete-${project.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
        <PipelineStatus project={project} />
      </Card>
    </motion.div>
  );
}

export default function Home() {
  const { toast } = useToast();
  const [projectName, setProjectName] = useState("");
  const [sourceVideo, setSourceVideo] = useState<File | null>(null);
  const [voiceover, setVoiceover] = useState<File | null>(null);
  const [bgMusic, setBgMusic] = useState<File | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [captionStyle, setCaptionStyle] = useState("capcut_green");

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    let socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "PROJECT_UPDATE" && data.project) {
          queryClient.setQueryData<Project[]>(["/api/projects"], (old) => {
            if (!old) return [data.project];
            const exists = old.find((p) => p.id === data.project.id);
            if (exists) {
              return old.map((p) => (p.id === data.project.id ? data.project : p));
            } else {
              return [data.project, ...old];
            }
          });
        }
      } catch (err) {
        console.error("Failed to parse websocket message", err);
      }
    };

    return () => {
      socket.close();
    };
  }, []);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("sourceVideo", sourceVideo!);
      formData.append("voiceover", voiceover!);
      formData.append("bgMusic", bgMusic!);
      if (logo) formData.append("logo", logo);
      if (projectName) formData.append("name", projectName);
      formData.append("captionStyle", captionStyle);

      const res = await fetch("/api/projects/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setSourceVideo(null);
      setVoiceover(null);
      setBgMusic(null);
      setLogo(null);
      setProjectName("");
      setCaptionStyle("capcut_green");
      toast({ title: "Project created", description: "Pipeline processing has started" });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });

  const canSubmit = sourceVideo && voiceover && bgMusic && !uploadMutation.isPending;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center">
              <Wand2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">ReelForge</h1>
              <p className="text-xs text-muted-foreground">
                AI-Powered Vertical Video Creator
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs gap-1.5">
            <Sparkles className="w-3 h-3" />
            Gemini AI
          </Badge>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-primary/5 via-violet-500/5 to-primary/5 px-6 py-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold">Create New Short</h2>
                  <p className="text-sm text-muted-foreground">
                    Upload your files to start the automated pipeline
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Project Name
                </label>
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="My Awesome Short"
                  className="max-w-md"
                  data-testid="input-project-name"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <FileUploadZone
                  label="Source Video"
                  accept="video/*"
                  icon={Video}
                  file={sourceVideo}
                  onFileSelect={setSourceVideo}
                  description="Horizontal MP4 video"
                />
                <FileUploadZone
                  label="Voiceover"
                  accept="audio/*"
                  icon={Mic}
                  file={voiceover}
                  onFileSelect={setVoiceover}
                  description="MP3 narration track"
                />
                <FileUploadZone
                  label="Background Music"
                  accept="audio/*"
                  icon={Music}
                  file={bgMusic}
                  onFileSelect={setBgMusic}
                  description="MP3 music track"
                />
                <FileUploadZone
                  label="Logo"
                  accept="image/*"
                  icon={Image}
                  file={logo}
                  onFileSelect={setLogo}
                  required={false}
                  description="PNG logo (optional)"
                />
              </div>

              <CaptionStyleSelector
                selected={captionStyle}
                onSelect={setCaptionStyle}
              />

              <div className="flex items-center gap-4 pt-2">
                <Button
                  onClick={() => uploadMutation.mutate()}
                  disabled={!canSubmit}
                  className="gap-2 px-6"
                  data-testid="button-start-pipeline"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Start Pipeline
                    </>
                  )}
                </Button>
                {!canSubmit && !uploadMutation.isPending && (
                  <p className="text-xs text-muted-foreground">
                    Upload source video, voiceover, and background music to begin
                  </p>
                )}
              </div>
            </div>
          </Card>
        </motion.div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Projects</h2>
              {projects.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {projects.length}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: ["/api/projects"] })
              }
              data-testid="button-refresh"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Card key={i} className="p-5">
                  <div className="animate-pulse space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted" />
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-muted rounded w-1/3" />
                        <div className="h-3 bg-muted rounded w-1/4" />
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded" />
                  </div>
                </Card>
              ))}
            </div>
          ) : projects.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <Film className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-muted-foreground">
                No projects yet
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Upload your first video to create an AI-powered vertical short
              </p>
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="space-y-4">
                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                ))}
              </div>
            </AnimatePresence>
          )}
        </div>

        <Card className="p-6 bg-gradient-to-r from-primary/[0.03] to-violet-500/[0.03] border-primary/10">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">How It Works</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                {[
                  {
                    step: "1",
                    title: "AI Analysis",
                    desc: "Gemini transcribes your voiceover and curates the most engaging video segments",
                  },
                  {
                    step: "2",
                    title: "Smart Composition",
                    desc: "FFmpeg creates the 9:16 sandwich layout with blurred background and centered foreground",
                  },
                  {
                    step: "3",
                    title: "Dual Export",
                    desc: "Get two versions: a clean edit and one with animated subtitles and logo",
                  },
                ].map((item) => (
                  <div key={item.step} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                      {item.step}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
