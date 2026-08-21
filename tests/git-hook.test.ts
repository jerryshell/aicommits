import path from "path";
import { describe, test, expect } from "bun:test";
import { createFixture, createGit, files } from "./utils.js";

if (!process.env.OPENAI_API_KEY) {
  console.warn("⚠️  process.env.OPENAI_API_KEY is necessary to run these tests. Skipping...");
} else {
  describe("Git hook", () => {
    test("errors when not in Git repo", async () => {
      const { fixture, aicommits } = await createFixture(files);
      const { exitCode, stderr } = await aicommits(["hook", "install"], {
        reject: false,
      });

      expect(exitCode).toBe(1);
      expect(stderr).toMatch("The current directory must be a Git repository");

      await fixture.rm();
    });

    test("installs from Git repo subdirectory", async () => {
      const { fixture, aicommits } = await createFixture({
        ...files,
        "some-dir": {
          "file.txt": "",
        },
      });
      await createGit(fixture.path);

      const { stdout } = await aicommits(["hook", "install"], {
        cwd: path.join(fixture.path, "some-dir"),
      });
      expect(stdout).toMatch("Hook installed");

      expect(await fixture.exists(".git/hooks/prepare-commit-msg")).toBe(true);

      await fixture.rm();
    });

    test("Commits", async () => {
      const { fixture, aicommits } = await createFixture(files);
      const git = await createGit(fixture.path);

      const { stdout } = await aicommits(["hook", "install"]);
      expect(stdout).toMatch("Hook installed");

      await git("add", ["data.json"]);
      await git("commit", ["--no-edit"], {
        env: {
          HOME: fixture.path,
          USERPROFILE: fixture.path,
        },
      });

      const { stdout: commitMessage } = await git("log", ["--pretty=%B"]);
      console.log("Committed with:", commitMessage);
      expect(commitMessage.startsWith("# ")).not.toBe(true);

      await fixture.rm();
    });
  });
}
