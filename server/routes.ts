import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import { ensureDirectories, runPipeline } from "./pipeline/processor";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

ensureDirectories();

const fileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: fileStorage,
  limits: { fileSize: 500 * 1024 * 1024 },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/projects", async (_req, res) => {
    try {
      const projects = await storage.getAllProjects();
      res.json(projects);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(parseInt(req.params.id));
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post(
    "/api/projects/upload",
    upload.fields([
      { name: "sourceVideo", maxCount: 1 },
      { name: "voiceover", maxCount: 1 },
      { name: "bgMusic", maxCount: 1 },
      { name: "logo", maxCount: 1 },
    ]),
    async (req, res) => {
      try {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };

        if (!files.sourceVideo?.[0] || !files.voiceover?.[0] || !files.bgMusic?.[0]) {
          return res
            .status(400)
            .json({ error: "Source video, voiceover, and background music are required" });
        }

        const projectName =
          (req.body.name as string) ||
          path.basename(files.sourceVideo[0].originalname, path.extname(files.sourceVideo[0].originalname));

        const captionStyle = (req.body.captionStyle as string) || "capcut_green";

        const project = await storage.createProject({
          name: projectName,
          status: "processing",
          currentStep: "uploading",
          progress: 5,
          sourceVideoPath: files.sourceVideo[0].path,
          voiceoverPath: files.voiceover[0].path,
          bgMusicPath: files.bgMusic[0].path,
          logoPath: files.logo?.[0]?.path || null,
          captionStyle,
        });

        runPipeline(project.id).catch((err) => {
          console.error("Pipeline error:", err);
        });

        res.status(201).json(project);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    }
  );

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteProject(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/projects/:id/download/:type", async (req, res) => {
    try {
      const project = await storage.getProject(parseInt(req.params.id));
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const filePath =
        req.params.type === "clear" ? project.clearVideoPath : project.captionVideoPath;

      if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
      }

      const filename = path.basename(filePath);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", "video/mp4");

      const stat = fs.statSync(filePath);
      res.setHeader("Content-Length", stat.size);

      const readStream = fs.createReadStream(filePath);
      readStream.pipe(res);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}
