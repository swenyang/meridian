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
assert("init mode is new", r, "mode", "new");

r = run(`init --dir ${DIR}`);
assert("init detects active run", r, "mode", "active");

// Run status
r = run(`run-status --dir ${DIR}`);
assert("run-status exists", r, "exists", "true");
assert("run-status active", r, "status", "active");

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

// task-complete without verdict should FAIL
let threw = false;
try { run(`task-complete --task T1 --summary "Done" --dir ${DIR}`); } catch { threw = true; }
assert("task-complete blocked without verdict", { threw }, "threw", "true");

// Submit a PASS verdict
const passVerdict = JSON.stringify({result:"PASS",baseline_harness:{verdict:"PASS"},acceptance_verification:{pass:true,criteria_results:[{criterion:"dir exists",met:true,evidence:"verified"}]}});
r = run(`task-submit-verdict --task T1 --verdict ${quote(passVerdict)} --dir ${DIR}`);
assert("task-submit-verdict works", r, "submitted", "true");
assert("verdict result is PASS", r, "result", "PASS");

// Now task-complete should work
r = run(`task-complete --task T1 --summary "Done" --dir ${DIR}`);
assert("task-complete works after PASS verdict", r, "completed", "true");

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
run(`task-submit-verdict --task T2 --verdict ${quote(passVerdict)} --dir ${DIR}`);
run(`task-complete --task T2 --summary "Built it" --dir ${DIR}`);
r = run(`task-status --task T2 --dir ${DIR}`);
assert("T2 is done before reopen", r, "status", "done");

// Add a dependent task T3 that depends on T2 and is done
const adjAdd = JSON.stringify([{action:"add",task:{id:"T3",title:"Depends on T2",description:"d",acceptance_criteria:["ok"],dependencies:["T2"]}}]);
run(`plan-adjust --adjustments ${quote(adjAdd)} --dir ${DIR}`);
run(`task-submit-verdict --task T3 --verdict ${quote(passVerdict)} --dir ${DIR}`);
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

// --- Run Lifecycle ---
console.log("\n--- Run Lifecycle ---");

// Re-complete T2 and T3 (they were reopened/reverified in backtracking tests)
run(`task-submit-verdict --task T2 --verdict ${quote(passVerdict)} --dir ${DIR}`);
run(`task-complete --task T2 --summary "Rebuilt" --dir ${DIR}`);
run(`task-submit-verdict --task T3 --verdict ${quote(passVerdict)} --dir ${DIR}`);
run(`task-complete --task T3 --summary "Reverified" --dir ${DIR}`);

r = run(`run-complete --dir ${DIR}`);
assert("run-complete works", r, "completed", "true");

r = run(`run-status --dir ${DIR}`);
assert("run-status shows completed", r, "status", "completed");

// Init again should archive and create new run
r = run(`init --dir ${DIR}`);
assert("init after complete archives", r, "mode", "new_after_archive");
assert("init creates new run", r, "created", "true");

r = run(`run-status --dir ${DIR}`);
assert("new run is active", r, "status", "active");
assert("archived runs count", { ok: r.archived_runs > 0 }, "ok", "true");

// --- Structured Acceptance Criteria ---
console.log("\n--- Structured Acceptance Criteria ---");

// Legacy string criteria still work in plan-set (backward compat)
const legacyPlan = join(DIR, "test-legacy-plan.json");
writeFileSync(legacyPlan, JSON.stringify({
  tasks: [
    { id: "L1", title: "Legacy task", description: "Uses string criteria",
      acceptance_criteria: ["tests pass", "file exists"], dependencies: [] }
  ]
}));
r = run(`plan-set --plan ${legacyPlan} --dir ${DIR}`);
assert("legacy string criteria accepted", r, "stored", "true");
assert("legacy criteria produce warnings", { ok: r.warnings && r.warnings.length > 0 }, "ok", "true");

// --- Verdict Enforcement ---
console.log("\n--- Verdict Enforcement ---");

// Submit FAIL verdict — task-complete should be blocked
const failVerdict = JSON.stringify({result:"FAIL",baseline_harness:{verdict:"FAIL"},acceptance_verification:{pass:false,criteria_results:[{criterion:"tests pass",met:false,evidence:"test suite failed"}]}});
r = run(`task-submit-verdict --task L1 --verdict ${quote(failVerdict)} --dir ${DIR}`);
assert("submit FAIL verdict works", r, "submitted", "true");
assert("FAIL verdict recorded", r, "result", "FAIL");

