import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import request from "supertest";
import express from "express";
import { createServer } from "http";
import { registerRoutes } from "../routes";
import fs from "fs";
import path from "path";

describe("POST /api/projects/upload", () => {
  let app: express.Express;
  let testVideoPath: string;
  let testAudioPath: string;
  let testVoiceoverPath: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    const httpServer = createServer(app);
    await registerRoutes(httpServer, app);

    app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";

        if (res.headersSent) {
          return next(err);
        }

        return res.status(status).json({ message });
      });

    testVideoPath = path.join(process.cwd(), "test-dummy.mp4");
    testAudioPath = path.join(process.cwd(), "test-dummy.mp3");
    testVoiceoverPath = path.join(process.cwd(), "test-voiceover.mp3");

    fs.writeFileSync(testVideoPath, "dummy video content");
    fs.writeFileSync(testAudioPath, "dummy audio content");
    fs.writeFileSync(testVoiceoverPath, "dummy voiceover content");
  });

  afterAll(() => {
    const files = [testVideoPath, testAudioPath, testVoiceoverPath];
    for (const file of files) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }

    const uploadsDir = path.join(process.cwd(), "uploads");
    if (fs.existsSync(uploadsDir)) {
      const dirFiles = fs.readdirSync(uploadsDir);
      for (const file of dirFiles) {
        if (file.endsWith(".mp4") || file.endsWith(".mp3")) {
          const p = path.join(uploadsDir, file);
          const stat = fs.statSync(p);
          if (stat.size < 100) {
            fs.unlinkSync(p);
          }
        }
      }
    }
  });

  it("should return 400 if required files are missing (empty form)", async () => {
    const response = await request(app)
      .post("/api/projects/upload")
      .field("name", "Test Project");

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Source video, voiceover, and background music are required");
  });

  it("should return 400 if voiceover is missing", async () => {
    const response = await request(app)
      .post("/api/projects/upload")
      .field("name", "Test Project")
      .attach("sourceVideo", testVideoPath);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Source video, voiceover, and background music are required");
  });

  it("should return 400 if bgMusic is missing", async () => {
    const response = await request(app)
      .post("/api/projects/upload")
      .field("name", "Test Project")
      .attach("sourceVideo", testVideoPath)
      .attach("voiceover", testVoiceoverPath);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Source video, voiceover, and background music are required");
  });

});
