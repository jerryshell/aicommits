import { describe, test, expect } from "bun:test";
import { execSync } from "child_process";
import { existsSync } from "fs";
import path from "path";

describe("No Verify", () => {
  test("Exposes --no-verify flag", () => {
    const cliPath = path.resolve(process.cwd(), "dist", "cli.mjs");
    if (!existsSync(cliPath)) {
      execSync("npm run build", { stdio: "inherit" });
    }
    const output = execSync(`node ${cliPath} --help`, { encoding: "utf8" });
    expect(output).toContain("-n, --no-verify");
  });
});
