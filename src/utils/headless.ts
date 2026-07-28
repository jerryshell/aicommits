export const isHeadless = () => !process.stdin.isTTY || !process.stdout.isTTY;

export const isInteractive = () =>
  Boolean(process.stdin.isTTY && process.stdout.isTTY && !process.env.CI);
