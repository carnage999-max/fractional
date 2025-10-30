import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, "..");
const monorepoRoot = path.resolve(projectRoot, "..");

const SOURCE = path.resolve(monorepoRoot, "smart contract", "artifacts");
const DEST = path.resolve(projectRoot, "public", "__artifacts");

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function copyArtifacts() {
  try {
    await fs.access(SOURCE);
  } catch {
    console.error(`[copy-artifacts] Source artifacts directory not found: ${SOURCE}`);
    return;
  }

  await ensureDir(DEST);

  const entries = await fs.readdir(SOURCE, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(SOURCE, entry.name);
    const to = path.join(DEST, entry.name);
    if (entry.isDirectory()) {
      await ensureDir(to);
      // simple recursive copy
      const stack = [[from, to]];
      while (stack.length) {
        const [srcDir, destDir] = stack.pop();
        await ensureDir(destDir);
        const subEntries = await fs.readdir(srcDir, { withFileTypes: true });
        for (const sub of subEntries) {
          const subFrom = path.join(srcDir, sub.name);
          const subTo = path.join(destDir, sub.name);
          if (sub.isDirectory()) {
            stack.push([subFrom, subTo]);
          } else if (sub.isFile()) {
            await fs.copyFile(subFrom, subTo);
          }
        }
      }
    } else if (entry.isFile()) {
      await fs.copyFile(from, to);
    }
  }

  console.log(`[copy-artifacts] Copied artifacts to ${DEST}`);
}

copyArtifacts().catch((error) => {
  console.error("[copy-artifacts] Failed:", error);
  process.exit(1);
});
