import { type Project, type InsertProject } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  createProject(project: InsertProject): Promise<Project>;
  getProject(id: number): Promise<Project | undefined>;
  getAllProjects(): Promise<Project[]>;
  updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<void>;
}

export class MemStorage implements IStorage {
  private projects: Map<number, Project>;
  private nextId: number;

  constructor() {
    this.projects = new Map();
    this.nextId = 1;
  }

  async createProject(project: InsertProject): Promise<Project> {
    const id = this.nextId++;
    const newProject: Project = {
      id,
      name: project.name || "Untitled Project",
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
      createdAt: new Date(),
    };
    this.projects.set(id, newProject);
    return newProject;
  }

  async getProject(id: number): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async getAllProjects(): Promise<Project[]> {
    return Array.from(this.projects.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined> {
    const existing = this.projects.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data };
    this.projects.set(id, updated);
    return updated;
  }

  async deleteProject(id: number): Promise<void> {
    this.projects.delete(id);
  }
}

export const storage = new MemStorage();
