#!/usr/bin/env node

// Meridian Harness — Mechanical verification, state management, memory, decisions, iterations.
// All commands output JSON to stdout. Errors go to stderr. Exit 0 on success, 1 on usage error.

import { resolve, dirname } from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const VERSION = "0.1.0";

function resolveDir(dirFlag) {
  if (!dirFlag) {
    console.error("Error: --dir <path> is required");
    process.exit(1);
  }
  const dir = resolve(dirFlag);
  return dir;
}

function parseArgs(args) {
  const command = args[0];
  const flags = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true;
      flags[key] = val;
      if (val !== true) i++;
    }
  }
  return { command, flags };
}

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  console.log(`Meridian Harness v${VERSION}

Usage: meridian-harness <command> [flags]

State Commands:
  init --dir <path>                          Initialize .meridian/ directory
  plan-set --plan <file> --dir <path>        Store task plan
  run-status --dir <path>                    Check current run status
  run-complete --dir <path>                  Mark current run as completed
  task-list --dir <path>                     List all tasks
  task-status --task <id> --dir <path>       Query task status
  task-complete --task <id> --summary <text> --dir <path>  Mark task complete
  task-reopen --task <id> --reason <text> --dir <path>   Reopen task + cascade reverify
  plan-adjust --adjustments <json> --dir <path>          Add/remove/update tasks

Verification:
  detect-tools --dir <path>                  Detect available verification tools
  verify --dir <path>                        Run mechanical verification
  eval-config --command <cmd> --targets <json> --dir <path>  Set eval targets

Memory:
  memory-read --file <name> --dir <path>     Read a memory file
  memory-read-all --dir <path>               Read all memory files
  memory-update --file <name> [--append <text>|--content <text>] --dir <path>
  memory-resolve-issue --issue <text> --dir <path>  Mark an issue as resolved

Decisions:
  decision-add --id <id> --question <text> --options <json> --severity <level> --dir <path>
  decision-pending --dir <path>              List pending decisions
  decision-resolve --id <id> --choice <val> --dir <path>

Iterations:
  iteration-count --task <id> --dir <path>   Query iteration count
  iteration-record --task <id> --verdict <V> --findings <text> [--strategy <s>] --dir <path>

Checkpoints & Reports:
  checkpoint-due --dir <path>                Check if checkpoint is needed
  report-due --dir <path>                    Check if decision report is needed
  report-format --dir <path>                 Format decision report for terminal
`);
  process.exit(0);
}

const { command, flags } = parseArgs(args);

