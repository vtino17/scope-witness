#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  auditPatch,
  compileScopeReceipt,
  diffContracts,
  parseUnifiedDiff,
  sampleClaims,
  sampleContract,
  verifyScopeReceipt,
} from "@scopewitness/core";
import type { ScopeReceipt } from "@scopewitness/core";
import { formatAudit, formatDiff, formatInventory } from "./format.js";

const help = `ScopeWitness — diff accountability for coding agents

Usage:
  scope-witness inventory <patch.diff> [--json]
  scope-witness audit <contract.json> --patch <patch.diff> --claims <claims.json> [--at <ISO date>] [--json]
  scope-witness explain <contract.json> --patch <patch.diff> --claims <claims.json> --hunk <id> [--at <ISO date>]
  scope-witness receipt <contract.json> --patch <patch.diff> --claims <claims.json> --output <receipt.json> [--at <ISO date>]
  scope-witness verify <receipt.json> [--contract <json>] [--claims <json>] [--patch <diff>]
  scope-witness diff <previous.json> <next.json> [--json]
  scope-witness init [directory]

Exit codes: 0 aligned/valid, 2 blocked, 3 warning, 4 weakened contract, 5 invalid input.`;

const option = (args: string[], name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const text = async (path: string): Promise<string> => readFile(resolve(path), "utf8");
const json = async (path: string): Promise<unknown> => JSON.parse(await text(path)) as unknown;
const out = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};
const at = (args: string[]): Date => {
  const input = option(args, "--at");
  if (!input) return new Date();
  const date = new Date(input);
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid --at date: ${input}`);
  return date;
};
const auditInputs = async (contractPath: string, args: string[]) => {
  const patchPath = option(args, "--patch");
  const claimsPath = option(args, "--claims");
  if (!patchPath || !claimsPath) throw new Error("Command requires --patch <diff> and --claims <json>.");
  const contract = await json(contractPath);
  const claims = await json(claimsPath);
  const patch = await text(patchPath);
  const audit = await auditPatch({ contract, claims, patch, auditedAt: at(args) });
  return { contract, claims, patch, audit };
};

async function run(args: string[]): Promise<number> {
  const [command, first, second] = args;
  if (!command || ["help", "--help", "-h"].includes(command)) {
    console.log(help);
    return 0;
  }
  if (command === "init") {
    const directory = resolve(first ?? ".scope-witness");
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, "contract.json"), `${JSON.stringify(sampleContract, null, 2)}\n`, "utf8");
    await writeFile(resolve(directory, "claims.json"), `${JSON.stringify(sampleClaims, null, 2)}\n`, "utf8");
    console.log(`Created ${directory}/contract.json`);
    console.log(`Created ${directory}/claims.json`);
    return 0;
  }
  if (command === "inventory") {
    if (!first || first.startsWith("--")) throw new Error("inventory requires a patch path.");
    const inventory = await parseUnifiedDiff(await text(first));
    if (args.includes("--json")) out(inventory);
    else console.log(formatInventory(inventory));
    return 0;
  }
  if (["audit", "explain", "receipt"].includes(command)) {
    if (!first || first.startsWith("--")) throw new Error(`${command} requires a contract path.`);
    const input = await auditInputs(first, args);
    if (command === "audit") {
      if (args.includes("--json")) out(input.audit);
      else console.log(formatAudit(input.audit));
    }
    if (command === "explain") {
      const hunkId = option(args, "--hunk");
      if (!hunkId) throw new Error("explain requires --hunk <id>.");
      const hunk = input.audit.hunks.find((entry) => entry.hunkId === hunkId);
      if (!hunk) throw new Error(`Unknown hunk: ${hunkId}`);
      out(hunk);
    }
    if (command === "receipt") {
      const output = option(args, "--output");
      if (!output) throw new Error("receipt requires --output <receipt.json>.");
      const receipt = await compileScopeReceipt({ ...input, issuedAt: at(args) });
      await mkdir(dirname(resolve(output)), { recursive: true });
      await writeFile(resolve(output), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
      console.log(`Scope receipt: ${resolve(output)}`);
    }
    return input.audit.status === "aligned" ? 0 : input.audit.status === "blocked" ? 2 : 3;
  }
  if (command === "verify") {
    if (!first || first.startsWith("--")) throw new Error("verify requires a receipt path.");
    const receipt = (await json(first)) as ScopeReceipt;
    const contractPath = option(args, "--contract");
    const claimsPath = option(args, "--claims");
    const patchPath = option(args, "--patch");
    const result = await verifyScopeReceipt({
      receipt,
      ...(contractPath ? { contract: await json(contractPath) } : {}),
      ...(claimsPath ? { claims: await json(claimsPath) } : {}),
      ...(patchPath ? { patch: await text(patchPath) } : {}),
    });
    out(result);
    return result.valid ? 0 : 2;
  }
  if (command === "diff") {
    if (!first || !second || second.startsWith("--")) throw new Error("diff requires previous and next contract paths.");
    const result = diffContracts(await json(first), await json(second));
    if (args.includes("--json")) out(result);
    else console.log(formatDiff(result));
    return result.weakenedControls.length > 0 ? 4 : 0;
  }
  throw new Error(`Unknown command: ${command}\n\n${help}`);
}

run(process.argv.slice(2))
  .then((code) => { process.exitCode = code; })
  .catch((error: unknown) => {
    console.error(`ScopeWitness error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 5;
  });
