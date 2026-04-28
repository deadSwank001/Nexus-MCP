import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);

const getBinaryPaths = () => {
  const homeDir = os.homedir();
  const FOUNDRY_BIN = path.join(homeDir, ".foundry", "bin");
  const BIFROST_BIN = path.join(homeDir, ".bifrost", "bin");

  return {
    castPath: path.join(FOUNDRY_BIN, "cast"),
    forgePath: path.join(FOUNDRY_BIN, "forge"),
    anvilPath: path.join(FOUNDRY_BIN, "anvil"),
    heimdallPath: path.join(BIFROST_BIN, "heimdall"),
    homeDir,
  };
};

const { castPath, forgePath, anvilPath, heimdallPath, homeDir } =
  getBinaryPaths();

export const FOUNDRY_PATHS = { castPath, forgePath, anvilPath, heimdallPath, homeDir };

export const FOUNDRY_NOT_INSTALLED_ERROR =
  "Foundry tools are not installed. Install Foundry: https://book.getfoundry.sh/getting-started/installation";
export const HEIMDALL_NOT_INSTALLED_ERROR =
  "Heimdall is not installed. Install: curl -L http://get.heimdall.rs | bash && bifrost";

export async function checkFoundryInstalled(): Promise<boolean> {
  try {
    await execAsync(`${forgePath} --version`);
    return true;
  } catch {
    return false;
  }
}

export async function checkHeimdallInstalled(): Promise<boolean> {
  try {
    await execAsync(`${heimdallPath} --version`);
    return true;
  } catch {
    return false;
  }
}

export async function executeCommand(
  command: string
): Promise<{ success: boolean; message: string }> {
  try {
    const { stdout, stderr } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });
    if (stderr && !stdout) {
      return { success: false, message: stderr };
    }
    return { success: true, message: stdout };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    return { success: false, message: errorMessage };
  }
}
