import { watch } from "node:fs";
import process from "node:process";
import { promisify } from "node:util";
import { execFile as execFileCallback } from "node:child_process";

const execFile = promisify(execFileCallback);
const repoRoot = process.cwd();
const ignoredSegments = new Set([
  ".git",
  "node_modules",
  ".turbo",
  ".expo",
  "dist",
  "build",
]);

let syncTimer = null;
let syncInFlight = false;
let syncQueued = false;

function timestamp() {
  return new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

function log(message) {
  process.stdout.write(`[git-auto-sync] ${message}\n`);
}

function shouldIgnore(targetPath = "") {
  if (!targetPath) return false;
  const normalized = targetPath.replace(/\\/g, "/");
  return normalized
    .split("/")
    .some((segment) => ignoredSegments.has(segment));
}

async function runGit(args, allowFailure = false) {
  try {
    const result = await execFile("git", args, {
      cwd: repoRoot,
      windowsHide: true,
    });
    return result.stdout.trim();
  } catch (error) {
    if (allowFailure) return "";
    const stderr = error.stderr?.trim();
    throw new Error(stderr || error.message);
  }
}

async function hasRemote() {
  const output = await runGit(["remote"], true);
  return output.split(/\r?\n/).some((line) => line.trim() === "origin");
}

async function syncChanges() {
  if (syncInFlight) {
    syncQueued = true;
    return;
  }

  syncInFlight = true;

  try {
    await runGit(["add", "-A"]);

    let hasStagedChanges = true;
    try {
      await runGit(["diff", "--cached", "--quiet"]);
      hasStagedChanges = false;
    } catch {
      hasStagedChanges = true;
    }

    if (!hasStagedChanges) {
      return;
    }

    const message = `auto: ${timestamp()}`;
    await runGit(["commit", "-m", message]);
    log(`commit created: ${message}`);

    if (!(await hasRemote())) {
      log("remote bulunamadi, commit localde birakildi.");
      return;
    }

    const branch = await runGit(["branch", "--show-current"]);
    const upstream = await runGit(
      ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
      true,
    );

    if (upstream) {
      await runGit(["push"]);
      log(`push tamamlandi: ${branch}`);
      return;
    }

    await runGit(["push", "-u", "origin", branch || "HEAD"]);
    log(`upstream tanimlandi ve push tamamlandi: ${branch || "HEAD"}`);
  } catch (error) {
    log(`hata: ${error.message}`);
  } finally {
    syncInFlight = false;
    if (syncQueued) {
      syncQueued = false;
      scheduleSync();
    }
  }
}

function scheduleSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void syncChanges();
  }, 4000);
}

async function main() {
  try {
    await runGit(["rev-parse", "--is-inside-work-tree"]);
  } catch (error) {
    log(`bu klasor bir git reposu degil: ${error.message}`);
    process.exit(1);
  }

  log(`izleme basladi: ${repoRoot}`);
  log("degisikliklerden 4 saniye sonra otomatik commit, remote varsa push yapilacak.");

  watch(
    repoRoot,
    { recursive: true },
    (_eventType, fileName) => {
      const relativePath = typeof fileName === "string" ? fileName : "";
      if (shouldIgnore(relativePath)) return;
      log(`degisiklik algilandi: ${relativePath || "(bilinmeyen dosya)"}`);
      scheduleSync();
    },
  );
}

main().catch((error) => {
  log(`baslatma hatasi: ${error.message}`);
  process.exit(1);
});
