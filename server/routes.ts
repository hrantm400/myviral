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
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
  fileFilter: (_req, file, cb) => {
    // Basic strict mime-type validation based on expected fields
    const isVideoField = ["sourceVideo", "sourceMedia"].includes(file.fieldname);
    const isAudioField = ["voiceover", "bgMusic"].includes(file.fieldname);
    const isImageField = ["logo"].includes(file.fieldname);

    if (isVideoField && !file.mimetype.startsWith("video/")) {
      return cb(new Error(`Invalid file type for ${file.fieldname}. Expected video.`));
    }
    if (isAudioField && !file.mimetype.startsWith("audio/") && !file.mimetype.startsWith("video/")) {
      // Allow video for voiceover in case users upload MP4s for audio extraction
      return cb(new Error(`Invalid file type for ${file.fieldname}. Expected audio or video.`));
    }
    if (isImageField && !file.mimetype.startsWith("image/")) {
      return cb(new Error(`Invalid file type for ${file.fieldname}. Expected image.`));
    }

    cb(null, true);
  }
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
          projectType: "classic",
          status: "processing",
          currentStep: "uploading",
          progress: 5,
          sourceVideoPath: files.sourceVideo[0].path,
          voiceoverPath: files.voiceover[0].path,
          bgMusicPath: files.bgMusic[0].path,
          logoPath: files.logo?.[0]?.path || null,
          captionStyle,
        });

        import("./pipeline/processor").then((mod) => mod.queuePipeline(project.id)).catch(console.error);

        res.status(201).json(project);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    }
  );

  app.post(
    "/api/projects/ducking",
    upload.fields([
      { name: "voiceover", maxCount: 1 },
      { name: "bgMusic", maxCount: 1 },
    ]),
    async (req, res) => {
      try {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        if (!files.voiceover?.[0] || !files.bgMusic?.[0]) {
          return res.status(400).json({ error: "Voiceover and bgMusic required" });
        }

        const project = await storage.createProject({
          name: (req.body.name as string) || "Auto-Ducked Audio",
          projectType: "ducking",
          status: "processing",
          currentStep: "uploading",
          progress: 5,
          voiceoverPath: files.voiceover[0].path,
          bgMusicPath: files.bgMusic[0].path,
        });

        import("./pipeline/processor").then((mod) => mod.queuePipeline(project.id)).catch(console.error);
        res.status(201).json(project);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    }
  );

  app.post(
    "/api/projects/crop",
    upload.fields([{ name: "sourceVideo", maxCount: 1 }]),
    async (req, res) => {
      try {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        if (!files.sourceVideo?.[0]) return res.status(400).json({ error: "Source video required" });

        const project = await storage.createProject({
          name: (req.body.name as string) || "Smart Cropped Video",
          projectType: "crop",
          status: "processing",
          currentStep: "uploading",
          progress: 5,
          sourceVideoPath: files.sourceVideo[0].path,
        });

        import("./pipeline/processor").then((mod) => mod.queuePipeline(project.id)).catch(console.error);
        res.status(201).json(project);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    }
  );

  app.post(
    "/api/projects/color",
    upload.fields([{ name: "sourceVideo", maxCount: 1 }]),
    async (req, res) => {
      try {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        if (!files.sourceVideo?.[0]) return res.status(400).json({ error: "Source video required" });

        const project = await storage.createProject({
          name: (req.body.name as string) || "Cinematic Color Grade",
          projectType: "color",
          status: "processing",
          currentStep: "uploading",
          progress: 5,
          sourceVideoPath: files.sourceVideo[0].path,
        });

        import("./pipeline/processor").then((mod) => mod.queuePipeline(project.id)).catch(console.error);
        res.status(201).json(project);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    }
  );

  app.post(
    "/api/projects/motion-track",
    upload.fields([{ name: "sourceVideo", maxCount: 1 }]),
    async (req, res) => {
      try {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        if (!files.sourceVideo?.[0]) return res.status(400).json({ error: "Source video required" });

        const overlayText = (req.body.overlayText as string) || "Tracked Object";

        const project = await storage.createProject({
          name: (req.body.name as string) || "Motion Tracked Video",
          projectType: "motion-track",
          status: "processing",
          currentStep: "uploading",
          progress: 5,
          sourceVideoPath: files.sourceVideo[0].path,
          // temporarily storing overlay text in captionStyle field or similar, or just relying on a DB update later if needed.
          // since we only process once, we can pass this via extra state, but schema doesn't have a freeform meta column.
          // let's hijack captionStyle for overlayText
          captionStyle: overlayText,
        });

        import("./pipeline/processor").then((mod) => mod.queuePipeline(project.id)).catch(console.error);
        res.status(201).json(project);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    }
  );

  app.post(
    "/api/projects/isolate",
    upload.fields([{ name: "sourceMedia", maxCount: 1 }]),
    async (req, res) => {
      try {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        if (!files.sourceMedia?.[0]) return res.status(400).json({ error: "Source media required" });

        const project = await storage.createProject({
          name: (req.body.name as string) || "Studio Clear Vocal",
          projectType: "isolate",
          status: "processing",
          currentStep: "uploading",
          progress: 5,
          sourceVideoPath: files.sourceMedia[0].path, // Store both audio/video in the same path column
        });

        import("./pipeline/processor").then((mod) => mod.queuePipeline(project.id)).catch(console.error);
        res.status(201).json(project);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    }
  );

  app.post(
    "/api/projects/highlights",
    upload.fields([{ name: "sourceVideo", maxCount: 1 }]),
    async (req, res) => {
      try {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        if (!files.sourceVideo?.[0]) return res.status(400).json({ error: "Source video required" });

        const project = await storage.createProject({
          name: (req.body.name as string) || "Podcast Highlights",
          projectType: "highlights",
          status: "processing",
          currentStep: "uploading",
          progress: 5,
          sourceVideoPath: files.sourceVideo[0].path,
        });

        import("./pipeline/processor").then((mod) => mod.queuePipeline(project.id)).catch(console.error);
        res.status(201).json(project);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    }
  );

  app.post(
    "/api/projects/combo",
    upload.fields([
      { name: "sourceVideo", maxCount: 1 },
      { name: "voiceover", maxCount: 1 },
      { name: "bgMusic", maxCount: 1 },
    ]),
    async (req, res) => {
      try {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const comboType = req.body.comboType as string; // combo-viral, combo-podcast, etc.

        if (!comboType) {
          return res.status(400).json({ error: "comboType is required" });
        }

        // We hijack captionStyle to pass dynamic text inputs like overlayText or specific subtitle styles
        const extraText = (req.body.extraText as string) || "capcut_green";

        const project = await storage.createProject({
          name: (req.body.name as string) || `Magic Combo: ${comboType}`,
          projectType: comboType,
          status: "processing",
          currentStep: "uploading",
          progress: 5,
          sourceVideoPath: files.sourceVideo?.[0]?.path || null,
          voiceoverPath: files.voiceover?.[0]?.path || null,
          bgMusicPath: files.bgMusic?.[0]?.path || null,
          captionStyle: extraText,
        });

        import("./pipeline/processor").then((mod) => mod.queuePipeline(project.id)).catch(console.error);
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
