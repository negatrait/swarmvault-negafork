import { z } from "zod";
import { runGoSidecarSync } from "./subprocess.js";
import type { ChartSpec, OutputAsset, OutputFormat, SceneSpec } from "./types.js";

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const chartSpecSchema = z.object({
  kind: z.enum(["bar", "line"]).default("bar"),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  xLabel: z.string().optional(),
  yLabel: z.string().optional(),
  seriesLabel: z.string().optional(),
  data: z
    .array(
      z.object({
        label: z.string().min(1),
        value: z.number().finite()
      })
    )
    .min(2)
    .max(12),
  notes: z.array(z.string().min(1)).max(5).optional()
});

export const sceneSpecSchema = z.object({
  title: z.string().min(1),
  alt: z.string().min(1),
  background: z.string().optional(),
  width: z.number().int().positive().max(2400).optional(),
  height: z.number().int().positive().max(2400).optional(),
  elements: z
    .array(
      z.object({
        kind: z.enum(["shape", "label"]),
        shape: z.enum(["rect", "circle", "line"]).optional(),
        x: z.number().finite(),
        y: z.number().finite(),
        width: z.number().finite().optional(),
        height: z.number().finite().optional(),
        radius: z.number().finite().optional(),
        text: z.string().optional(),
        fontSize: z.number().finite().optional(),
        fill: z.string().optional(),
        stroke: z.string().optional(),
        strokeWidth: z.number().finite().optional(),
        opacity: z.number().finite().optional()
      })
    )
    .min(1)
    .max(32)
});

export function renderChartSvg(spec: ChartSpec): { svg: string; width: number; height: number } {
  if (process.env.USE_GO_PORT === "true" || process.env.USE_GO_PORT !== "false") {
    return runGoSidecarSync("output-artifacts", { action: "renderChartSvg", args: { spec } });
  }
  return { svg: "", width: 0, height: 0 };
}

export function renderSceneSvg(spec: SceneSpec): { svg: string; width: number; height: number } {
  const width = clampNumber(spec.width ?? 1200, 480, 1600);
  const height = clampNumber(spec.height ?? 720, 320, 1200);
  const elements = spec.elements
    .map((element) => {
      const opacity = element.opacity === undefined ? 1 : clampNumber(element.opacity, 0, 1);
      if (element.kind === "label") {
        return `<text x="${element.x}" y="${element.y}" font-size="${clampNumber(element.fontSize ?? 28, 10, 72)}" fill="${escapeXml(
          element.fill ?? "#0f172a"
        )}" opacity="${opacity}" font-family="'Avenir Next', 'Segoe UI', sans-serif">${escapeXml(element.text ?? "")}</text>`;
      }

      switch (element.shape) {
        case "circle":
          return `<circle cx="${element.x}" cy="${element.y}" r="${Math.max(6, element.radius ?? 40)}" fill="${escapeXml(
            element.fill ?? "#dbeafe"
          )}" stroke="${escapeXml(element.stroke ?? "#0ea5e9")}" stroke-width="${Math.max(1, element.strokeWidth ?? 2)}" opacity="${opacity}" />`;
        case "line":
          return `<line x1="${element.x}" y1="${element.y}" x2="${element.x + (element.width ?? 120)}" y2="${
            element.y + (element.height ?? 0)
          }" stroke="${escapeXml(element.stroke ?? "#475569")}" stroke-width="${Math.max(1, element.strokeWidth ?? 3)}" opacity="${opacity}" />`;
        default:
          return `<rect x="${element.x}" y="${element.y}" width="${Math.max(8, element.width ?? 160)}" height="${Math.max(
            8,
            element.height ?? 120
          )}" rx="22" fill="${escapeXml(element.fill ?? "#e2e8f0")}" stroke="${escapeXml(element.stroke ?? "#94a3b8")}" stroke-width="${Math.max(
            1,
            element.strokeWidth ?? 2
          )}" opacity="${opacity}" />`;
      }
    })
    .join("");

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(
      spec.alt
    )}">`,
    `<rect width="100%" height="100%" fill="${escapeXml(spec.background ?? "#f8fafc")}" />`,
    `<text x="48" y="64" font-size="34" font-weight="700" fill="#0f172a">${escapeXml(spec.title)}</text>`,
    elements,
    `</svg>`
  ].join("");

  return { svg, width, height };
}

export function renderRasterPosterSvg(input: { title: string; alt: string; rasterFileName: string; width?: number; height?: number }): {
  svg: string;
  width: number;
  height: number;
} {
  const width = clampNumber(input.width ?? 1200, 480, 1600);
  const height = clampNumber(input.height ?? 720, 320, 1200);
  const inset = 42;

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(
      input.alt
    )}">`,
    '<rect width="100%" height="100%" fill="#f8fafc" />',
    `<text x="${inset}" y="56" font-size="34" font-weight="700" fill="#0f172a">${escapeXml(input.title)}</text>`,
    `<image href="${escapeXml(input.rasterFileName)}" x="${inset}" y="92" width="${width - inset * 2}" height="${height - 148}" preserveAspectRatio="xMidYMid meet" />`,
    `</svg>`
  ].join("");

  return { svg, width, height };
}

export function buildOutputAssetManifest(input: {
  slug: string;
  format: OutputFormat;
  question: string;
  title: string;
  citations: string[];
  answer: string;
  assets: OutputAsset[];
  spec: ChartSpec | SceneSpec | Record<string, unknown>;
}): string {
  return `${JSON.stringify(
    {
      slug: input.slug,
      format: input.format,
      question: input.question,
      title: input.title,
      answer: input.answer,
      citations: input.citations,
      assets: input.assets,
      spec: input.spec
    },
    null,
    2
  )}\n`;
}
