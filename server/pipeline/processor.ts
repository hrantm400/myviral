import { storage } from "../storage";
import { transcribeAudio, curateVideoSegments } from "./gemini";
import {
  getMediaDuration,
  mixAudio,
  extractVideoSegments,
  createSandwichVideo,
  generateASS,
} from "./ffmpeg";
import path from "path";
import fs from "fs";
import type { WordTimestamp, VideoTimecode } from "@shared/schema";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const OUTPUT_DIR = path.join(process.cwd(), "outputs");

export function ensureDirectories() {
  [UPLOAD_DIR, OUTPUT_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

async function updateProject(
  id: number,
  step: string,
  progress: number,
  extra: Record<string, any> = {}
) {
  await storage.updateProject(id, {
    currentStep: step,
    progress,
    status: step === "failed" ? "failed" : step === "complete" ? "complete" : "processing",
    ...extra,
  });
}

export async function runPipeline(projectId: number): Promise<void> {
  const project = await storage.getProject(projectId);
  if (!project) throw new Error("Project not found");

  const projectDir = path.join(OUTPUT_DIR, `project_${projectId}`);
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  try {
    await updateProject(projectId, "transcription", 10);

    const transcription = await transcribeAudio(project.voiceoverPath!);
    const voiceoverDuration = transcription.duration;

    await updateProject(projectId, "transcription", 25, {
      voiceoverDuration: Math.round(voiceoverDuration),
      transcription: transcription.words as any,
    });

    await updateProject(projectId, "video_curation", 30);

    const timecodes = await curateVideoSegments(
      project.sourceVideoPath!,
      transcription.text,
      voiceoverDuration
    );

    await updateProject(projectId, "video_curation", 45, {
      timecodes: timecodes as any,
    });

    await updateProject(projectId, "audio_mixing", 50);

    const mixedAudioPath = path.join(projectDir, "mixed_audio.wav");
    await mixAudio(
      project.sourceVideoPath!,
      project.voiceoverPath!,
      project.bgMusicPath!,
      mixedAudioPath,
      voiceoverDuration
    );

    await updateProject(projectId, "audio_mixing", 60, {
      mixedAudioPath,
    });

    await updateProject(projectId, "video_composition", 65);

    const segmentsDir = path.join(projectDir, "segments");
    if (!fs.existsSync(segmentsDir)) {
      fs.mkdirSync(segmentsDir, { recursive: true });
    }

    const segmentPaths = await extractVideoSegments(
      project.sourceVideoPath!,
      timecodes,
      segmentsDir
    );

    await updateProject(projectId, "video_composition", 70);

    const assContent = generateASS(transcription.words);
    const subtitlePath = path.join(projectDir, "subtitles.ass");
    fs.writeFileSync(subtitlePath, assContent);

    const clearVideoPath = path.join(projectDir, `${project.name}_clear.mp4`);
    const captionVideoPath = path.join(projectDir, `${project.name}_caption.mp4`);

    await updateProject(projectId, "subtitle_overlay", 75);

    await createSandwichVideo(
      segmentPaths,
      mixedAudioPath,
      project.logoPath,
      clearVideoPath,
      captionVideoPath,
      subtitlePath,
      voiceoverDuration
    );

    await updateProject(projectId, "exporting", 90, {
      clearVideoPath,
      captionVideoPath,
    });

    await updateProject(projectId, "complete", 100, {
      clearVideoPath,
      captionVideoPath,
    });
  } catch (error: any) {
    console.error(`Pipeline failed for project ${projectId}:`, error);
    await updateProject(projectId, "failed", 0, {
      errorMessage: error.message || "Pipeline processing failed",
    });
  }
}
