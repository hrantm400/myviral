import { storage } from "../storage";
import { transcribeAudio, curateVideoSegments } from "./gemini";
import {
  mixAudio,
  extractVideoSegments,
  createSandwichVideo,
  generateASS,
} from "./ffmpeg";
import path from "path";
import fs from "fs";
import { broadcastProjectUpdate } from "../websocket";

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
  const updatedProject = await storage.updateProject(id, {
    currentStep: step,
    progress,
    status: step === "failed" ? "failed" : step === "complete" ? "complete" : "processing",
    ...extra,
  });

  if (updatedProject) {
    broadcastProjectUpdate(updatedProject);
  }
}

import { extractHighlights } from "./gemini";
import { autoDucking, smartCropVideo, autoColorGrade, isolateVocal, motionTrackOverlay } from "./ffmpeg";

export async function runPipeline(projectId: number): Promise<void> {
  const project = await storage.getProject(projectId);
  if (!project) throw new Error("Project not found");

  const projectDir = path.join(OUTPUT_DIR, `project_${projectId}`);
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  try {
    if (project.projectType === "ducking") {
      await processDuckingPipeline(project, projectDir);
      return;
    }
    if (project.projectType === "crop") {
      await processCropPipeline(project, projectDir);
      return;
    }
    if (project.projectType === "highlights") {
      await processHighlightsPipeline(project, projectDir);
      return;
    }
    if (project.projectType === "color") {
      await processColorPipeline(project, projectDir);
      return;
    }
    if (project.projectType === "isolate") {
      await processIsolatePipeline(project, projectDir);
      return;
    }
    if (project.projectType === "motion-track") {
      await processMotionTrackPipeline(project, projectDir);
      return;
    }

    // Combo Pipelines
    if (project.projectType === "combo-viral") {
      await processViralCombo(project, projectDir);
      return;
    }
    if (project.projectType === "combo-podcast") {
      await processPodcastCombo(project, projectDir);
      return;
    }
    if (project.projectType === "combo-action") {
      await processActionCombo(project, projectDir);
      return;
    }
    if (project.projectType === "combo-cinematic") {
      await processCinematicCombo(project, projectDir);
      return;
    }
    if (project.projectType === "combo-meme") {
      await processMemeCombo(project, projectDir);
      return;
    }

    // Classic Sandwich Pipeline
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

    const captionStyleId = project.captionStyle || "capcut_green";
    const assContent = generateASS(transcription.words, captionStyleId);
    const subtitlePath = path.join(projectDir, "subtitles.ass");
    fs.writeFileSync(subtitlePath, assContent);

    const safeName = project.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
    const clearVideoPath = path.join(projectDir, `${safeName}_clear.mp4`);
    const captionVideoPath = path.join(projectDir, `${safeName}_caption.mp4`);

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

async function processDuckingPipeline(project: any, projectDir: string) {
  await updateProject(project.id, "audio_mixing", 20);

  const transcription = await transcribeAudio(project.voiceoverPath!);
  const voiceoverDuration = transcription.duration;

  await updateProject(project.id, "audio_mixing", 50);

  const mixedAudioPath = path.join(projectDir, "mixed_audio.wav");
  await autoDucking(
    project.voiceoverPath!,
    project.bgMusicPath!,
    mixedAudioPath,
    voiceoverDuration
  );

  await updateProject(project.id, "complete", 100, {
    mixedAudioPath,
    clearVideoPath: mixedAudioPath, // Allow download through existing clear video route
  });
}

async function processCropPipeline(project: any, projectDir: string) {
  await updateProject(project.id, "video_curation", 30);

  const safeName = project.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
  const clearVideoPath = path.join(projectDir, `${safeName}_crop.mp4`);

  await updateProject(project.id, "video_composition", 60);

  // Naive fixed duration for crop, in real app extract real duration
  await smartCropVideo(
    project.sourceVideoPath!,
    clearVideoPath,
    15 // Default to 15s for demo
  );

  await updateProject(project.id, "complete", 100, {
    clearVideoPath,
    captionVideoPath: clearVideoPath // Both point to the same file for now
  });
}

async function processHighlightsPipeline(project: any, projectDir: string) {
  await updateProject(project.id, "transcription", 20);
  const transcription = await transcribeAudio(project.sourceVideoPath!);

  await updateProject(project.id, "video_curation", 50, {
    transcription: transcription.words as any,
  });

  const timecodes = await extractHighlights(
    project.sourceVideoPath!,
    transcription.text,
    transcription.duration
  );

  await updateProject(project.id, "video_composition", 70, {
    timecodes: timecodes as any,
  });

  const segmentsDir = path.join(projectDir, "segments");
  if (!fs.existsSync(segmentsDir)) {
    fs.mkdirSync(segmentsDir, { recursive: true });
  }

  const segmentPaths = await extractVideoSegments(
    project.sourceVideoPath!,
    timecodes,
    segmentsDir
  );

  // In a full implementation, we would stitch these or provide them as a zip.
  // For now, we'll just link the first highlighted segment as the main video.
  const clearVideoPath = segmentPaths[0];

  await updateProject(project.id, "complete", 100, {
    clearVideoPath,
    captionVideoPath: clearVideoPath
  });
}

// --- COMBO PIPELINES ---

async function processViralCombo(project: any, projectDir: string) {
  // Highlights -> Crop -> Color -> Subtitles
  await updateProject(project.id, "transcription", 10);
  const transcription = await transcribeAudio(project.sourceVideoPath!);

  await updateProject(project.id, "video_curation", 30);
  const timecodes = await extractHighlights(project.sourceVideoPath!, transcription.text, transcription.duration);
  const segmentsDir = path.join(projectDir, "segments");
  if (!fs.existsSync(segmentsDir)) fs.mkdirSync(segmentsDir, { recursive: true });

  const segmentPaths = await extractVideoSegments(project.sourceVideoPath!, timecodes, segmentsDir);
  const highlightVideo = segmentPaths[0]; // Take best highlight

  await updateProject(project.id, "video_composition", 50);
  const croppedVideo = path.join(projectDir, `cropped.mp4`);
  await smartCropVideo(highlightVideo, croppedVideo, 15); // Naive 15s

  await updateProject(project.id, "subtitle_overlay", 70);
  const coloredVideo = path.join(projectDir, `colored.mp4`);
  await autoColorGrade(croppedVideo, coloredVideo);

  await updateProject(project.id, "exporting", 90);
  const captionStyleId = project.captionStyle || "capcut_green";
  const assContent = generateASS(transcription.words, captionStyleId);
  const subtitlePath = path.join(projectDir, "subtitles.ass");
  fs.writeFileSync(subtitlePath, assContent);

  const clearVideo = path.join(projectDir, `clear_viral.mp4`);
  const finalVideo = path.join(projectDir, `final_viral.mp4`);

  // Mix with itself as audio for demo purposes (coloredVideo has the original audio)
  await createSandwichVideo([coloredVideo], coloredVideo, null, clearVideo, finalVideo, subtitlePath, 15);

  await updateProject(project.id, "complete", 100, { clearVideoPath: clearVideo, captionVideoPath: finalVideo });
}

async function processPodcastCombo(project: any, projectDir: string) {
  // Isolate -> Ducking -> Subtitles
  await updateProject(project.id, "audio_mixing", 20);
  const isolatedAudio = path.join(projectDir, "isolated.m4a");
  await isolateVocal(project.voiceoverPath!, isolatedAudio, false);

  await updateProject(project.id, "transcription", 40);
  const transcription = await transcribeAudio(isolatedAudio);

  await updateProject(project.id, "audio_mixing", 60);
  const duckedAudio = path.join(projectDir, "ducked.wav");
  await autoDucking(isolatedAudio, project.bgMusicPath!, duckedAudio, transcription.duration);

  // For a podcast combo, since we don't have a video, we just return the audio for now
  // or a blank video with subtitles if we wanted to get fancy. Let's just return the ducked audio as clear.
  await updateProject(project.id, "complete", 100, { clearVideoPath: duckedAudio, captionVideoPath: duckedAudio });
}

async function processActionCombo(project: any, projectDir: string) {
  // Crop -> Color -> Motion Track
  await updateProject(project.id, "video_composition", 20);
  const croppedVideo = path.join(projectDir, `cropped.mp4`);
  await smartCropVideo(project.sourceVideoPath!, croppedVideo, 10); // 10s clip

  await updateProject(project.id, "subtitle_overlay", 50);
  const coloredVideo = path.join(projectDir, `colored.mp4`);
  await autoColorGrade(croppedVideo, coloredVideo);

  await updateProject(project.id, "exporting", 80);
  const trackedVideo = path.join(projectDir, `final_action.mp4`);
  const overlayText = project.captionStyle || "SEND IT!";
  await motionTrackOverlay(coloredVideo, trackedVideo, overlayText);

  await updateProject(project.id, "complete", 100, { clearVideoPath: coloredVideo, captionVideoPath: trackedVideo });
}

async function processCinematicCombo(project: any, projectDir: string) {
  // Sandwich -> Color -> Ducking -> Subtitles
  await updateProject(project.id, "transcription", 10);
  const transcription = await transcribeAudio(project.voiceoverPath!);
  const dur = Math.round(transcription.duration);

  await updateProject(project.id, "video_curation", 30);
  const timecodes = await curateVideoSegments(project.sourceVideoPath!, transcription.text, dur);
  const segmentsDir = path.join(projectDir, "segments");
  if (!fs.existsSync(segmentsDir)) fs.mkdirSync(segmentsDir, { recursive: true });
  const segmentPaths = await extractVideoSegments(project.sourceVideoPath!, timecodes, segmentsDir);

  await updateProject(project.id, "audio_mixing", 50);
  const duckedAudio = path.join(projectDir, "ducked.wav");
  await autoDucking(project.voiceoverPath!, project.bgMusicPath!, duckedAudio, dur);

  await updateProject(project.id, "video_composition", 70);
  const coloredSegments = [];
  for (let i=0; i<segmentPaths.length; i++) {
     const p = path.join(projectDir, `colored_seg_${i}.mp4`);
     await autoColorGrade(segmentPaths[i], p);
     coloredSegments.push(p);
  }

  await updateProject(project.id, "exporting", 85);
  const assContent = generateASS(transcription.words, "neon_pop");
  const subtitlePath = path.join(projectDir, "subtitles.ass");
  fs.writeFileSync(subtitlePath, assContent);

  const clearVideoPath = path.join(projectDir, `clear_cine.mp4`);
  const captionVideoPath = path.join(projectDir, `final_cine.mp4`);

  await createSandwichVideo(coloredSegments, duckedAudio, null, clearVideoPath, captionVideoPath, subtitlePath, dur);
  await updateProject(project.id, "complete", 100, { clearVideoPath, captionVideoPath });
}

async function processMemeCombo(project: any, projectDir: string) {
  // Isolate -> Motion Track -> Subtitles
  await updateProject(project.id, "audio_mixing", 20);
  // Must use .mp4 because isolateVocal with isVideo=true copies the video stream
  const isolatedVideo = path.join(projectDir, "isolated.mp4");
  await isolateVocal(project.sourceVideoPath!, isolatedVideo, true);

  await updateProject(project.id, "subtitle_overlay", 50);
  const trackedVideo = path.join(projectDir, "tracked.mp4");
  const emoji = project.captionStyle || "😂";
  await motionTrackOverlay(isolatedVideo, trackedVideo, emoji);

  await updateProject(project.id, "exporting", 80);
  // For transcription, we can still use the isolated .mp4 since ffmpeg/ffprobe can extract audio from it
  const transcription = await transcribeAudio(isolatedVideo);
  const assContent = generateASS(transcription.words, "fire");
  const subtitlePath = path.join(projectDir, "subtitles.ass");
  fs.writeFileSync(subtitlePath, assContent);

  const clearVideo = path.join(projectDir, `clear_meme.mp4`);
  const finalVideo = path.join(projectDir, `final_meme.mp4`);
  await createSandwichVideo([trackedVideo], isolatedVideo, null, clearVideo, finalVideo, subtitlePath, transcription.duration);

  await updateProject(project.id, "complete", 100, { clearVideoPath: clearVideo, captionVideoPath: finalVideo });
}


async function processMotionTrackPipeline(project: any, projectDir: string) {
  await updateProject(project.id, "video_composition", 50);

  const safeName = project.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
  const clearVideoPath = path.join(projectDir, `${safeName}_tracked.mp4`);

  // We hijacked captionStyle to store overlay text
  const overlayText = project.captionStyle || "Target";
  await motionTrackOverlay(project.sourceVideoPath!, clearVideoPath, overlayText);

  await updateProject(project.id, "complete", 100, {
    clearVideoPath,
    captionVideoPath: clearVideoPath
  });
}

async function processColorPipeline(project: any, projectDir: string) {
  await updateProject(project.id, "video_composition", 50);

  const safeName = project.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
  const clearVideoPath = path.join(projectDir, `${safeName}_colored.mp4`);

  await autoColorGrade(project.sourceVideoPath!, clearVideoPath);

  await updateProject(project.id, "complete", 100, {
    clearVideoPath,
    captionVideoPath: clearVideoPath
  });
}

async function processIsolatePipeline(project: any, projectDir: string) {
  await updateProject(project.id, "audio_mixing", 50);

  const safeName = project.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
  const isVideo = project.sourceVideoPath.toLowerCase().endsWith(".mp4");
  // Use .m4a since we encode audio as aac
  const ext = isVideo ? ".mp4" : ".m4a";
  const clearVideoPath = path.join(projectDir, `${safeName}_clean${ext}`);

  await isolateVocal(project.sourceVideoPath!, clearVideoPath, isVideo);

  await updateProject(project.id, "complete", 100, {
    clearVideoPath,
    captionVideoPath: clearVideoPath
  });
}
