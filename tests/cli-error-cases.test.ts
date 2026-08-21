import { describe, test, expect } from "bun:test";
import { createFixture, createGit } from "./utils.js";

describe("Error cases", () => {
  test("Fails on non-Git project", async () => {
    const { fixture, aicommits } = await createFixture({
      ".aicommits": "OPENAI_API_KEY=sk-test-key",
    });
    const { stderr, exitCode } = await aicommits([], { reject: false });
    expect(exitCode).toBe(1);
    expect(stderr).toMatch("The current directory must be a Git repository!");
    await fixture.rm();
  });

  test("Fails on no staged files", async () => {
    const { fixture, aicommits } = await createFixture({
      ".aicommits": "OPENAI_API_KEY=sk-test-key",
    });
    await createGit(fixture.path);

    const { stderr, exitCode } = await aicommits([], { reject: false });
    expect(exitCode).toBe(1);
    expect(stderr).toMatch(
      "No staged changes found. Stage your changes manually, or automatically stage all changes with the `--all` flag.",
    );
    await fixture.rm();
  });
});
