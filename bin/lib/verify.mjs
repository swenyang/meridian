// Mechanical verification — deterministic pass/fail judgments.
// The verifier auto-detects available tools and runs them.
// Its verdicts override LLM opinions.

import { execSync } from "child_process";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "fs";
import { resolve, join } from "path";

const CHECK_TIMEOUT_MS = 60_000;
const OUTPUT_TAIL_CHARS = 2000;

/**
 * Auto-detect available verification tools in the project directory.
 */
export function detect(projectDir) {
  const result = {
    test: { detected: false },
    lint: { detected: false },
    build: { detected: false },
    typecheck: { detected: false },
  };

  const pkg = readJsonSafe(join(projectDir, "package.json"));
  const pyprojectRaw = readFileSafe(join(projectDir, "pyproject.toml"));
  const makefileRaw = readFileSafe(join(projectDir, "Makefile"));

  // --- Tests ---
  if (pkg?.scripts?.test) {
    result.test = { detected: true, command: "npm test", source: "package.json scripts.test" };
  } else if (existsSync(join(projectDir, "pytest.ini")) || pyprojectRaw?.includes("[tool.pytest")) {
    const src = existsSync(join(projectDir, "pytest.ini")) ? "pytest.ini" : "pyproject.toml [tool.pytest]";
    result.test = { detected: true, command: "pytest", source: src };
  } else if (makefileRaw && hasTarget(makefileRaw, "test")) {
    result.test = { detected: true, command: "make test", source: "Makefile test target" };
  }

  // --- Lint ---
  if (hasGlob(projectDir, ".eslintrc")) {
    result.lint = { detected: true, command: "npx eslint .", source: ".eslintrc*" };
  } else if (hasGlob(projectDir, ".prettierrc")) {
    result.lint = { detected: true, command: "npx prettier --check .", source: ".prettierrc*" };
  } else if (pyprojectRaw?.includes("[tool.ruff]")) {
    result.lint = { detected: true, command: "ruff check .", source: "pyproject.toml [tool.ruff]" };
  } else if (pyprojectRaw?.includes("[tool.flake8]")) {
    result.lint = { detected: true, command: "flake8 .", source: "pyproject.toml [tool.flake8]" };
  } else if (makefileRaw && hasTarget(makefileRaw, "lint")) {
    result.lint = { detected: true, command: "make lint", source: "Makefile lint target" };
  }

  // --- Build ---
  if (pkg?.scripts?.build) {
    result.build = { detected: true, command: "npm run build", source: "package.json scripts.build" };
  } else if (makefileRaw && hasTarget(makefileRaw, "build")) {
    result.build = { detected: true, command: "make build", source: "Makefile build target" };
  } else if (pyprojectRaw?.includes("[build-system]")) {
    result.build = { detected: true, command: "python -m build", source: "pyproject.toml [build-system]" };
  }

  // --- TypeCheck ---
  if (existsSync(join(projectDir, "tsconfig.json"))) {
    result.typecheck = { detected: true, command: "npx tsc --noEmit", source: "tsconfig.json" };
  }

  return result;
}

/**
 * Run a single verification check.
 */
