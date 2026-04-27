// Memory management — markdown-based project memory files (zero-dependency, Node 18+).

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const MEMORY_DIR = "memory";
const VALID_FILES = [
  "project_brief",
  "decisions_log",
  "architecture",
  "completed_tasks",
  "active_issues",
];

const COMPLETED_TASKS_MAX = 30000;
const COMPLETED_TASKS_KEEP = 20000;

function memoryPath(dir, fileName) {
  return join(dir, MEMORY_DIR, `${fileName}.md`);
}

function validateFileName(fileName) {
  if (!VALID_FILES.includes(fileName)) {
    throw new Error(
      `Invalid memory file: '${fileName}'. Valid: ${VALID_FILES.join(", ")}`
    );
  }
}

/**
 * Read a single memory file.
 */
export function memoryRead(dir, fileName) {
  validateFileName(fileName);
  const filePath = memoryPath(dir, fileName);

  if (!existsSync(filePath)) {
    return { file: fileName, content: null, error: "not found" };
  }

  const content = readFileSync(filePath, "utf8");
  return { file: fileName, content };
}

/**
 * Update a memory file via append or full replacement.
 * Truncates completed_tasks.md when it exceeds the character limit.
 */
export function memoryUpdate(dir, fileName, options = {}) {
  validateFileName(fileName);
  const filePath = memoryPath(dir, fileName);

  if (options.content != null) {
    writeFileSync(filePath, options.content, "utf8");
  } else if (options.append != null) {
    const existing = existsSync(filePath)
      ? readFileSync(filePath, "utf8")
      : "";
    writeFileSync(filePath, existing + options.append, "utf8");
  }

  let truncated = false;

  if (fileName === "completed_tasks") {
    const current = readFileSync(filePath, "utf8");
    if (current.length > COMPLETED_TASKS_MAX) {
      const tail = current.slice(current.length - COMPLETED_TASKS_KEEP);
      const trimmed = "# Completed Tasks\n\n" + tail.trimStart();
      writeFileSync(filePath, trimmed, "utf8");
      truncated = true;
    }
  }

  return { updated: true, file: fileName, truncated };
}

/**
 * Read all memory files at once.
 */
export function memoryReadAll(dir) {
  const result = {};
  for (const name of VALID_FILES) {
    const filePath = memoryPath(dir, name);
    result[name] = existsSync(filePath)
      ? readFileSync(filePath, "utf8")
      : null;
  }
  return result;
}

/**
 * Mark an issue as resolved in active_issues.md via strikethrough.
 */
export function memoryResolveIssue(dir, issueDescription) {
  const filePath = memoryPath(dir, "active_issues");

  if (!existsSync(filePath)) {
    return { resolved: false, reason: "not found" };
  }

  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  let found = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(issueDescription)) {
      lines[i] = `~~${lines[i]}~~ [RESOLVED]`;
      found = true;
      break;
    }
  }

  if (!found) {
    return { resolved: false, reason: "not found" };
  }

  writeFileSync(filePath, lines.join("\n"), "utf8");
  return { resolved: true };
}
