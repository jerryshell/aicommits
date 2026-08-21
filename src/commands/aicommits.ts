import { execa } from "execa";
import { black, dim, green, red, yellow, bgCyan } from "kolorist";
import { copyToClipboard as copyMessage } from "../utils/clipboard.js";
import { intro, outro, spinner } from "@clack/prompts";
import { assertGitRepo, getStagedDiff, getDetectedMessage } from "../utils/git.js";
import { getConfig, setConfigs } from "../utils/config-runtime.js";
import { getProvider, getGenerateParams } from "../feature/providers/index.js";
import { generateMessages } from "../utils/openai.js";
import { KnownError, handleCommandError } from "../utils/error.js";

import { getCommitMessage } from "../utils/commit-helpers.js";
import { isHeadless } from "../utils/headless.js";
import { MAX_DIFF_LENGTH } from "../utils/constants.js";
import { summarizeDiff } from "../utils/diff-summary.js";

export default async (
  generate: number | undefined,
  excludeFiles: string[],
  stageAll: boolean,
  commitType: string | undefined,
  skipConfirm: boolean,
  copyToClipboard: boolean,
  noVerify: boolean,
  customPrompt: string | undefined,
  rawArgv: string[],
) =>
  (async () => {
    const headless = isHeadless();

    if (!headless) {
      intro(bgCyan(black(" aicommits ")));
    }

    await assertGitRepo();

    if (stageAll) {
      await execa("git", ["add", "--update"]);
    }

    const staged = await getStagedDiff(excludeFiles);

    if (!staged) {
      throw new KnownError(
        "No staged changes found. Stage your changes manually, or automatically stage all changes with the `--all` flag.",
      );
    }

    if (!headless) {
      const detectingFiles = spinner();
      if (staged.files.length <= 10) {
        detectingFiles.start("Detecting staged files");
        detectingFiles.stop(
          `📁 ${getDetectedMessage(staged.files)}:\n${staged.files
            .map((file) => `     ${file}`)
            .join("\n")}`,
        );
      } else {
        detectingFiles.start("Detecting staged files");
        detectingFiles.stop(`📁 ${getDetectedMessage(staged.files)}`);
      }
    }

    const config = await getConfig({
      generate: generate?.toString(),
      type: commitType?.toString(),
    });

    const providerInstance = getProvider(config);
    if (!providerInstance) {
      if (!headless) {
        console.log("Welcome to aicommits! Let's set up your AI provider.");
        console.log("Run `aicommits setup` to configure your provider.");
        outro("Setup required. Please run: aicommits setup");
        return;
      } else {
        throw new KnownError(
          "No configuration found. Run `aicommits setup` in an interactive terminal, or set environment variables (OPENAI_API_KEY, etc.)",
        );
      }
    }

    const { model, baseUrl, apiKey, headers, timeout } = getGenerateParams(
      providerInstance,
      config,
    );
    config.model = model;

    // Prefer a condensed skeleton for huge diffs: ~30x fewer tokens
    const prepareDiff = (diff: string) =>
      diff.length > MAX_DIFF_LENGTH ? summarizeDiff(diff) : diff;
    const diffToUse = prepareDiff(staged.diff);

    const attemptGeneration = async (): Promise<string[]> => {
      const s = headless ? null : spinner();
      if (s) {
        s.start(
          `🔍 Analyzing changes in ${staged.files.length} file${
            staged.files.length === 1 ? "" : "s"
          }`,
        );
      }
      const startTime = Date.now();
      try {
        return await generateMessages(config, {
          model: config.model!,
          baseUrl,
          apiKey,
          diff: diffToUse,
          timeout,
          customPrompt,
          headers,
        });
      } finally {
        if (s) {
          const duration = Date.now() - startTime;
          s.stop(`✅ Changes analyzed in ${(duration / 1000).toFixed(1)}s`);
        }
      }
    };

    let messages!: string[];
    try {
      messages = await attemptGeneration();
    } catch (error: any) {
      if ((error as any).isModelDeprecated) {
        const fallbackModel = providerInstance.getDefaultModel();
        if (fallbackModel && fallbackModel !== config.model) {
          const deprecatedModel = config.model;
          if (!headless) {
            console.log(
              yellow(
                `⚠ Model "${deprecatedModel}" is deprecated. Switching to "${fallbackModel}".`,
              ),
            );
          }
          config.model = fallbackModel;
          await setConfigs([["OPENAI_MODEL", fallbackModel]]);
          messages = await attemptGeneration();
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    if (messages.length === 0) {
      throw new KnownError("No commit messages were generated. Try again.");
    }

    // Headless mode: output to stdout and exit
    if (headless) {
      const message = messages[0];
      console.log(message);
      return;
    }

    // Interactive mode: handle commit message selection and confirmation
    const message = await getCommitMessage(messages, skipConfirm);
    if (!message) {
      outro("Commit cancelled");
      return;
    }

    // Handle clipboard mode (early return)
    if (copyToClipboard) {
      const success = await copyMessage(message);
      if (success) {
        outro(`${green("✔")} Message copied to clipboard`);
      }
      return;
    }

    // Commit the message with timeout (use multiple -m for multi-line messages)
    try {
      const commitArgs = message.includes("\n\n")
        ? ["-m", message.split(/\n\n/)[0], "-m", message.slice(message.indexOf("\n\n") + 2)]
        : ["-m", message];
      if (noVerify) {
        commitArgs.push("--no-verify");
      }
      await execa("git", ["commit", ...commitArgs, ...rawArgv], {
        stdio: "inherit",
        cleanup: true,
        timeout: 10000,
      });
      outro(`${green("✔")} Successfully committed!`);
    } catch (error: any) {
      if (error.timedOut) {
        const success = await copyMessage(message);
        if (success) {
          outro(`${yellow("⚠")} Commit timed out after 10 seconds. Message copied to clipboard.`);
        } else {
          outro(`${yellow("⚠")} Commit timed out after 10 seconds. Could not copy to clipboard.`);
        }
        return;
      }
      if (error.exitCode !== undefined) {
        outro(`${red("✘")} Commit failed. This may be due to pre-commit hooks.`);
        console.error(`  ${dim("Use")} --no-verify ${dim("to bypass pre-commit hooks")}`);
        process.exit(1);
      }
      throw error;
    }
  })().catch(handleCommandError);