threw = false;
try { run(`task-complete --task L1 --summary "Done" --dir ${DIR}`); } catch { threw = true; }
assert("task-complete blocked with FAIL verdict", { threw }, "threw", "true");

// Submit incomplete verdict (missing fields) — should be rejected
const badVerdict = JSON.stringify({result:"PASS"});
threw = false;
try { run(`task-submit-verdict --task L1 --verdict ${quote(badVerdict)} --dir ${DIR}`); } catch { threw = true; }
assert("verdict without evidence rejected", { threw }, "threw", "true");

// Submit verdict with blanket "all met" (empty criteria_results) — should be rejected
const blanketVerdict = JSON.stringify({result:"PASS",baseline_harness:{verdict:"PASS"},acceptance_verification:{pass:true,criteria_results:[]}});
threw = false;
try { run(`task-submit-verdict --task L1 --verdict ${quote(blanketVerdict)} --dir ${DIR}`); } catch { threw = true; }
assert("blanket verdict with empty criteria rejected", { threw }, "threw", "true");

// Submit PASS verdict with baseline FAIL — should be rejected
const contradictVerdict = JSON.stringify({result:"PASS",baseline_harness:{verdict:"FAIL"},acceptance_verification:{pass:true,criteria_results:[{criterion:"ok",met:true,evidence:"yes"}]}});
threw = false;
try { run(`task-submit-verdict --task L1 --verdict ${quote(contradictVerdict)} --dir ${DIR}`); } catch { threw = true; }
assert("PASS verdict with baseline FAIL rejected", { threw }, "threw", "true");

// Overwrite with valid PASS verdict — now task-complete should work
r = run(`task-submit-verdict --task L1 --verdict ${quote(passVerdict)} --dir ${DIR}`);
assert("overwrite to PASS verdict", r, "result", "PASS");
r = run(`task-complete --task L1 --summary "Done" --dir ${DIR}`);
assert("task-complete works after PASS overwrite", r, "completed", "true");

// --- E2E Verdict Evidence Gates ---
console.log("\n--- E2E Verdict Evidence Gates ---");

// Plan with e2e criteria — verdict must include verification_script + actual_output
const e2ePlan = join(DIR, "test-e2e-gate-plan.json");
writeFileSync(e2ePlan, JSON.stringify({
  tasks: [
    { id: "EG1", title: "E2E gate test", description: "Task with e2e criterion", kind: "core",
      acceptance_criteria: [
        { type: "mechanical", description: "File exists" },
        { type: "e2e", description: "Works end-to-end",
          scenario: "Run the tool", steps: ["node run.js"], expected: "Output correct" }
      ],
      dependencies: [] }
  ]
}));
run(`plan-set --plan ${e2ePlan} --dir ${DIR}`);

// e2e verdict WITHOUT verification_script — should be REJECTED
const noScriptVerdict = JSON.stringify({
  result: "PASS",
  baseline_harness: { verdict: "PASS" },
  acceptance_verification: {
    pass: true,
    criteria_results: [
      { criterion: "File exists", met: true, evidence: "yes" },
      { criterion: "Works end-to-end", type: "e2e", met: true }
    ]
  }
});
threw = false;
try { run(`task-submit-verdict --task EG1 --verdict ${quote(noScriptVerdict)} --dir ${DIR}`); } catch { threw = true; }
assert("e2e verdict without verification_script rejected", { threw }, "threw", "true");

// e2e verdict WITH verification_script but no actual_output — should be REJECTED
const noOutputVerdict = JSON.stringify({
  result: "PASS",
  baseline_harness: { verdict: "PASS" },
  acceptance_verification: {
    pass: true,
    criteria_results: [
      { criterion: "File exists", met: true, evidence: "yes" },
      { criterion: "Works end-to-end", type: "e2e", met: true, verification_script: ".meridian/verification/e2e.py" }
    ]
  }
});
threw = false;
try { run(`task-submit-verdict --task EG1 --verdict ${quote(noOutputVerdict)} --dir ${DIR}`); } catch { threw = true; }
assert("e2e verdict without actual_output rejected", { threw }, "threw", "true");

