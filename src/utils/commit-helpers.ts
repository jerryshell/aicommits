import { KnownError } from "./error.js";
import { isInteractive } from "./headless.js";

export const getCommitMessage = async (
  messages: string[],
  skipConfirm: boolean,
  copyToClipboard: boolean,
): Promise<string | null> => {
  const { select, text, isCancel } = await import("@clack/prompts");
  const { dim } = await import("kolorist");

  // Single message case
  if (messages.length === 1) {
    const [message] = messages;

    if (skipConfirm) {
      if (copyToClipboard) {
        console.log(`\n\x1b[1m${message}\x1b[0m\n`);
      }
      return message;
    }

    if (!isInteractive()) {
      throw new KnownError(
        "Interactive terminal required for commit message confirmation. Use --yes flag to skip confirmation.",
      );
    }

    console.log(`\n\x1b[1m${message}\x1b[0m\n`);
    const action = await select({
      message: copyToClipboard
        ? "Copy this message to the clipboard?"
        : "Commit with this message?",
      options: [
        { label: copyToClipboard ? "Copy" : "Commit", value: "yes" },
        { label: "Edit", value: "edit" },
        { label: "Cancel", value: "no" },
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
    if (copyToClipboard) {
      console.log(`\n\x1b[1m${messages[0]}\x1b[0m\n`);
    }
    return messages[0];
  }

  if (!isInteractive()) {
    throw new KnownError(
      "Interactive terminal required for commit message selection. Use --yes flag to skip selection and use the first message.",
    );
  }

  const selected = await select({
    message: `${copyToClipboard ? "Select a message to copy" : "Select a commit message"}: ${dim("(Ctrl+c to exit)")}`,
    options: messages.map((value) => ({ label: value, value })),
  });

  return isCancel(selected) ? null : (selected as string);
};
