import { describe, test, expect } from "bun:test";
import { createFixture, createGit } from "./utils.js";
import { getStagedDiff } from "../src/utils/git.js";

describe("git utilities", () => {
  test("keeps non-ASCII staged filenames readable", async () => {
    const { fixture } = await createFixture();
    const git = await createGit(fixture.path);
    const filename = "降低AI推理成本优化方案.md";

    await fixture.writeFile(filename, "# Optimization\n");
    await git("config", ["core.quotePath", "true"]);
    await git("add", [filename]);

    const cwd = process.cwd();
    try {
      process.chdir(fixture.path);
      const staged = await getStagedDiff();

      expect(staged?.files).toEqual([filename]);
      expect(staged?.diff).toContain(filename);
    } finally {
      process.chdir(cwd);
      await fixture.rm();
    }
  });
});
