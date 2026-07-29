import {
  alignedPatch,
  auditPatch,
  compileScopeReceipt,
  parseUnifiedDiff,
  sampleClaims,
  sampleContract,
  scopeCreepPatch,
} from "@scopewitness/core";
import type {
  DiffInventory,
  ScopeAudit,
} from "@scopewitness/core";
import "./styles.css";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Application root was not found.");
const app: HTMLDivElement = root;
let patch = alignedPatch;
let audit: ScopeAudit;
let inventory: DiffInventory;

const escape = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);

async function evaluate(): Promise<void> {
  inventory = await parseUnifiedDiff(patch);
  audit = await auditPatch({ contract: sampleContract, claims: sampleClaims, patch });
}

function render(): void {
  const findings = audit.issues.filter((entry, index, all) =>
    all.findIndex((candidate) => candidate.code === entry.code && candidate.path === entry.path) === index
  );
  app.innerHTML = `
    <header>
      <a class="brand" href="#"><span>SW</span><b>ScopeWitness</b></a>
      <div class="contract-id">CONTRACT · ${escape(sampleContract.id)}</div>
      <a href="https://github.com/vtino17/scope-witness">GitHub ↗</a>
    </header>
    <main>
      <section class="hero">
        <div><p class="eyebrow">A passing test is not permission to change everything</p><h1>Make every hunk<br><em>answer for itself.</em></h1></div>
        <div class="score score-${audit.status}"><strong>${audit.score}</strong><span>INTENT<br>FIDELITY</span></div>
      </section>
      <section class="summary">
        <article><small>Verdict</small><strong>${audit.status}</strong></article>
        <article><small>Files changed</small><strong>${inventory.totalFiles}/${sampleContract.rules.maxFiles}</strong></article>
        <article><small>Changed lines</small><strong>${inventory.changedLines}/${sampleContract.rules.maxChangedLines}</strong></article>
        <article><small>Hunk coverage</small><strong>${audit.coveredHunks}/${audit.hunks.length}</strong></article>
        <article><small>Orphan hunks</small><strong>${audit.orphanHunks}</strong></article>
      </section>
      <section class="outcomes">
        <div class="section-head"><div><span>01</span><h2>Requested outcomes</h2></div><p>Every outcome must have covered implementation</p></div>
        <div class="outcome-grid">${audit.outcomes.map((entry) => {
          const outcome = sampleContract.outcomes.find((candidate) => candidate.id === entry.outcomeId)!;
          return `<article class="${entry.satisfied ? "satisfied" : "missing"}"><span>${entry.satisfied ? "✓" : "×"}</span><div><h3>${escape(outcome.id)}</h3><p>${escape(outcome.statement)}</p><small>${entry.hunkIds.length} attributed hunk(s)</small></div></article>`;
        }).join("")}</div>
      </section>
      <section class="workbench">
        <div class="patch-panel">
          <div class="section-head"><div><span>02</span><h2>Unified diff</h2></div><div class="switch"><button id="aligned">Aligned patch</button><button id="creep">Scope creep</button></div></div>
          <textarea id="patch" spellcheck="false">${escape(patch)}</textarea>
          <div id="error" class="error"></div>
          <div class="actions"><span>SHA-256 · ${audit.patchHash.slice(0, 12)}…</span><button id="audit">Audit patch <b>⌘↵</b></button></div>
        </div>
        <div class="audit-panel">
          <div class="section-head"><div><span>03</span><h2>Accountability ledger</h2></div><span class="verdict ${audit.status}">${audit.status}</span></div>
          <div class="file-list">${inventory.files.map((file) => {
            const hunkAudits = audit.hunks.filter((entry) => entry.path === file.path);
            return `<article><div class="file-top"><span class="kind">${file.kind}</span><b>${escape(file.path)}</b><code>+${file.additions} −${file.deletions}</code></div>${hunkAudits.map((hunk) => `<div class="hunk ${hunk.covered ? "covered" : "orphan"}"><span>${hunk.covered ? "CLAIMED" : "ORPHAN"}</span><code>${hunk.hunkId}</code><small>${escape(hunk.outcomeIds.join(", ") || "no requested outcome")}</small></div>`).join("")}</article>`;
          }).join("")}</div>
          <div class="findings"><p class="eyebrow">Policy findings</p>${findings.length === 0
            ? `<div class="clear"><b>Patch is fully attributable</b><span>No scope, approval, test-coupling, or outcome violations.</span></div>`
            : findings.map((entry) => `<div class="finding"><span>${entry.severity}</span><p><b>${escape(entry.code)}</b>${escape(entry.message)}${entry.path ? `<small>${escape(entry.path)}</small>` : ""}</p></div>`).join("")}</div>
          <div class="receipt"><button id="receipt" ${audit.status === "blocked" ? "disabled" : ""}>Download scope receipt</button><span>contract + claims + patch bound</span></div>
        </div>
      </section>
      <section class="rules">
        <div class="section-head"><div><span>04</span><h2>Active boundaries</h2></div></div>
        <div class="rule-grid">
          <article><b>${sampleContract.rules.maxFiles}</b><h3>File budget</h3><p>Broad patches fail before review fatigue takes over.</p></article>
          <article><b>${sampleContract.rules.maxChangedLines}</b><h3>Line budget</h3><p>Changed lines stay proportional to the request.</p></article>
          <article><b>YES</b><h3>Test coupling</h3><p>Source edits require an accompanying test change.</p></article>
          <article><b>DENY</b><h3>Authority surfaces</h3><p>Dependencies and workflows require explicit permission.</p></article>
        </div>
      </section>
    </main>
    <footer><span>ScopeWitness v0.1</span><span>Local-only · deterministic · no semantic guessing</span></footer>
  `;
  bind();
}

async function runAudit(): Promise<void> {
  const editor = document.querySelector<HTMLTextAreaElement>("#patch")!;
  const error = document.querySelector<HTMLDivElement>("#error")!;
  try {
    patch = editor.value;
    await evaluate();
    render();
  } catch (cause) {
    error.textContent = cause instanceof Error ? cause.message : String(cause);
  }
}

async function load(value: string): Promise<void> {
  patch = value;
  await evaluate();
  render();
}

async function download(): Promise<void> {
  const receipt = await compileScopeReceipt({ contract: sampleContract, claims: sampleClaims, patch, audit });
  const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${sampleContract.id}.scope-receipt.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function bind(): void {
  document.querySelector("#audit")?.addEventListener("click", () => void runAudit());
  document.querySelector("#aligned")?.addEventListener("click", () => void load(alignedPatch));
  document.querySelector("#creep")?.addEventListener("click", () => void load(scopeCreepPatch));
  document.querySelector("#receipt")?.addEventListener("click", () => void download());
  document.querySelector("#patch")?.addEventListener("keydown", (event) => {
    if (event instanceof KeyboardEvent && (event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void runAudit();
    }
  });
}

await evaluate();
render();
