import { describe, it, expect, beforeEach } from 'vitest';
import { MemStorage } from './storage';
import { type InsertProject } from '@shared/schema';

describe('MemStorage', () => {
  let storage: MemStorage;

  beforeEach(() => {
    storage = new MemStorage();
  });

  describe('createProject', () => {
    it('should create a new project with default values', async () => {
      const projectData: InsertProject = { name: 'Test Project' };
      const project = await storage.createProject(projectData);

      expect(project.id).toBe(1);
      expect(project.name).toBe('Test Project');
      expect(project.status).toBe('uploading');
      expect(project.currentStep).toBe('uploading');
      expect(project.progress).toBe(0);
      expect(project.createdAt).toBeInstanceOf(Date);
    });

    it('should increment IDs for multiple projects', async () => {
      const p1 = await storage.createProject({ name: 'Project 1' });
      const p2 = await storage.createProject({ name: 'Project 2' });

      expect(p1.id).toBe(1);
      expect(p2.id).toBe(2);
    });

    it('should handle missing optional fields with defaults', async () => {
      // @ts-ignore - testing missing name field handling
      const project = await storage.createProject({});

      expect(project.name).toBe('Untitled Project');
      expect(project.status).toBe('uploading');
      expect(project.currentStep).toBe('uploading');
      expect(project.captionStyle).toBe('capcut_green');
    });
  });

  describe('getProject', () => {
    it('should retrieve an existing project', async () => {
      const created = await storage.createProject({ name: 'Get Me' });
      const retrieved = await storage.getProject(created.id);

      expect(retrieved).toEqual(created);
    });

    it('should return undefined for non-existent project', async () => {
      const retrieved = await storage.getProject(999);
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getAllProjects', () => {
    it('should return empty array when no projects exist', async () => {
      const projects = await storage.getAllProjects();
      expect(projects).toEqual([]);
    });

    it('should return all projects sorted by createdAt descending', async () => {
      const p1 = await storage.createProject({ name: 'Older' });
      // Force the first project to have an older timestamp to guarantee sorting order
      p1.createdAt = new Date(Date.now() - 1000);

      const p2 = await storage.createProject({ name: 'Newer' });

      const projects = await storage.getAllProjects();

      expect(projects.length).toBe(2);
      expect(projects[0].id).toBe(p2.id); // Newer should be first
      expect(projects[1].id).toBe(p1.id); // Older should be second
    });
  });

  describe('updateProject', () => {
    it('should update an existing project', async () => {
      const project = await storage.createProject({ name: 'Original' });
      const updated = await storage.updateProject(project.id, {
        name: 'Updated',
        status: 'complete',
        progress: 100
      });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated');
      expect(updated?.status).toBe('complete');
      expect(updated?.progress).toBe(100);
      expect(updated?.id).toBe(project.id);

      // Verify it's actually updated in storage
      const fetched = await storage.getProject(project.id);
      expect(fetched?.name).toBe('Updated');
      expect(fetched?.status).toBe('complete');
    });

    it('should return undefined when updating non-existent project', async () => {
      const updated = await storage.updateProject(999, { name: 'Ghost' });
      expect(updated).toBeUndefined();
    });
  });

  describe('deleteProject', () => {
    it('should remove an existing project', async () => {
      const project = await storage.createProject({ name: 'Delete Me' });

      await storage.deleteProject(project.id);

      const fetched = await storage.getProject(project.id);
      expect(fetched).toBeUndefined();
    });

    it('should not throw when deleting non-existent project', async () => {
      await expect(storage.deleteProject(999)).resolves.toBeUndefined();
    });
  });
});
