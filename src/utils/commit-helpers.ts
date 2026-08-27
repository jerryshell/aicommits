import { KnownError } from "./error.js";
import { isInteractive } from "./headless.js";

export const getCommitMessage = async (
  messages: string[],
  skipConfirm: boolean,
): Promise<string | null> => {
  const { select, text, isCancel } = await import("@clack/prompts");
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
    const action = await select({
      message: "Use this commit message?",
      options: [
        { label: "Yes", value: "yes" },
        { label: "Edit", value: "edit" },
        { label: "No", value: "no" },
      ],
    });

    if (isCancel(action) || action === "no") {
      return null;
    }
    if (action === "yes") {
      return message;
    }

    const edited = await text({
      message: "Edit commit message:",
      initialValue: message,
      validate: (value) => (value.trim() ? undefined : "Commit message cannot be empty"),
    });

    return isCancel(edited) ? null : edited;
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
