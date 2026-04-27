#!/usr/bin/env node

// Meridian Harness — Integration test suite
// Run: node test/test-harness.mjs

import { execSync } from "child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HARNESS = resolve(__dirname, "..", "bin", "meridian-harness.mjs");
const DIR = `.test-harness-${process.pid}`;
const PLAN_FILE = join(DIR, "test-plan.json");

let pass = 0;
let fail = 0;

function cleanup() {
  try { rmSync(DIR, { recursive: true, force: true }); } catch {}
}

function run(args) {
  const out = execSync(`node "${HARNESS}" ${args}`, { encoding: "utf-8", cwd: resolve(__dirname, "..") });
  return JSON.parse(out.trim());
}

function quote(s) {
  // Escape for PowerShell/cmd shell argument passing
  return `"${s.replace(/"/g, '\\"')}"`;
}

function assert(desc, actual, key, expected) {
  // Support nested keys like "test.detected"
  const val = key.split(".").reduce((o, k) => o?.[k], actual);
  if (String(val) === String(expected)) {
    console.log(`  ✅ ${desc}`);
    pass++;
  } else {
    console.log(`  ❌ ${desc} (expected ${key}=${expected}, got ${val})`);
    fail++;
  }
}

// Setup
process.on("exit", cleanup);

console.log("=== Meridian Harness Tests ===\n");

// --- State ---
console.log("--- State Management ---");
let r = run(`init --dir ${DIR}`);
assert("init creates dir", r, "created", "true");

r = run(`init --dir ${DIR}`);
assert("init is idempotent", r, "created", "false");

// Create plan file
mkdirSync(DIR, { recursive: true });
writeFileSync(PLAN_FILE, JSON.stringify({
  tasks: [
    { id: "T1", title: "Setup", description: "Init project", acceptance_criteria: ["dir exists"], dependencies: [] },
    { id: "T2", title: "Build", description: "Write code", acceptance_criteria: ["tests pass"], dependencies: ["T1"] },
  ]
}));

r = run(`plan-set --plan ${PLAN_FILE} --dir ${DIR}`);
assert("plan-set stores tasks", r, "taskCount", "2");

r = run(`task-list --dir ${DIR}`);
assert("task-list returns 2 tasks", { len: r.length }, "len", "2");

r = run(`task-status --task T1 --dir ${DIR}`);
assert("task-status returns pending", r, "status", "pending");

r = run(`task-complete --task T1 --summary "Done" --dir ${DIR}`);
assert("task-complete marks done", r, "completed", "true");

r = run(`task-status --task T1 --dir ${DIR}`);
assert("task-status shows done", r, "status", "done");

// --- Memory ---
console.log("\n--- Memory Management ---");
r = run(`memory-read --file project_brief --dir ${DIR}`);
assert("memory-read returns file", r, "file", "project_brief");
assert("memory-read has content", { ok: r.content != null }, "ok", "true");

r = run(`memory-update --file project_brief --content "# Test" --dir ${DIR}`);
assert("memory-update replaces", r, "updated", "true");

r = run(`memory-read --file project_brief --dir ${DIR}`);
assert("memory-read shows updated content", { ok: r.content.includes("# Test") }, "ok", "true");

r = run(`memory-update --file completed_tasks --append "\\nT1 done" --dir ${DIR}`);
assert("memory-update appends", r, "updated", "true");

r = run(`memory-read-all --dir ${DIR}`);
assert("memory-read-all returns all files", { ok: r.project_brief != null && r.architecture != null }, "ok", "true");

// --- Decisions ---
console.log("\n--- Decisions ---");
r = run(`decision-add --id D1 --question "DB?" --options "[{\\"id\\":\\"A\\",\\"choice\\":\\"SQLite\\",\\"recommendation\\":true}]" --severity irreversible --dir ${DIR}`);
assert("decision-add works", r, "added", "true");

r = run(`decision-pending --dir ${DIR}`);
assert("decision-pending shows 1", r, "count", "1");

r = run(`report-due --dir ${DIR}`);
assert("report-due detects irreversible", r, "due", "true");
assert("report-due immediate for irreversible", r, "immediate", "true");

r = run(`report-format --dir ${DIR}`);
assert("report-format has report", { ok: r.report.includes("Decision") }, "ok", "true");

r = run(`decision-resolve --id D1 --choice A --dir ${DIR}`);
assert("decision-resolve works", r, "resolved", "true");

r = run(`report-due --dir ${DIR}`);
assert("report-due false after resolve", r, "due", "false");

