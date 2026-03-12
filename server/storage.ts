import { type Project, type InsertProject } from "@shared/schema";

export interface IStorage {
  createProject(project: InsertProject): Promise<Project>;
  getProject(id: number): Promise<Project | undefined>;
  getAllProjects(): Promise<Project[]>;
  updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<void>;
}

import { db } from "./db";
import { projects } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
  async createProject(project: InsertProject): Promise<Project> {
    const [newProject] = await db.insert(projects).values({
      name: project.name || "Untitled Project",
      projectType: project.projectType || "classic",
      status: project.status || "uploading",
      currentStep: project.currentStep || "uploading",
      progress: project.progress || 0,
      errorMessage: project.errorMessage || null,
      sourceVideoPath: project.sourceVideoPath || null,
      voiceoverPath: project.voiceoverPath || null,
      bgMusicPath: project.bgMusicPath || null,
      logoPath: project.logoPath || null,
      voiceoverDuration: project.voiceoverDuration || null,
      transcription: project.transcription || null,
      timecodes: project.timecodes || null,
      mixedAudioPath: project.mixedAudioPath || null,
      clearVideoPath: project.clearVideoPath || null,
      captionVideoPath: project.captionVideoPath || null,
      captionStyle: project.captionStyle || "capcut_green",
    }).returning();
    return newProject;
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async getAllProjects(): Promise<Project[]> {
    return db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  async updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined> {
    const [updated] = await db
      .update(projects)
      .set(data)
      .where(eq(projects.id, id))
      .returning();
    return updated;
  }

  async deleteProject(id: number): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }
}

export const storage = new DatabaseStorage();
