import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = resolve(repoRoot, "apps/web/public/icons");
const appSvgPath = resolve(iconsDir, "picnic-web.svg");

const RED = "#E2010F";
const SOURCE_TILE_VIEWBOX = "64 64 1126 1126";

const outputs = [
  { path: resolve(iconsDir, "picnic-web-192.png"), size: 192, background: "transparent" },
  { path: resolve(iconsDir, "picnic-web-512.png"), size: 512, background: "transparent" },
  { path: resolve(iconsDir, "picnic-web-maskable-512.png"), size: 512, background: RED },
  { path: resolve(iconsDir, "apple-touch-icon.png"), size: 180, background: RED },
];

function normalizeSvg(source) {
  const bodyMatch = source.match(/<svg\b[^>]*>([\s\S]*)<\/svg>\s*$/i);

  if (!bodyMatch) {
    throw new Error(`Could not parse SVG body from ${appSvgPath}`);
  }

  const body = bodyMatch[1].replace(
    /\n\s*<rect\s+width="1254"\s+height="1254"\s+fill="none"\s*\/>\s*/i,
    "\n"
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SOURCE_TILE_VIEWBOX}" role="img" aria-label="Picnic Web">
${body.trim()}
</svg>
`;
}

async function renderPng(browser, svg, output) {
  const page = await browser.newPage({
    viewport: {
      width: output.size,
      height: output.size,
    },
  });

  const svgData = Buffer.from(svg).toString("base64");
  const background = output.background === "transparent" ? "transparent" : output.background;

  await page.setContent(
    `<!doctype html>
<html>
  <body style="margin:0; width:${output.size}px; height:${output.size}px; background:${background}; overflow:hidden">
    <img alt="" src="data:image/svg+xml;base64,${svgData}" style="display:block; width:${output.size}px; height:${output.size}px" />
  </body>
</html>`
  );

  await page.screenshot({
    path: output.path,
    omitBackground: output.background === "transparent",
  });
  await page.close();
}

const source = await readFile(appSvgPath, "utf8");
const normalizedSvg = normalizeSvg(source);

await mkdir(iconsDir, { recursive: true });
await writeFile(appSvgPath, normalizedSvg);

const browser = await chromium.launch();

try {
  for (const output of outputs) {
    await renderPng(browser, normalizedSvg, output);
  }
} finally {
  await browser.close();
}

console.log(`Generated PWA icons in ${iconsDir}`);
