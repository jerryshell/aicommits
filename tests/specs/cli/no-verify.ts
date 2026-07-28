import { testSuite, expect } from "manten";
import { execSync } from "child_process";
import { existsSync } from "fs";
import path from "path";

export default testSuite(({ describe }) => {
  describe("No Verify", ({ test }) => {
    test("Exposes --no-verify flag", () => {
      const cliPath = path.resolve(process.cwd(), "dist", "cli.mjs");
      if (!existsSync(cliPath)) {
        require("child_process").execSync("npm run build", { stdio: "inherit" });
      }
      const output = execSync(`node ${cliPath} --help`, { encoding: "utf8" });
      expect(output).toContain("-n, --no-verify");
    });
  });
});
