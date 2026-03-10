import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/chat";

export const wordTimestamp = z.object({
  word: z.string(),
  start: z.number(),
  end: z.number(),
});

export const videoTimecode = z.object({
  start: z.string(),
  end: z.string(),
});

export type WordTimestamp = z.infer<typeof wordTimestamp>;
export type VideoTimecode = z.infer<typeof videoTimecode>;

export const pipelineStepEnum = z.enum([
  "uploading",
  "transcription",
  "video_curation",
  "audio_mixing",
  "video_composition",
  "subtitle_overlay",
  "exporting",
  "complete",
  "failed",
]);

export type PipelineStep = z.infer<typeof pipelineStepEnum>;

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().default("uploading"),
  currentStep: text("current_step").notNull().default("uploading"),
  progress: integer("progress").notNull().default(0),
  errorMessage: text("error_message"),
  sourceVideoPath: text("source_video_path"),
  voiceoverPath: text("voiceover_path"),
  bgMusicPath: text("bg_music_path"),
  logoPath: text("logo_path"),
  voiceoverDuration: integer("voiceover_duration"),
  transcription: jsonb("transcription"),
  timecodes: jsonb("timecodes"),
  mixedAudioPath: text("mixed_audio_path"),
  clearVideoPath: text("clear_video_path"),
  captionVideoPath: text("caption_video_path"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
