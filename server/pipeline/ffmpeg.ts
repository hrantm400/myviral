import { exec, execSync } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

export async function getMediaDuration(filePath: string): Promise<number> {
  const { stdout } = await execAsync(
    `ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`
  );
  return parseFloat(stdout.trim());
}

export async function getVideoInfo(filePath: string): Promise<{
  duration: number;
  width: number;
  height: number;
  fps: number;
}> {
  const { stdout } = await execAsync(
    `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate -show_entries format=duration -of json "${filePath}"`
  );
  const data = JSON.parse(stdout);
  const stream = data.streams?.[0] || {};
  const format = data.format || {};
  const fpsStr = stream.r_frame_rate || "30/1";
  const [num, den] = fpsStr.split("/").map(Number);
  return {
    duration: parseFloat(format.duration || "0"),
    width: stream.width || 1920,
    height: stream.height || 1080,
    fps: den ? num / den : 30,
  };
}

export async function mixAudio(
  sourceVideoPath: string,
  voiceoverPath: string,
  bgMusicPath: string,
  outputPath: string,
  voiceoverDuration: number
): Promise<void> {
  const cmd = [
    "ffmpeg -y",
    `-i "${voiceoverPath}"`,
    `-i "${bgMusicPath}"`,
    `-filter_complex`,
    `"[0:a]volume=10dB[vo];`,
    `[1:a]atempo=1.1,volume=-10dB[bg];`,
    `[vo][bg]amix=inputs=2:duration=first:dropout_transition=2[out]"`,
    `-map "[out]"`,
    `-t ${voiceoverDuration}`,
    `-ar 44100`,
    `"${outputPath}"`,
  ].join(" ");

  await execAsync(cmd, { timeout: 300000 });
}

export async function extractVideoSegments(
  sourceVideoPath: string,
  timecodes: Array<{ start: string; end: string }>,
  outputDir: string
): Promise<string[]> {
  const segmentPaths: string[] = [];

  for (let i = 0; i < timecodes.length; i++) {
    const tc = timecodes[i];
    const outPath = path.join(outputDir, `segment_${i}.mp4`);

    const cmd = [
      "ffmpeg -y",
      `-ss ${tc.start}`,
      `-to ${tc.end}`,
      `-i "${sourceVideoPath}"`,
      `-c:v libx264 -preset fast -crf 23`,
      `-an`,
      `"${outPath}"`,
    ].join(" ");

    await execAsync(cmd, { timeout: 120000 });
    segmentPaths.push(outPath);
  }

  return segmentPaths;
}

export async function createSandwichVideo(
  segmentPaths: string[],
  mixedAudioPath: string,
  logoPath: string | null,
  outputClearPath: string,
  outputCaptionPath: string,
  subtitlePath: string | null,
  voiceoverDuration: number
): Promise<void> {
  const concatListPath = path.join(path.dirname(outputClearPath), "concat_list.txt");
  const concatContent = segmentPaths.map((p) => `file '${p}'`).join("\n");
  fs.writeFileSync(concatListPath, concatContent);

  const concatenatedPath = path.join(path.dirname(outputClearPath), "concatenated.mp4");

  await execAsync(
    `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c:v libx264 -preset fast -crf 23 "${concatenatedPath}"`,
    { timeout: 300000 }
  );

  const clearCmd = [
    "ffmpeg -y",
    `-i "${concatenatedPath}"`,
    `-i "${mixedAudioPath}"`,
    `-filter_complex`,
    `"[0:v]split=2[bg][fg];`,
    `[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:5[blurred];`,
    `[fg]scale=1080:-2,setsar=1[scaled];`,
    `[blurred][scaled]overlay=(W-w)/2:(H-h)/2[out]"`,
    `-map "[out]" -map 1:a`,
    `-c:v libx264 -preset medium -crf 20`,
    `-c:a aac -b:a 192k`,
    `-t ${voiceoverDuration}`,
    `-r 30 -s 1080x1920`,
    `"${outputClearPath}"`,
  ].join(" ");

  await execAsync(clearCmd, { timeout: 600000 });

  let captionCmd: string;
  if (subtitlePath && logoPath) {
    captionCmd = [
      "ffmpeg -y",
      `-i "${outputClearPath}"`,
      `-i "${logoPath}"`,
      `-filter_complex`,
      `"[1:v]scale=120:-1[logo];`,
      `[0:v][logo]overlay=W-w-30:30,`,
      `subtitles='${subtitlePath.replace(/'/g, "\\'")}':force_style='FontSize=22,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,BorderStyle=3,Outline=2,Shadow=1,Alignment=2,MarginV=120'[out]"`,
      `-map "[out]" -map 0:a`,
      `-c:v libx264 -preset medium -crf 20`,
      `-c:a copy`,
      `"${outputCaptionPath}"`,
    ].join(" ");
  } else if (subtitlePath) {
    captionCmd = [
      "ffmpeg -y",
      `-i "${outputClearPath}"`,
      `-vf "subtitles='${subtitlePath.replace(/'/g, "\\'")}':force_style='FontSize=22,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,BorderStyle=3,Outline=2,Shadow=1,Alignment=2,MarginV=120'"`,
      `-c:v libx264 -preset medium -crf 20`,
      `-c:a copy`,
      `"${outputCaptionPath}"`,
    ].join(" ");
  } else {
    await execAsync(`cp "${outputClearPath}" "${outputCaptionPath}"`);
    return;
  }

  await execAsync(captionCmd, { timeout: 600000 });
}

export function generateSRT(
  words: Array<{ word: string; start: number; end: number }>
): string {
  const lines: string[] = [];
  let index = 1;
  const chunkSize = 5;

  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize);
    const startTime = chunk[0].start;
    const endTime = chunk[chunk.length - 1].end;
    const text = chunk.map((w) => w.word).join(" ");

    lines.push(`${index}`);
    lines.push(`${formatSRTTime(startTime)} --> ${formatSRTTime(endTime)}`);
    lines.push(text);
    lines.push("");
    index++;
  }

  return lines.join("\n");
}

function formatSRTTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

export function generateASS(
  words: Array<{ word: string; start: number; end: number }>
): string {
  const header = `[Script Info]
Title: Dynamic Subtitles
ScriptType: v4.00+
WrapStyle: 0
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,3,1,2,40,40,200,1
Style: Highlight,Arial,52,&H0000FFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,105,105,0,0,1,3,1,2,40,40,200,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events: string[] = [];
  const chunkSize = 4;

  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize);
    const startTime = chunk[0].start;
    const endTime = chunk[chunk.length - 1].end;

    for (let j = 0; j < chunk.length; j++) {
      const w = chunk[j];
      const highlightedText = chunk
        .map((cw, idx) => {
          if (idx === j) {
            return `{\\c&H00FFFF&\\fscx110\\fscy110}${cw.word}{\\c&HFFFFFF&\\fscx100\\fscy100}`;
          }
          return cw.word;
        })
        .join(" ");

      events.push(
        `Dialogue: 0,${formatASSTime(w.start)},${formatASSTime(w.end)},Default,,0,0,0,,${highlightedText}`
      );
    }
  }

  return header + events.join("\n") + "\n";
}

function formatASSTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const cs = Math.round((seconds % 1) * 100);
  return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}
