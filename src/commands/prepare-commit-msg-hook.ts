import fs from "fs/promises";
import { intro, outro, spinner } from "@clack/prompts";
import { black, green, bgCyan } from "kolorist";
import { getStagedDiff } from "../utils/git.js";
import { getConfig } from "../utils/config-runtime.js";
import { getProvider, getGenerateParams } from "../feature/providers/index.js";
import { generateMessages } from "../utils/openai.js";
import { summarizeDiff } from "../utils/diff-summary.js";
import { MAX_DIFF_LENGTH } from "../utils/constants.js";
import { KnownError, handleCommandError } from "../utils/error.js";
import { isHeadless } from "../utils/headless.js";

const [messageFilePath, commitSource] = process.argv.slice(2);

export default () =>
  (async () => {
    if (!messageFilePath) {
      throw new KnownError(
        'Commit message file path is missing. This file should be called from the "prepare-commit-msg" git hook',
      );
    }

    // If a commit message is passed in, ignore
    if (commitSource) {
      return;
    }

    // All staged files can be ignored by our filter
    const staged = await getStagedDiff();
    if (!staged) {
      return;
    }

    const headless = isHeadless();
    if (!headless) {
      intro(bgCyan(black(" aicommits ")));
    }

    const config = await getConfig({});

    const providerInstance = getProvider(config);
    if (!providerInstance) {
      throw new KnownError("Invalid provider configuration. Run `aicommits setup` to reconfigure.");
    }

    const { model, baseUrl, apiKey, headers, timeout } = getGenerateParams(
      providerInstance,
      config,
    );

    const s = headless ? null : spinner();
    s?.start("The AI is analyzing your changes");
    let messages: string[];
    const diffToUse =
      staged.diff.length > MAX_DIFF_LENGTH ? summarizeDiff(staged.diff) : staged.diff;
    try {
      messages = await generateMessages(config, {
        model,
        baseUrl,
        apiKey,
        diff: diffToUse,
        timeout,
        headers,
      });
    } finally {
      s?.stop("Changes analyzed");
    }

    /**
     * When `--no-edit` is passed in, the base commit message is empty,
     * and even when you use pass in comments via #, they are ignored.
     *
     * Note: `--no-edit` cannot be detected in argvs so this is the only way to check
     */
    const baseMessage = await fs.readFile(messageFilePath, "utf8");
    const supportsComments = baseMessage !== "";
    const hasMultipleMessages = messages.length > 1;

    let instructions = "";

    if (supportsComments) {
      instructions = `# 🤖 AI generated commit${hasMultipleMessages ? "s" : ""}\n`;
    }

    if (hasMultipleMessages) {
      if (supportsComments) {
        instructions += "# Select one of the following messages by uncommenting:\n";
      }
      instructions += `\n${messages.map((message) => `# ${message}`).join("\n")}`;
    } else {
      if (supportsComments) {
        instructions += "# Edit the message below and commit:\n";
      }
      instructions += `\n${messages[0]}\n`;
    }

    const currentContent = await fs.readFile(messageFilePath, "utf8");
    const newContent = instructions + "\n" + currentContent;
    await fs.writeFile(messageFilePath, newContent);

    if (!headless) {
      outro(`${green("✔")} Saved commit message!`);
    }
  })().catch(handleCommandError);