// e2e verdict WITH both — should PASS
const fullE2eVerdict = JSON.stringify({
  result: "PASS",
  baseline_harness: { verdict: "PASS" },
  acceptance_verification: {
    pass: true,
    criteria_results: [
      { criterion: "File exists", met: true, evidence: "yes" },
      { criterion: "Works end-to-end", type: "e2e", met: true,
        verification_script: ".meridian/verification/e2e.py",
        actual_output: "PASS: output matches expected" }
    ]
  }
});
r = run(`task-submit-verdict --task EG1 --verdict ${quote(fullE2eVerdict)} --dir ${DIR}`);
assert("e2e verdict with script+output accepted", r, "submitted", "true");

// baseline all-skipped produces warning
const allSkipVerdict = JSON.stringify({
  result: "PASS",
  baseline_harness: { verdict: "PASS", checks: { test: { skipped: true }, lint: { skipped: true }, build: { skipped: true }, evidence: { pass: true, files_changed: 5 } } },
  acceptance_verification: { pass: true, criteria_results: [{ criterion: "ok", met: true, evidence: "yes" }] }
});
r = run(`task-submit-verdict --task EG1 --verdict ${quote(allSkipVerdict)} --dir ${DIR}`);
assert("all-skipped baseline produces warning", { ok: r.warnings && r.warnings.length > 0 }, "ok", "true");

// Structured criteria work in plan-set
const structuredPlan = join(DIR, "test-structured-plan.json");
writeFileSync(structuredPlan, JSON.stringify({
  tasks: [
    { id: "S1", title: "Structured task", description: "Uses structured criteria", kind: "core",
      acceptance_criteria: [
        { type: "mechanical", description: "All tests pass", verify_command: "npm test" },
        { type: "e2e", description: "CLI works end-to-end",
          scenario: "User runs parse command",
          steps: ["Run: node cli.js parse input.xlsx"],
          expected: "JSON output with 3 tables" },
        { type: "real_data", description: "Handles SEC filing",
          data_source: "https://sec.gov/example",
          data_file: "eval/sec-10k.xlsx",
          expected: "Extracts 12-column table" }
      ],
      dependencies: [] }
  ]
}));
r = run(`plan-set --plan ${structuredPlan} --dir ${DIR}`);
assert("structured criteria accepted", r, "stored", "true");
assert("structured criteria no warnings", { ok: !r.warnings }, "ok", "true");

// Task kind is stored
r = run(`task-list --dir ${DIR}`);
const s1Task = r.find(t => t.id === "S1");
assert("kind field stored", { kind: s1Task?.kind }, "kind", "core");

// Invalid kind is rejected
const badKindPlan = join(DIR, "test-bad-kind-plan.json");
writeFileSync(badKindPlan, JSON.stringify({
  tasks: [
    { id: "BK1", title: "Bad kind", description: "d", kind: "banana",
      acceptance_criteria: ["ok"], dependencies: [] }
  ]
}));
threw = false;
try { run(`plan-set --plan ${badKindPlan} --dir ${DIR}`); } catch { threw = true; }
assert("invalid kind rejected by plan-set", { threw }, "threw", "true");

// Invalid structured criteria rejected (e2e missing required fields)
const badCriteriaPlan = join(DIR, "test-bad-criteria-plan.json");
writeFileSync(badCriteriaPlan, JSON.stringify({
  tasks: [
    { id: "BC1", title: "Bad criteria", description: "d",
      acceptance_criteria: [{ type: "e2e", description: "missing scenario" }],
      dependencies: [] }
  ]
}));
threw = false;
try { run(`plan-set --plan ${badCriteriaPlan} --dir ${DIR}`); } catch { threw = true; }
assert("malformed e2e criteria rejected", { threw }, "threw", "true");

// Invalid real_data criteria rejected (missing data_file/fetch_command)
const badRealDataPlan = join(DIR, "test-bad-realdata-plan.json");
writeFileSync(badRealDataPlan, JSON.stringify({
  tasks: [
    { id: "BR1", title: "Bad real_data", description: "d",
      acceptance_criteria: [{ type: "real_data", description: "no source", expected: "something" }],
      dependencies: [] }
  ]
}));
threw = false;
try { run(`plan-set --plan ${badRealDataPlan} --dir ${DIR}`); } catch { threw = true; }
assert("malformed real_data criteria rejected", { threw }, "threw", "true");

