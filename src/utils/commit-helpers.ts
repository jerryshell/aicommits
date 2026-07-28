import { KnownError } from "./error.js";
import { isInteractive } from "./headless.js";

export const getCommitMessage = async (
  messages: string[],
  skipConfirm: boolean,
): Promise<string | null> => {
  const { select, confirm, isCancel } = await import("@clack/prompts");
  const { dim } = await import("kolorist");

  // Single message case
  if (messages.length === 1) {
    const [message] = messages;

    if (skipConfirm) {
      return message;
    }

    if (!isInteractive()) {
      throw new KnownError(
        "Interactive terminal required for commit message confirmation. Use --yes flag to skip confirmation.",
      );
    }

    console.log(`\n\x1b[1m${message}\x1b[0m\n`);
    const confirmed = await confirm({
      message: "Use this commit message?",
    });

    return confirmed && !isCancel(confirmed) ? message : null;
  }

  // Multiple messages case
  if (skipConfirm) {
    return messages[0];
  }

  if (!isInteractive()) {
    throw new KnownError(
      "Interactive terminal required for commit message selection. Use --yes flag to skip selection and use the first message.",
    );
  }

  const selected = await select({
    message: `Pick a commit message to use: ${dim("(Ctrl+c to exit)")}`,
    options: messages.map((value) => ({ label: value, value })),
  });

  return isCancel(selected) ? null : (selected as string);
};