switch (command) {
  case "version":
  case "--version":
  case "-v":
    console.log(VERSION);
    break;

  case "init": {
    const { init } = await import("./lib/state.mjs");
    const result = init(resolveDir(flags.dir));
    console.log(JSON.stringify(result));
    break;
  }

  case "plan-set": {
    if (!flags.plan) { console.error("Error: --plan <file> is required"); process.exit(1); }
    const { planSet } = await import("./lib/state.mjs");
    const result = planSet(resolveDir(flags.dir), resolve(flags.plan));
    console.log(JSON.stringify(result));
    break;
  }

  case "run-status": {
    const { runStatus } = await import("./lib/state.mjs");
    const result = runStatus(resolveDir(flags.dir));
    console.log(JSON.stringify(result));
    break;
  }

  case "run-complete": {
    const { runComplete } = await import("./lib/state.mjs");
    const result = runComplete(resolveDir(flags.dir));
    console.log(JSON.stringify(result));
    break;
  }

  case "task-status": {
    if (!flags.task) { console.error("Error: --task <id> is required"); process.exit(1); }
    const { taskStatus } = await import("./lib/state.mjs");
    const result = taskStatus(resolveDir(flags.dir), flags.task);
    console.log(JSON.stringify(result));
    break;
  }

  case "task-complete": {
    if (!flags.task) { console.error("Error: --task <id> is required"); process.exit(1); }
    const { taskComplete } = await import("./lib/state.mjs");
    const result = taskComplete(resolveDir(flags.dir), flags.task, flags.summary || "");
    console.log(JSON.stringify(result));
    break;
  }

  case "task-list": {
    const { taskList } = await import("./lib/state.mjs");
    const result = taskList(resolveDir(flags.dir));
    console.log(JSON.stringify(result));
    break;
  }

  case "task-reopen": {
    if (!flags.task || !flags.reason) { console.error("Error: --task, --reason required"); process.exit(1); }
    const { taskReopen } = await import("./lib/state.mjs");
    const result = taskReopen(resolveDir(flags.dir), flags.task, flags.reason);
    console.log(JSON.stringify(result));
    break;
  }

  case "plan-adjust": {
    if (!flags.adjustments) { console.error("Error: --adjustments <json> required"); process.exit(1); }
    const { planAdjust } = await import("./lib/state.mjs");
    const result = planAdjust(resolveDir(flags.dir), JSON.parse(flags.adjustments));
    console.log(JSON.stringify(result));
    break;
  }

  case "memory-read": {
    const { memoryRead } = await import("./lib/memory.mjs");
    const result = memoryRead(resolveDir(flags.dir), flags.file);
    console.log(JSON.stringify(result));
    break;
  }

  case "memory-update": {
    const { memoryUpdate } = await import("./lib/memory.mjs");
    const options = {};
    if (flags.append) options.append = flags.append;
    if (flags.content) options.content = flags.content;
    const result = memoryUpdate(resolveDir(flags.dir), flags.file, options);
    console.log(JSON.stringify(result));
    break;
  }

  case "memory-read-all": {
    const { memoryReadAll } = await import("./lib/memory.mjs");
    const result = memoryReadAll(resolveDir(flags.dir));
    console.log(JSON.stringify(result));
    break;
  }

  case "memory-resolve-issue": {
    const { memoryResolveIssue } = await import("./lib/memory.mjs");
    const result = memoryResolveIssue(resolveDir(flags.dir), flags.issue);
    console.log(JSON.stringify(result));
    break;
  }

  case "verify": {
    const { verify } = await import("./lib/verify.mjs");
    const dir = resolveDir(flags.dir);
    const projectDir = resolve(dir, "..");
    const result = verify(projectDir, dir);
    console.log(JSON.stringify(result));
    break;
  }

  case "detect-tools": {
    const { detect } = await import("./lib/verify.mjs");
    const dir = resolveDir(flags.dir);
    const projectDir = resolve(dir, "..");
    const result = detect(projectDir);
    console.log(JSON.stringify(result));
    break;
  }

  case "eval-config": {
    if (!flags.command || !flags.targets) { console.error("Error: --command, --targets (JSON) required"); process.exit(1); }
    const dir = resolveDir(flags.dir);
    const config = { eval_command: flags.command, targets: JSON.parse(flags.targets) };
    const { writeFileSync } = await import("fs");
    const { join } = await import("path");
    writeFileSync(join(dir, "eval_config.json"), JSON.stringify(config, null, 2), "utf8");
    console.log(JSON.stringify({ created: true, targets: Object.keys(config.targets) }));
    break;
  }

  case "decision-add": {
    const { decisionAdd } = await import("./lib/decisions.mjs");
    if (!flags.id || !flags.question || !flags.options || !flags.severity) {
      console.error("Error: --id, --question, --options (JSON), --severity required"); process.exit(1);
    }
    const result = decisionAdd(resolveDir(flags.dir), {
      id: flags.id, question: flags.question,
      options: JSON.parse(flags.options), severity: flags.severity,
      blockingTasks: flags.blocking ? flags.blocking.split(",") : [],
    });
    console.log(JSON.stringify(result));
    break;
  }

  case "decision-pending": {
    const { decisionPending } = await import("./lib/decisions.mjs");
    console.log(JSON.stringify(decisionPending(resolveDir(flags.dir))));
    break;
  }

  case "decision-resolve": {
    const { decisionResolve } = await import("./lib/decisions.mjs");
    if (!flags.id || !flags.choice) { console.error("Error: --id, --choice required"); process.exit(1); }
    console.log(JSON.stringify(decisionResolve(resolveDir(flags.dir), flags.id, flags.choice)));
    break;
  }

  case "report-due": {
    const { reportDue } = await import("./lib/decisions.mjs");
    console.log(JSON.stringify(reportDue(resolveDir(flags.dir))));
    break;
  }

  case "report-format": {
    const { reportFormat } = await import("./lib/decisions.mjs");
    console.log(JSON.stringify(reportFormat(resolveDir(flags.dir))));
    break;
  }

  case "iteration-count": {
    const { iterationCount } = await import("./lib/iterations.mjs");
    if (!flags.task) { console.error("Error: --task required"); process.exit(1); }
    console.log(JSON.stringify(iterationCount(resolveDir(flags.dir), flags.task)));
    break;
  }

  case "iteration-record": {
    const { iterationRecord } = await import("./lib/iterations.mjs");
    if (!flags.task || !flags.verdict) { console.error("Error: --task, --verdict required"); process.exit(1); }
    if (!flags.strategy) { console.error("Error: --strategy required (retry|rethink|split|skip_and_revisit)"); process.exit(1); }
    console.log(JSON.stringify(iterationRecord(resolveDir(flags.dir), flags.task, flags.verdict, flags.findings || "", flags.strategy)));
    break;
  }

  case "checkpoint-due": {
    const { checkpointDue } = await import("./lib/iterations.mjs");
    console.log(JSON.stringify(checkpointDue(resolveDir(flags.dir))));
    break;
  }

  default:
    console.error(`Unknown command: ${command}`);
    console.error('Run "meridian-harness --help" for usage.');
    process.exit(1);
}