// plan-adjust with kind and structured criteria
const adjAddStructured = JSON.stringify([{action:"add",task:{
  id:"S2",title:"Feature task",description:"d",kind:"feature",
  acceptance_criteria:[
    {type:"integration",description:"API integration works",verify_command:"npm run test:integration"}
  ],
  dependencies:["S1"]
}}]);
r = run(`plan-adjust --adjustments ${quote(adjAddStructured)} --dir ${DIR}`);
assert("plan-adjust add with structured criteria", r, "adjusted", "true");

// plan-adjust update with kind change
const adjUpdateKind = JSON.stringify([{action:"update",id:"S2",fields:{kind:"core"}}]);
r = run(`plan-adjust --adjustments ${quote(adjUpdateKind)} --dir ${DIR}`);
assert("plan-adjust update kind", r, "adjusted", "true");

// plan-adjust rejects invalid kind on update
const adjBadKind = JSON.stringify([{action:"update",id:"S2",fields:{kind:"invalid"}}]);
threw = false;
try { run(`plan-adjust --adjustments ${quote(adjBadKind)} --dir ${DIR}`); } catch { threw = true; }
assert("plan-adjust rejects invalid kind update", { threw }, "threw", "true");

// --- Validate Plan Command ---
console.log("\n--- Validate Plan ---");

// Lenient mode: legacy strings produce warnings but valid=true
r = run(`validate-plan --plan ${legacyPlan} --dir ${DIR}`);
assert("validate-plan lenient accepts legacy", r, "valid", "true");
assert("validate-plan lenient has warnings", { ok: r.warnings && r.warnings.length > 0 }, "ok", "true");

// Lenient mode: structured plan valid with no warnings
r = run(`validate-plan --plan ${structuredPlan} --dir ${DIR}`);
assert("validate-plan lenient accepts structured", r, "valid", "true");

// Strict mode: legacy strings rejected
threw = false;
try { run(`validate-plan --plan ${legacyPlan} --dir ${DIR} --strict`); } catch { threw = true; }
assert("validate-plan strict rejects legacy strings", { threw }, "threw", "true");

// Strict mode: structured plan valid
r = run(`validate-plan --plan ${structuredPlan} --dir ${DIR} --strict`);
assert("validate-plan strict accepts structured", r, "valid", "true");

// Strict mode: feature task without e2e/integration rejected
const noE2EPlan = join(DIR, "test-no-e2e-plan.json");
writeFileSync(noE2EPlan, JSON.stringify({
  tasks: [
    { id: "NE1", title: "Feature without e2e", description: "d", kind: "feature",
      acceptance_criteria: [
        { type: "mechanical", description: "Tests pass" },
        { type: "unit", description: "Unit test" }
      ],
      dependencies: [] }
  ]
}));
threw = false;
try { run(`validate-plan --plan ${noE2EPlan} --dir ${DIR} --strict`); } catch { threw = true; }
assert("strict rejects feature without e2e/integration", { threw }, "threw", "true");

// Strict mode: scaffolding exempt from e2e requirement
const scaffoldingPlan = join(DIR, "test-scaffolding-plan.json");
writeFileSync(scaffoldingPlan, JSON.stringify({
  tasks: [
    { id: "SC1", title: "Project init", description: "scaffolding", kind: "scaffolding",
      acceptance_criteria: [
        { type: "mechanical", description: "Dir exists" }
      ],
      dependencies: [] }
  ]
}));
r = run(`validate-plan --plan ${scaffoldingPlan} --dir ${DIR} --strict`);
assert("strict allows scaffolding without e2e", r, "valid", "true");

// --- Baseline Verification ---
console.log("\n--- Baseline Verification ---");

// Setup: create an isolated project dir (no package.json) to avoid recursive npm test
const critProjectDir = join(resolve(__dirname, ".."), `_test-crit-project-${process.pid}`);
mkdirSync(critProjectDir, { recursive: true });
const critMeridianDir = join(critProjectDir, ".meridian");
process.on("exit", () => { try { rmSync(critProjectDir, { recursive: true, force: true }); } catch {} });

run(`init --dir ${critMeridianDir}`);

// verify runs baseline checks (no --task needed — acceptance verification is done by verification subagent)
r = run(`verify --dir ${critMeridianDir}`);
assert("baseline verify has no criteria field", { ok: !r.checks.criteria }, "ok", "true");
assert("baseline verify has evidence check", { ok: r.checks.evidence != null }, "ok", "true");

// --- Task Briefs ---
console.log("\n--- Task Briefs ---");

