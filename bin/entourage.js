#!/usr/bin/env node

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { execSync, spawn } = require("child_process");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs");

const args = process.argv.slice(2);

const getArgValue = (longFlag, shortFlag) => {
  const longIdx = args.indexOf(longFlag);
  if (longIdx !== -1 && args[longIdx + 1]) {
    return args[longIdx + 1];
  }

  const shortIdx = args.indexOf(shortFlag);
  if (shortIdx !== -1 && args[shortIdx + 1]) {
    return args[shortIdx + 1];
  }

  return undefined;
};

const port = Number.parseInt(getArgValue("--port", "-p") ?? "5555", 10);
const host = getArgValue("--host", "-H") ?? "localhost";

const packageDir = path.resolve(__dirname, "..");

// Check if .next build exists; if not, build first
const dotNextDir = path.join(packageDir, ".next");
if (!fs.existsSync(dotNextDir)) {
  console.log("Building Entourage (first run)...");
  execSync("npx next build", { cwd: packageDir, stdio: "inherit" });
}

console.log(`Starting Entourage on http://${host}:${port}`);

const child = spawn("npx", ["next", "start", "-p", String(port), "-H", host], {
  cwd: packageDir,
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

// Forward signals
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    child.kill(sig);
  });
}
