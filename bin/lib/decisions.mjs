// Decisions management — tracks choices requiring human confirmation.

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

function readState(dir) {
  return JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
}

function writeState(dir, state) {
  state.updated_at = new Date().toISOString();
  writeFileSync(join(dir, "state.json"), JSON.stringify(state, null, 2), "utf8");
}

/**
 * Add a decision to state.decisions.
 */
export function decisionAdd(dir, { id, question, options, severity, blockingTasks }) {
  const state = readState(dir);
  state.decisions[id] = {
    id,
    question,
    options,
    severity,
    blockingTasks: blockingTasks || [],
    created_at: new Date().toISOString(),
  };
  writeState(dir, state);
  return { added: true, id, severity };
}

/**
 * Return all unresolved decisions (those without `choice` set).
 */
export function decisionPending(dir) {
  const state = readState(dir);
  const pending = Object.values(state.decisions).filter((d) => d.choice == null);
  return { pending, count: pending.length };
}

/**
 * Resolve a decision by setting the chosen option and timestamp.
 */
export function decisionResolve(dir, id, choiceId) {
  const state = readState(dir);
  const decision = state.decisions[id];
  if (!decision) {
    throw new Error(`Decision '${id}' not found`);
  }
  decision.choice = choiceId;
  decision.resolved_at = new Date().toISOString();
  writeState(dir, state);
  return { resolved: true, id, choice: choiceId };
}

/**
 * Check if a decision report should be shown to the user.
 */
export function reportDue(dir) {
  const { pending } = decisionPending(dir);
  const hasIrreversible = pending.some((d) => d.severity === "irreversible");
  if (hasIrreversible) {
    return { due: true, reason: "irreversible decision pending", immediate: true };
  }
  const reversibleCount = pending.filter((d) => d.severity === "reversible").length;
  if (reversibleCount >= 3) {
    return { due: true, reason: "3+ reversible decisions pending", immediate: false };
  }
  return { due: false };
}

/**
 * Format pending decisions as a terminal-friendly report string.
 */
export function reportFormat(dir) {
  const { pending } = decisionPending(dir);

  if (pending.length === 0) {
    return { report: "No pending decisions.", decisions: [] };
  }

  const W = 47;
  const pad = (s) => "║  " + s + " ".repeat(Math.max(0, W - 4 - s.length)) + "║";
  const blank = pad("");

  const lines = [];
  lines.push("╔" + "═".repeat(W - 2) + "╗");
  lines.push(pad("Meridian Decision Report"));
  lines.push("╠" + "═".repeat(W - 2) + "╣");
  lines.push(blank);

  pending.forEach((d, idx) => {
    const num = idx + 1;
    const icon = d.severity === "irreversible" ? "🔴" : "🟡";
    lines.push(pad(`${icon} Decision ${num}: ${d.question}`));

    for (const opt of d.options) {
      const rec = opt.recommendation ? " (recommended)" : "";
      lines.push(pad(`→ [${opt.id}] ${opt.choice}${rec}`));
    }
    lines.push(blank);
  });

  lines.push(pad("Reply: 1A (or Enter for all recommended)"));
  lines.push("╚" + "═".repeat(W - 2) + "╝");

  return { report: lines.join("\n"), decisions: pending };
}