// Use isolated dir to avoid interference from earlier plan-set calls
const briefTestDir = join(resolve(__dirname, ".."), `.test-briefs-${process.pid}`);
mkdirSync(briefTestDir, { recursive: true });
const briefMeridianDir = join(briefTestDir, ".meridian");
process.on("exit", () => { try { rmSync(briefTestDir, { recursive: true, force: true }); } catch {} });

run(`init --dir ${briefMeridianDir}`);
const briefPlanFile = join(briefTestDir, "plan.json");
writeFileSync(briefPlanFile, JSON.stringify({
  tasks: [
    { id: "T1", title: "Setup", description: "Init project", kind: "scaffolding",
      acceptance_criteria: [{ type: "mechanical", description: "dir exists" }], dependencies: [] },
    { id: "T2", title: "Core", description: "Build core", kind: "core",
      acceptance_criteria: [
        { type: "unit", description: "tests pass" },
        { type: "e2e", description: "works e2e", scenario: "run it", steps: ["run"], expected: "output" },
        { type: "real_data", description: "real data", data_source: "http://x", data_file: "f.txt", expected: "ok" }
      ], dependencies: ["T1"] },
  ]
}));
run(`plan-set --plan ${briefPlanFile} --dir ${briefMeridianDir}`);

// brief-status with no briefs
r = run(`brief-status --dir ${briefMeridianDir}`);
assert("brief-status shows total tasks", { ok: r.total === 2 }, "ok", "true");
assert("brief-status all_present is false", r, "all_present", "false");
assert("brief-status missing_brief is 2", r, "missing_brief", "2");

// brief-validate fails when no briefs
try {
  r = run(`brief-validate --dir ${briefMeridianDir}`);
  assert("brief-validate should fail with no briefs", {}, "should", "have thrown");
} catch (e) {
  const output = JSON.parse(e.stdout.toString().trim());
  assert("brief-validate fails with no briefs", output, "valid", "false");
  assert("brief-validate has errors", { ok: output.errors.length === 2 }, "ok", "true");
}

// task-list and task-status include has_brief
r = run(`task-list --dir ${briefMeridianDir}`);
assert("task-list includes has_brief", { ok: r[0].has_brief != null }, "ok", "true");
assert("task-list has_brief is false", r[0], "has_brief", "false");

r = run(`task-status --task T1 --dir ${briefMeridianDir}`);
assert("task-status includes has_brief", { ok: r.has_brief != null }, "ok", "true");
assert("task-status has_brief is false", r, "has_brief", "false");

// Create a valid brief for T1
const t1BriefDir = join(briefMeridianDir, "tasks", "T1");
mkdirSync(t1BriefDir, { recursive: true });
writeFileSync(join(t1BriefDir, "brief.md"), `# Task Brief: T1

## Objective
Test task

## Scope Items
- Item A

## Design Specification

### Module Architecture
Simple module

### Key Interfaces
\`init() → void\`

### Data Flow
N/A — scaffolding task

### Integration Contracts
No upstream dependencies

## File Plan
- Create: \`src/index.js\`

## Implementation Guidance

### Approach
Standard scaffolding

### Key Decisions
Use ES modules

### Edge Cases
N/A — scaffolding task

### Anti-Patterns to Avoid
Don't hardcode paths

## Acceptance Criteria
- File exists
`, "utf8");

// task-status now shows has_brief true
r = run(`task-status --task T1 --dir ${briefMeridianDir}`);
assert("task-status has_brief after create", r, "has_brief", "true");

// brief-status shows 1 with brief
r = run(`brief-status --dir ${briefMeridianDir}`);
assert("brief-status with_brief is 1", r, "with_brief", "1");
assert("brief-status with_valid_brief is 1", r, "with_valid_brief", "1");

// Create an incomplete brief for T2 (missing sections)
const t2BriefDir = join(briefMeridianDir, "tasks", "T2");
mkdirSync(t2BriefDir, { recursive: true });
writeFileSync(join(t2BriefDir, "brief.md"), `# Task Brief: T2

## Objective
Incomplete brief — missing other sections
`, "utf8");

r = run(`brief-status --dir ${briefMeridianDir}`);
const t2Status = r.tasks.find(t => t.id === "T2");
assert("incomplete brief detected", t2Status, "brief_valid", "false");
assert("missing sections listed", { ok: t2Status.missing_sections.length > 0 }, "ok", "true");

// --- Summary ---
console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
