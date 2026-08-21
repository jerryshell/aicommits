import fs from "fs/promises";
import path from "path";
import { beforeAll, afterAll, describe, test, expect } from "bun:test";
import { createFixture } from "./utils.js";

describe("config", () => {
  let fixture: Awaited<ReturnType<typeof createFixture>>["fixture"];
  let aicommits: Awaited<ReturnType<typeof createFixture>>["aicommits"];
  let configPath: string;

  beforeAll(async () => {
    ({ fixture, aicommits } = await createFixture());
    configPath = path.join(fixture.path, ".aicommits");
  });

  afterAll(async () => {
    await fixture.rm();
  });

  const openAiToken = "OPENAI_API_KEY=abc";

  test("set unknown config file", async () => {
    const { stderr } = await aicommits(["config", "set", "UNKNOWN=1"], {
      reject: false,
    });

    expect(stderr).toMatch("Invalid config property: UNKNOWN");
  });

  test("set OPENAI_API_KEY", async () => {
    const { stderr } = await aicommits(["config", "set", "OPENAI_API_KEY=abc"], {
      reject: false,
    });

    expect(stderr).toBe("");
  });

  test("set config file", async () => {
    await aicommits(["config", "set", openAiToken]);

    const configFile = await fs.readFile(configPath, "utf8");
    expect(configFile).toMatch(openAiToken);
  });

  test("get config file", async () => {
    const { stdout } = await aicommits(["config", "get", "OPENAI_API_KEY"]);
    expect(stdout).toBe("OPENAI_API_KEY=abc****");
  });

  test("reading unknown config", async () => {
    await fs.appendFile(configPath, "UNKNOWN=1");

    const { stdout, stderr } = await aicommits(["config", "get", "UNKNOWN"], {
      reject: false,
    });

    expect(stdout).toBe("");
    expect(stderr).toBe("");
  });

  describe("timeout", () => {
    test("setting invalid timeout config", async () => {
      const { stderr } = await aicommits(["config", "set", "timeout=abc"], {
        reject: false,
      });

      expect(stderr).toMatch("Must be an integer");
    });

    test("setting valid timeout config", async () => {
      const timeout = "timeout=20000";
      await aicommits(["config", "set", timeout]);

      const configFile = await fs.readFile(configPath, "utf8");
      expect(configFile).toMatch(timeout);

      const get = await aicommits(["config", "get", "timeout"]);
      expect(get.stdout).toBe(timeout);
    });
  });

  test("accepts type=conventional+body", async () => {
    await aicommits(["config", "set", "OPENAI_API_KEY=abc"]);
    await aicommits(["config", "set", "type=conventional+body"]);
    const { stdout } = await aicommits(["config", "get", "type"]);
    expect(stdout).toBe("type=conventional+body");
  });

  test("accepts type=subject+body", async () => {
    await aicommits(["config", "set", "OPENAI_API_KEY=abc"]);
    await aicommits(["config", "set", "type=subject+body"]);
    const { stdout } = await aicommits(["config", "get", "type"]);
    expect(stdout).toBe("type=subject+body");
  });

  describe("max-length", () => {
    test("must be an integer", async () => {
      const { stderr } = await aicommits(["config", "set", "max-length=abc"], {
        reject: false,
      });

      expect(stderr).toMatch("Must be an integer");
    });

    test("must be at least 20 characters", async () => {
      const { stderr } = await aicommits(["config", "set", "max-length=10"], {
        reject: false,
      });

      expect(stderr).toMatch(/must be greater than 20 characters/i);
    });

    test("updates config", async () => {
      const defaultConfig = await aicommits(["config", "get", "max-length"]);
      expect(defaultConfig.stdout).toBe("max-length=72");

      const maxLength = "max-length=60";
      await aicommits(["config", "set", maxLength]);

      const configFile = await fs.readFile(configPath, "utf8");
      expect(configFile).toMatch(maxLength);

      const get = await aicommits(["config", "get", "max-length"]);
      expect(get.stdout).toBe(maxLength);
    });
  });
});
