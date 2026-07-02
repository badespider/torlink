import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

// Fire-and-forget: we don't wait on the file manager, just launch it detached so
// it outlives torlink's own process handling and never blocks the UI.
function launch(cmd: string, args: string[]): void {
  try {
    const proc = spawn(cmd, args, { stdio: "ignore", detached: true, windowsHide: true });
    proc.on("error", () => {});
    proc.unref();
  } catch {
    // ignore — reveal is best-effort
  }
}

/**
 * Open the folder a download lives in, selecting the file itself where the OS
 * supports it (Finder on macOS, Explorer on Windows). Falls back to opening the
 * containing directory. Returns false if neither the file nor its directory
 * exists yet (e.g. a download that never started), so the caller can tell the user.
 */
export async function revealInFileManager(dir: string, name?: string): Promise<boolean> {
  if (!dir) return false;
  const file = name ? path.join(dir, name) : "";
  const hasFile = file ? await exists(file) : false;
  if (!hasFile && !(await exists(dir))) return false;

  if (process.platform === "darwin") {
    launch("open", hasFile ? ["-R", file] : [dir]);
  } else if (process.platform === "win32") {
    launch("explorer", hasFile ? [`/select,${file}`] : [dir]);
  } else {
    // Linux and others: no portable "reveal + select", so open the folder.
    launch("xdg-open", [hasFile ? path.dirname(file) : dir]);
  }
  return true;
}
