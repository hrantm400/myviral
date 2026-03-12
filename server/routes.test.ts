import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import request from "supertest";
import express from "express";
import { registerRoutes } from "./routes";
import { createServer } from "http";
import fs from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

describe("POST /api/projects/upload Error Handling", () => {
  let app: express.Express;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    const httpServer = createServer(app);
    await registerRoutes(httpServer, app);
  });

  afterAll(() => {
    // Clean up any files that were uploaded during tests
    if (fs.existsSync(UPLOAD_DIR)) {
      const files = fs.readdirSync(UPLOAD_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(UPLOAD_DIR, file));
      }
    }
  });

  it("should return 400 if sourceVideo is missing", async () => {
    const res = await request(app)
      .post("/api/projects/upload")
      .field("name", "test-project")
      .attach("voiceover", Buffer.from("test audio"), "voiceover.mp3")
      .attach("bgMusic", Buffer.from("test bg music"), "bgMusic.mp3");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Source video, voiceover, and background music are required");
  });

  it("should return 400 if voiceover is missing", async () => {
    const res = await request(app)
      .post("/api/projects/upload")
      .field("name", "test-project")
      .attach("sourceVideo", Buffer.from("test video"), "source.mp4")
      .attach("bgMusic", Buffer.from("test bg music"), "bgMusic.mp3");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Source video, voiceover, and background music are required");
  });

  it("should return 400 if bgMusic is missing", async () => {
    const res = await request(app)
      .post("/api/projects/upload")
      .field("name", "test-project")
      .attach("sourceVideo", Buffer.from("test video"), "source.mp4")
      .attach("voiceover", Buffer.from("test audio"), "voiceover.mp3");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Source video, voiceover, and background music are required");
  });

  it("should return 400 if all required files are missing", async () => {
    const res = await request(app)
      .post("/api/projects/upload")
      .field("name", "test-project");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Source video, voiceover, and background music are required");
  });
});