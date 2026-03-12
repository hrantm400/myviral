import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ensureDirectories } from './processor';

// Mock fs to intercept calls
vi.mock('fs', () => {
  return {
    default: {
      existsSync: vi.fn(),
      mkdirSync: vi.fn(),
    }
  };
});

describe('processor.ts', () => {
  describe('ensureDirectories', () => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    const outputDir = path.join(process.cwd(), 'outputs');

    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should create both directories if neither exists', () => {
      // Mock existsSync to return false for all calls
      vi.mocked(fs.existsSync).mockReturnValue(false);

      ensureDirectories();

      // Check if existsSync was called for both directories
      expect(fs.existsSync).toHaveBeenCalledWith(uploadDir);
      expect(fs.existsSync).toHaveBeenCalledWith(outputDir);

      // Check if mkdirSync was called for both directories with recursive true
      expect(fs.mkdirSync).toHaveBeenCalledWith(uploadDir, { recursive: true });
      expect(fs.mkdirSync).toHaveBeenCalledWith(outputDir, { recursive: true });

      // Should be called twice total
      expect(fs.mkdirSync).toHaveBeenCalledTimes(2);
    });

    it('should not create directories if they already exist', () => {
      // Mock existsSync to return true for all calls
      vi.mocked(fs.existsSync).mockReturnValue(true);

      ensureDirectories();

      // Should check if they exist
      expect(fs.existsSync).toHaveBeenCalledWith(uploadDir);
      expect(fs.existsSync).toHaveBeenCalledWith(outputDir);

      // Should not call mkdirSync
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should only create the directory that is missing', () => {
      // Mock existsSync to return true for uploads, false for outputs
      vi.mocked(fs.existsSync).mockImplementation((dirPath) => {
        return dirPath === uploadDir;
      });

      ensureDirectories();

      // Should check both
      expect(fs.existsSync).toHaveBeenCalledWith(uploadDir);
      expect(fs.existsSync).toHaveBeenCalledWith(outputDir);

      // Should only create outputs directory
      expect(fs.mkdirSync).toHaveBeenCalledWith(outputDir, { recursive: true });
      expect(fs.mkdirSync).not.toHaveBeenCalledWith(uploadDir, expect.anything());
      expect(fs.mkdirSync).toHaveBeenCalledTimes(1);
    });
  });
});