export function runCheck(projectDir, checkName, command) {
  const start = Date.now();
  try {
    const stdout = execSync(command, {
      cwd: projectDir,
      timeout: CHECK_TIMEOUT_MS,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
    const duration_ms = Date.now() - start;
    return {
      check: checkName,
      pass: true,
      exitCode: 0,
      output: tail(stdout, OUTPUT_TAIL_CHARS),
      duration_ms,
    };
  } catch (err) {
    const duration_ms = Date.now() - start;
    if (err.killed) {
      return {
        check: checkName,
        pass: false,
        exitCode: null,
        output: `TIMEOUT after ${CHECK_TIMEOUT_MS / 1000}s`,
        duration_ms: CHECK_TIMEOUT_MS,
      };
    }
    const combined = [err.stdout, err.stderr].filter(Boolean).join("\n");
    return {
      check: checkName,
      pass: false,
      exitCode: err.status ?? 1,
      output: tail(combined, OUTPUT_TAIL_CHARS),
      duration_ms,
    };
  }
}

/**
 * Run all detected checks and produce a verdict.
 */
export function verify(projectDir, meridianDir) {
  const detected = detect(projectDir);
  const checks = {};
  let ran = 0;
  let passed = 0;
  let skipped = 0;

  for (const [name, info] of Object.entries(detected)) {
    if (!info.detected) {
      checks[name] = { skipped: true, reason: "not detected" };
      skipped++;
      continue;
    }
    const result = runCheck(projectDir, name, info.command);
    checks[name] = { pass: result.pass, exitCode: result.exitCode, output: result.output, duration_ms: result.duration_ms };
    ran++;
    if (result.pass) passed++;
  }

  // Evidence: check for changed files via git
  const evidence = getEvidence(projectDir);
  checks.evidence = evidence;

  // Eval targets: if plan defines eval_command + eval_targets, run eval and compare
  const evalResult = runEvalCheck(projectDir, meridianDir);
  if (evalResult) {
    checks.eval = evalResult;
    ran++;
    if (evalResult.pass) passed++;
  }

  const allPassed = passed === ran;
  const hasEvidence = evidence.pass;

  let verdict;
  if (ran === 0) {
    verdict = "PASS";
  } else {
    verdict = allPassed && hasEvidence ? "PASS" : "FAIL";
  }

  const parts = [];
  parts.push(`${passed}/${ran} checks passed`);
  if (skipped > 0) parts.push(`${skipped} skipped`);
  parts.push(`${evidence.files_changed} files changed`);
  if (evalResult && !evalResult.pass) {
    parts.push(`EVAL FAILED: ${evalResult.failures.join(", ")}`);
  }
  let summary = parts.join(", ");
  if (ran === 0) summary = "WARNING: no checks detected. " + summary;

  const verdictResult = { verdict, checks, summary };

  // Save verdict to evidence dir if task dir exists
  saveVerdict(meridianDir, verdictResult);

  return verdictResult;
}

// --- helpers ---

/**
 * Run eval check if plan defines eval_command + eval_targets.
 * Looks for .meridian/eval_config.json:
 * {
 *   "eval_command": "npm run eval -- --json",
 *   "targets": {
 *     "table_detection": { "metric": "table_detection_f1", "min": 0.85 },
 *     "header_accuracy": { "metric": "header_accuracy", "min": 0.85 },
 *     "field_accuracy": { "metric": "field_accuracy", "min": 0.85 }
 *   }
 * }
 */
function runEvalCheck(projectDir, meridianDir) {
  const configPath = join(meridianDir, "eval_config.json");
  if (!existsSync(configPath)) return null;

  let config;
  try {
    config = JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    return { pass: false, error: "eval_config.json is invalid JSON", failures: ["config parse error"] };
  }

  if (!config.eval_command || !config.targets) return null;

  // Run the eval command
  const result = runCheck(projectDir, "eval", config.eval_command);
  if (!result.pass) {
    return { pass: false, error: "eval command failed", exitCode: result.exitCode, output: result.output, failures: ["eval command exited non-zero"] };
  }

  // Try to parse metrics from JSON output
  let metrics;
  try {
    // Find JSON in output (might have non-JSON lines before/after)
    const jsonMatch = result.output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      metrics = JSON.parse(jsonMatch[0]);
    }
  } catch {
    return { pass: false, error: "could not parse eval output as JSON", output: result.output, failures: ["eval output not parseable"] };
  }

  if (!metrics) {
    return { pass: false, error: "no JSON metrics in eval output", output: result.output, failures: ["no metrics found"] };
  }

  // Compare each target
  const failures = [];
  const results = {};
  for (const [name, target] of Object.entries(config.targets)) {
    const actual = metrics[target.metric];
    if (actual == null) {
      failures.push(`${name}: metric '${target.metric}' not found in eval output`);
      results[name] = { target: target.min, actual: null, pass: false };
    } else if (actual < target.min) {
      failures.push(`${name}: ${actual} < ${target.min} (target)`);
      results[name] = { target: target.min, actual, pass: false };
    } else {
      results[name] = { target: target.min, actual, pass: true };
    }
  }

  return {
    pass: failures.length === 0,
    results,
    failures,
    output: tail(result.output, OUTPUT_TAIL_CHARS),
  };
}

function readFileSafe(filePath) {
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function readJsonSafe(filePath) {
  const raw = readFileSafe(filePath);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function hasTarget(makefileContent, target) {
  // Match lines like "test:" or "test :" at the start of a line
  const regex = new RegExp(`^${target}\\s*:`, "m");
  return regex.test(makefileContent);
}

function hasGlob(dir, prefix) {
  // Check for common config file patterns
  const suffixes = ["", ".js", ".cjs", ".mjs", ".json", ".yml", ".yaml"];
  return suffixes.some((s) => existsSync(join(dir, prefix + s)));
}

function tail(str, maxChars) {
  if (!str) return "";
  if (str.length <= maxChars) return str;
  return str.slice(-maxChars);
}

function getEvidence(projectDir) {
  try {
    const output = execSync("git diff --name-only HEAD", {
      cwd: projectDir,
      encoding: "utf-8",
      timeout: 10_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const files = output.trim().split("\n").filter(Boolean);
    return { pass: files.length > 0, files_changed: files.length };
  } catch {
    // Not a git repo or no commits — check for untracked files
    try {
      const output = execSync("git status --porcelain", {
        cwd: projectDir,
        encoding: "utf-8",
        timeout: 10_000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      const files = output.trim().split("\n").filter(Boolean);
      return { pass: files.length > 0, files_changed: files.length };
    } catch {
      return { pass: false, files_changed: 0 };
    }
  }
}

function saveVerdict(meridianDir, verdictResult) {
  try {
    // Find current task from state
    const statePath = join(meridianDir, "state.json");
    if (!existsSync(statePath)) return;
    const state = readJsonSafe(statePath);
    const currentTask = state?.currentTask;
    if (!currentTask) return;
    const evidenceDir = join(meridianDir, "tasks", currentTask, "evidence");
    if (!existsSync(join(meridianDir, "tasks", currentTask))) return;
    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(join(evidenceDir, "verdict.json"), JSON.stringify(verdictResult, null, 2));
  } catch {
    // Best-effort save
  }
}
