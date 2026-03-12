import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import type { CaptionStyle } from "../../shared/caption-styles";
import { getCaptionStyleById } from "../../shared/caption-styles";

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
      `ass='${subtitlePath.replace(/'/g, "\\'")}'[out]"`,
      `-map "[out]" -map 0:a`,
      `-c:v libx264 -preset medium -crf 20`,
      `-c:a copy`,
      `"${outputCaptionPath}"`,
    ].join(" ");
  } else if (subtitlePath) {
    const escapedSubPath = subtitlePath.replace(/\\/g, "/").replace(/'/g, "\\'").replace(/:/g, "\\:");
    captionCmd = [
      "ffmpeg -y",
      `-i "${outputClearPath}"`,
      `-vf ass='${escapedSubPath}'`,
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

export function generateASS(
  words: Array<{ word: string; start: number; end: number }>,
  styleId: string = "capcut_green"
): string {
  const style = getCaptionStyleById(styleId);
  const boldFlag = style.bold ? -1 : 0;

  const header = `[Script Info]
Title: Dynamic Subtitles
ScriptType: v4.00+
WrapStyle: 0
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.fontName},${style.fontSize},${style.primaryColor},&H000000FF,${style.outlineColor},${style.backColor},${boldFlag},0,0,0,100,100,2,0,1,${style.outlineWidth},${style.shadow},2,40,40,180,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events: string[] = [];
  const chunkSize = 4;

  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize);
    const chunkStart = chunk[0].start;
    const chunkEnd = chunk[chunk.length - 1].end;

    for (let wi = 0; wi < chunk.length; wi++) {
      const word = chunk[wi];
      const segStart = word.start;
      const segEnd = word.end;

      const textParts = chunk.map((cw, idx) => {
        const w = style.uppercase ? cw.word.toUpperCase() : cw.word;
        if (idx === wi) {
          return `{\\c${style.highlightColor}\\fscx${style.scaleOnHighlight}\\fscy${style.scaleOnHighlight}}${w}{\\c${style.primaryColor}\\fscx100\\fscy100}`;
        }
        return w;
      });

      const line1Words = textParts.slice(0, Math.ceil(textParts.length / 2));
      const line2Words = textParts.slice(Math.ceil(textParts.length / 2));
      let text: string;
      if (line2Words.length > 0) {
        text = line1Words.join(" ") + "\\N" + line2Words.join(" ");
      } else {
        text = line1Words.join(" ");
      }

      events.push(
        `Dialogue: 0,${formatASSTime(segStart)},${formatASSTime(segEnd)},Default,,0,0,0,,${text}`
      );
    }

    if (chunk.length > 1) {
      const lastWordEnd = chunk[chunk.length - 1].end;
      const nextChunkStart = i + chunkSize < words.length ? words[i + chunkSize].start : lastWordEnd + 0.1;
      const gapEnd = Math.min(nextChunkStart, lastWordEnd + 0.3);

      if (gapEnd > lastWordEnd + 0.01) {
        const allWords = chunk.map((cw) => (style.uppercase ? cw.word.toUpperCase() : cw.word));
        const line1 = allWords.slice(0, Math.ceil(allWords.length / 2));
        const line2 = allWords.slice(Math.ceil(allWords.length / 2));
        let holdText: string;
        if (line2.length > 0) {
          holdText = line1.join(" ") + "\\N" + line2.join(" ");
        } else {
          holdText = line1.join(" ");
        }
        events.push(
          `Dialogue: 0,${formatASSTime(lastWordEnd)},${formatASSTime(gapEnd)},Default,,0,0,0,,${holdText}`
        );
      }
    }
  }

  return header + events.join("\n") + "\n";
}

export function formatASSTime(seconds: number): string {
  // Round to nearest centisecond first to handle 0.999 cases correctly
  const roundedSeconds = Math.round(seconds * 100) / 100;
  const hrs = Math.floor(roundedSeconds / 3600);
  const mins = Math.floor((roundedSeconds % 3600) / 60);
  const secs = Math.floor(roundedSeconds % 60);
  const cs = Math.round((roundedSeconds % 1) * 100);
  return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}