// --- Iterations & Escalation Ladder ---
console.log("\n--- Iterations & Escalation ---");
r = run(`iteration-record --task T2 --verdict FAIL --findings "bug" --strategy retry --dir ${DIR}`);
assert("iteration-record works", r, "recorded", "true");
assert("iteration-record attempt=1", r, "attempt", "1");
assert("attempt 1 → action: retry", r, "action", "retry");

r = run(`iteration-count --task T2 --dir ${DIR}`);
assert("iteration-count shows 1", r, "attempts", "1");

// Attempts 2-3: still retry
run(`iteration-record --task T2 --verdict FAIL --findings "bug2" --strategy retry --dir ${DIR}`);
r = run(`iteration-record --task T2 --verdict FAIL --findings "bug3" --strategy retry --dir ${DIR}`);
assert("attempt 3 → action: rethink", r, "action", "rethink");

// Attempt 4: rethink strategy
r = run(`iteration-record --task T2 --verdict FAIL --findings "still fails" --strategy rethink --dir ${DIR}`);
assert("after rethink → action: split", r, "action", "split");

// Attempt 5: split strategy
r = run(`iteration-record --task T2 --verdict FAIL --findings "split failed" --strategy split --dir ${DIR}`);
assert("after split → action: skip_and_revisit", r, "action", "skip_and_revisit");

// Attempt 6: skip_and_revisit strategy
r = run(`iteration-record --task T2 --verdict FAIL --findings "still stuck" --strategy skip_and_revisit --dir ${DIR}`);
assert("all exhausted → action: escalate", r, "action", "escalate");

// --- Checkpoint ---
console.log("\n--- Checkpoint ---");
r = run(`checkpoint-due --dir ${DIR}`);
assert("checkpoint-due false (1 task done)", r, "due", "false");

// --- Task Backtracking (Layer 2) ---
console.log("\n--- Task Backtracking ---");

// Setup: complete T2 so we can test reopening
run(`task-complete --task T2 --summary "Built it" --dir ${DIR}`);
r = run(`task-status --task T2 --dir ${DIR}`);
assert("T2 is done before reopen", r, "status", "done");

// Add a dependent task T3 that depends on T2 and is done
const adjAdd = JSON.stringify([{action:"add",task:{id:"T3",title:"Depends on T2",description:"d",acceptance_criteria:["ok"],dependencies:["T2"]}}]);
run(`plan-adjust --adjustments ${quote(adjAdd)} --dir ${DIR}`);
run(`task-complete --task T3 --summary "Built on T2" --dir ${DIR}`);

// Reopen T2 — should cascade reverify to T3
r = run(`task-reopen --task T2 --reason "API conflict" --dir ${DIR}`);
assert("task-reopen works", r, "reopened", "true");
assert("T3 affected by reopen", { ok: r.affected_tasks.includes("T3") }, "ok", "true");

r = run(`task-status --task T2 --dir ${DIR}`);
assert("T2 back to pending", r, "status", "pending");

r = run(`task-status --task T3 --dir ${DIR}`);
assert("T3 marked reverify", r, "status", "reverify");

// --- Plan Adjustment (Layer 3) ---
console.log("\n--- Plan Adjustment ---");

// Add a new task
const adjAdd2 = JSON.stringify([{action:"add",task:{id:"T4",title:"New feature",description:"d",acceptance_criteria:["ok"],dependencies:["T2"]}}]);
r = run(`plan-adjust --adjustments ${quote(adjAdd2)} --dir ${DIR}`);
assert("plan-adjust add works", r, "adjusted", "true");

r = run(`task-status --task T4 --dir ${DIR}`);
assert("T4 exists and pending", r, "status", "pending");

// Update a task
const adjUpdate = JSON.stringify([{action:"update",id:"T4",fields:{title:"Updated feature",description:"new desc"}}]);
r = run(`plan-adjust --adjustments ${quote(adjUpdate)} --dir ${DIR}`);
assert("plan-adjust update works", r, "adjusted", "true");

// Remove a pending task
const adjRemove = JSON.stringify([{action:"remove",id:"T4"}]);
r = run(`plan-adjust --adjustments ${quote(adjRemove)} --dir ${DIR}`);
assert("plan-adjust remove works", r, "adjusted", "true");

r = run(`task-status --task T4 --dir ${DIR}`);
assert("T4 removed", r, "found", "false");

// --- Detect Tools ---
console.log("\n--- Verification ---");
r = run(`detect-tools --dir ${DIR}`);
assert("detect-tools finds npm test", r, "test.detected", "true");

// --- Summary ---
console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
