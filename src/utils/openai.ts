import { generateText, Output } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { APICallError, NoSuchModelError } from "@ai-sdk/provider";
import { z } from "zod";
import { KnownError } from "./error.js";
import type { CommitType } from "./config-types.js";
import { generatePrompt, generateDescriptionPrompt } from "./prompt.js";
import { isHeadless } from "./headless.js";

const shouldLogDebug = () =>
  Boolean(process.env.DEBUG || process.env.AICOMMITS_DEBUG) && !isHeadless();

const titleSchema = z.object({ title: z.string().min(1) });

const descriptionSchema = z.object({ description: z.string() });

const deduplicateMessages = (array: string[]) => Array.from(new Set(array));

const makeProvider = (baseUrl: string, apiKey: string, headers?: Record<string, string>) =>
  baseUrl === "https://api.openai.com/v1"
    ? createOpenAI({ apiKey })
    : createOpenAICompatible({
        name: "custom",
        apiKey,
        baseURL: baseUrl,
        headers,
      });

export { makeProvider };

const createAbortController = (timeout: number) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  return { controller, timeoutId };
};

const shortenCommitMessage = async (
  provider: ReturnType<typeof makeProvider>,
  model: string,
  message: string,
  maxLength: number,
  timeout: number,
) => {
  const { controller, timeoutId } = createAbortController(timeout);
  try {
    const s = `You are a tool that shortens git commit messages. Given a commit message, make it shorter while preserving the key information and format. The shortened message must be ${maxLength} characters or less. Respond with JSON: {"title": "shortened commit message"}.`;
    const { output } = await generateText({
      model: provider(model),
      output: Output.object({ schema: titleSchema }),
      system: s,
      prompt: message,
      temperature: 0.2,
      maxRetries: 2,
      reasoning: "none",
      abortSignal: controller.signal,
    });
    return output.title;
  } finally {
    clearTimeout(timeoutId);
  }
};

export type GenerateCommitMessageOptions = {
  baseUrl: string;
  apiKey: string;
  model: string;
  locale: string;
  diff: string;
  completions: number;
  maxLength: number;
  type: CommitType;
  timeout: number;
  customPrompt?: string;
  headers?: Record<string, string>;
};

export const generateCommitMessage = async ({
  baseUrl,
  apiKey,
  model,
  locale,
  diff,
  completions,
  maxLength,
  type,
  timeout,
  customPrompt,
  headers,
}: GenerateCommitMessageOptions) => {
  if (shouldLogDebug()) {
    console.log("Diff being sent to AI:");
    console.log(diff);
  }

  try {
    const provider = makeProvider(baseUrl, apiKey, headers);
    const { controller, timeoutId } = createAbortController(timeout);

    const promises = Array.from({ length: completions }, () =>
      generateText({
        model: provider(model),
        output: Output.object({ schema: titleSchema }),
        system: generatePrompt(locale, maxLength, type, customPrompt),
        prompt: diff,
        temperature: 0.4,
        maxRetries: 2,
        reasoning: "none",
        abortSignal: controller.signal,
      }),
    );
    const results = await (async () => {
      try {
        return await Promise.all(promises);
      } finally {
        clearTimeout(timeoutId);
      }
    })();
    let messages = deduplicateMessages(results.map((r) => r.output.title));

    const MAX_SHORTEN_RETRIES = 3;
    for (let retry = 0; retry < MAX_SHORTEN_RETRIES; retry++) {
      let needsShortening = false;
      const shortenedMessages = await Promise.all(
        messages.map(async (msg) => {
          if (msg.length <= maxLength) return msg;
          needsShortening = true;
          try {
            return await shortenCommitMessage(provider, model, msg, maxLength, timeout);
          } catch {
            return msg;
          }
        }),
      );
      messages = deduplicateMessages(shortenedMessages);
      if (!needsShortening) break;
    }

    const usage = {
      prompt_tokens: results.reduce((sum, r) => sum + (r.usage?.inputTokens || 0), 0),
      completion_tokens: results.reduce((sum, r) => sum + (r.usage?.outputTokens || 0), 0),
      total_tokens: results.reduce((sum, r) => sum + (r.usage?.totalTokens || 0), 0),
    };
    return { messages, usage };
  } catch (error) {
    handleGenerateError(error, model, timeout);
  }
};

export type GenerateCommitDescriptionOptions = {
  baseUrl: string;
  apiKey: string;
  model: string;
  locale: string;
  title: string;
  diff: string;
  timeout: number;
  maxLength: number;
  customPrompt?: string;
  headers?: Record<string, string>;
};

