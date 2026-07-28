import { command } from "cleye";
import { execSync, exec } from "child_process";
import { promisify } from "util";
import { green, red, yellow, cyan } from "kolorist";
import { outro, spinner } from "@clack/prompts";
import pkg from "../../package.json";
import { handleCommandError, KnownError } from "../utils/error.js";

const execAsync = promisify(exec);

interface PackageManagerInfo {
  name: string;
  updateCommand: string;
}

// Determine the dist tag based on current version
// Versions with prerelease (e.g., 2.0.0-develop.5) use 'develop' tag
// Stable versions use 'latest' tag
function getDistTag(version: string): string {
  // Skip for development/semantic-release versions
  if (version === "0.0.0-semantic-release" || version.includes("semantic-release")) {
    return "latest";
  }
  // If version has prerelease identifier (contains '-'), use 'develop' tag
  if (version.includes("-")) {
    return "develop";
  }
  return "latest";
}

function detectPackageManager(distTag: string): PackageManagerInfo {
  // Check if running from global installation
  try {
    const globalPath = execSync("npm root -g", { encoding: "utf8" }).trim();
    const { execPath } = process;

    // Check if running from global npm installation
    if (
      execPath.includes(globalPath) ||
      execPath.includes("/usr/local") ||
      execPath.includes("/usr/bin")
    ) {
      return { name: "npm", updateCommand: `npm install -g aicommits@${distTag}` };
    }
  } catch {
    // Fall through to other detection methods
  }

  // Check for pnpm
  try {
    execSync("pnpm --version", { stdio: "ignore" });
    // Check if installed via pnpm global
    const pnpmList = execSync("pnpm list -g aicommits", { encoding: "utf8" });
    if (pnpmList.includes("aicommits")) {
      return { name: "pnpm", updateCommand: `pnpm add -g aicommits@${distTag}` };
    }
  } catch {
    // Not pnpm
  }

  // Check for yarn
  try {
    execSync("yarn --version", { stdio: "ignore" });
    // Check if installed via yarn global
    const yarnList = execSync("yarn global list", { encoding: "utf8" });
    if (yarnList.includes("aicommits")) {
      return { name: "yarn", updateCommand: `yarn global add aicommits@${distTag}` };
    }
  } catch {
    // Not yarn
  }

  // Check for bun
  try {
    execSync("bun --version", { stdio: "ignore" });
    // Check if installed via bun
    const bunList = execSync("bun pm bin -g", { encoding: "utf8" });
    if (process.execPath.includes("bun") || bunList.includes("aicommits")) {
      return { name: "bun", updateCommand: `bun add -g aicommits@${distTag}` };
    }
  } catch {
    // Not bun
  }

  // Default to npm
  return { name: "npm", updateCommand: `npm install -g aicommits@${distTag}` };
}

async function getLatestVersion(distTag: string): Promise<string | null> {
  try {
    const response = await fetch(`https://registry.npmjs.org/aicommits/${distTag}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.version || null;
  } catch {
    return null;
  }
}

export default command(
  {
    name: "update",
    description: "Update aicommits to the latest version",
    help: {
      description: "Check for updates and install the latest version using your package manager",
    },
  },
  () => {
    (async () => {
      // Determine dist tag based on current version
      const distTag = getDistTag(pkg.version);
      const pm = detectPackageManager(distTag);

      console.log(`${cyan("ℹ")} Current version: ${pkg.version}`);
      console.log(`${cyan("ℹ")} Package manager detected: ${pm.name}`);
      if (distTag !== "latest") {
        console.log(`${cyan("ℹ")} Using '${distTag}' distribution tag`);
      }

      const s = spinner();
      s.start("Checking for updates...");

      const latestVersion = await getLatestVersion(distTag);

      if (!latestVersion) {
        s.stop("Could not check for updates", 1);
        throw new KnownError("Failed to fetch latest version from npm registry");
      }

      if (latestVersion === pkg.version) {
        s.stop(`${green("✔")} Already on the latest version (${pkg.version})`);
        return;
      }

      s.stop(`${green("✔")} Update available: v${pkg.version} → v${latestVersion}`);

      const updateS = spinner();
      updateS.start(`Updating via ${pm.name}...`);

      try {
        await execAsync(pm.updateCommand, { timeout: 120000 });

        updateS.stop(`${green("✔")} Successfully updated to v${latestVersion}`);
        outro(`${green("✔")} Update complete! Run 'aic --version' to verify.`);
      } catch (error: any) {
        updateS.stop(`${red("✘")} Update failed`, 1);

        if (error.stderr?.includes("permission") || error.message?.includes("permission")) {
          console.error(`${red("✘")} Permission denied. Try running with sudo:`);
          console.error(`   sudo ${pm.updateCommand}`);
        } else if (error.stderr?.includes("EACCES")) {
          console.error(`${red("✘")} Permission denied. Try running with sudo:`);
          console.error(`   sudo ${pm.updateCommand}`);
        } else {
          console.error(`${red("✘")} Error: ${error.message || "Unknown error"}`);
          console.error(`\n${yellow("You can manually update with:")}`);
          console.error(`   ${pm.updateCommand}`);
        }

        process.exit(1);
      }
    })().catch(handleCommandError);
  },
);
