import { describe, test, expect } from "bun:test";
import { generatePrompt, generateDescriptionPrompt, languageRule } from "../src/utils/prompt.js";

describe("locale language rule", () => {
  test("languageRule is imperative and negative (locale-agnostic)", () => {
    const rule = languageRule("zh");
    expect(rule).toContain('MUST be written entirely in "zh"');
    expect(rule).toContain("Never write in another language");
  });

  test("generatePrompt uses the hard rule and drops the contradictory wording", () => {
    const prompt = generatePrompt("zh", 72, "plain");
    expect(prompt).toContain('MUST be written entirely in "zh"');
    expect(prompt).not.toContain("Exclude anything unnecessary such as translation");
  });

  test("generateDescriptionPrompt uses the hard rule", () => {
    const prompt = generateDescriptionPrompt("ja", 72);
    expect(prompt).toContain('MUST be written entirely in "ja"');
  });
});