const wrapLine = (line: string, maxLength: number): string => {
  const bulletMatch = /^([-*]\s)/.exec(line);
  const indent = bulletMatch ? "  " : "";
  const continuationMax = maxLength - indent.length;

  if (line.length <= maxLength) return line;

  const parts: string[] = [];
  let rest = line;
  let isFirst = true;

  while (rest.length > (isFirst ? maxLength : continuationMax)) {
    const maxThisLine = isFirst ? maxLength : continuationMax;
    const chunk = rest.slice(0, maxThisLine);
    const lastSpace = chunk.lastIndexOf(" ");
    const splitAt = lastSpace > 0 ? lastSpace + 1 : maxThisLine;
    const segment = rest.slice(0, splitAt).trim();
    parts.push(isFirst ? segment : indent + segment);
    rest = rest.slice(splitAt).trim();
    isFirst = false;
  }
  if (rest.length > 0) {
    parts.push(isFirst ? rest : indent + rest);
  }
  return parts.join("\n");
};

export const generateCommitDescription = async ({
  baseUrl,
  apiKey,
  model,
  locale,
  title,
  diff,
  timeout,
  maxLength,
  customPrompt,
  headers,
}: GenerateCommitDescriptionOptions) => {
  if (shouldLogDebug()) {
    console.log("Title and diff for description:");
    console.log({ title, diffLength: diff.length });
  }

  const provider = makeProvider(baseUrl, apiKey, headers);
  const { controller, timeoutId } = createAbortController(timeout);

  try {
    const result = await generateText({
      model: provider(model),
      output: Output.object({ schema: descriptionSchema }),
      system: generateDescriptionPrompt(locale, maxLength, customPrompt),
      prompt: "Commit message title:\n" + title + "\n\nCode diff:\n" + diff,
      temperature: 0.4,
      maxRetries: 2,
      reasoning: "none",
      abortSignal: controller.signal,
    });
    clearTimeout(timeoutId);
    let description = result.output.description;
    description = description
      .split("\n")
      .map((line) => wrapLine(line, maxLength))
      .join("\n");
    return { description, usage: result.usage };
  } catch (error) {
    clearTimeout(timeoutId);
    handleGenerateError(error, model, timeout);
  }
};

export type CombineCommitMessagesOptions = {
  messages: string[];
  baseUrl: string;
  apiKey: string;
  model: string;
  locale: string;
  maxLength: number;
  type: CommitType;
  timeout: number;
  customPrompt?: string;
  headers?: Record<string, string>;
};

export const combineCommitMessages = async ({
  messages,
  baseUrl,
  apiKey,
  model,
  maxLength,
  timeout,
  headers,
}: CombineCommitMessagesOptions) => {
  try {
    const provider = makeProvider(baseUrl, apiKey, headers);
    const { controller, timeoutId } = createAbortController(timeout);

    const system = `You are a tool that generates git commit messages. Your task is to combine multiple commit messages into one.
Input: Several commit messages separated by newlines.
Output: A single commit message starting with type like 'feat:' or 'fix:'.

Do not add thanks, explanations, or any text outside the commit message. Respond with JSON: {"title": "combined commit message"}.`;

    const result = await generateText({
      model: provider(model),
      output: Output.object({ schema: titleSchema }),
      system,
      prompt: messages.join("\n"),
      temperature: 0.4,
      maxRetries: 2,
      reasoning: "none",
      abortSignal: controller.signal,
    });

    clearTimeout(timeoutId);
    let combinedMessage = result.output.title;

    if (combinedMessage.length > maxLength) {
      try {
        combinedMessage = await shortenCommitMessage(
          provider,
          model,
          combinedMessage,
          maxLength,
          timeout,
        );
      } catch {
        // If shortening fails, keep the original
      }
    }

    return { messages: [combinedMessage], usage: result.usage };
  } catch (error) {
    handleGenerateError(error, model, timeout);
  }
};

// Shared error handler for generation functions
function handleGenerateError(error: unknown, model: string, timeout: number): never {
  if (
    AbortSignal.prototype.aborted &&
    error instanceof DOMException &&
    error.name === "AbortError"
  ) {
    throw new KnownError(
      "Request timed out after " +
        timeout / 1000 +
        " seconds. The API took too long to respond. Try again or use a different model.",
    );
  }

  if (APICallError.isInstance(error)) {
    if (error.statusCode === 429) {
      const resetHeader = error.responseHeaders?.["x-ratelimit-reset"];
      let rateLimitMessage = "Rate limit exceeded";
      if (resetHeader) {
        const waitSec = Math.ceil((parseInt(resetHeader) * 1000 - Date.now()) / 1000);
        if (waitSec > 0) {
          const timeStr =
            waitSec < 60
              ? `${waitSec}s`
              : waitSec < 3600
                ? `${Math.ceil(waitSec / 60)}m`
                : `${Math.ceil(waitSec / 3600)}h`;
          rateLimitMessage += `. Retry in ${timeStr}.`;
        }
      }
      throw new KnownError(rateLimitMessage);
    }
    throw new KnownError(
      "Provider failed to process your request. Try running the command again, or switch to a different model with `aicommits model`.",
    );
  }

  if (NoSuchModelError.isInstance(error)) {
    const err = new KnownError(`Model "${model}" is not available or has been deprecated.`);
    (err as any).isModelDeprecated = true;
    throw err;
  }

  throw error;
}
