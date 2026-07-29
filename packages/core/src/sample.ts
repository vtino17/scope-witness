import type {
  ClaimManifest,
  IntentContract,
} from "./types.js";

export const sampleContract: IntentContract = {
  schemaVersion: "1.0",
  id: "fix-session-timeout",
  summary: "Add a bounded timeout to session refresh and cover the failure path.",
  outcomes: [
    {
      id: "bounded-refresh",
      statement: "Session refresh aborts after the configured timeout.",
      pathPatterns: ["src/session.ts"],
      requiredDiffTokens: ["AbortSignal.timeout"],
      allowedChangeKinds: ["modified"],
    },
    {
      id: "timeout-regression-test",
      statement: "A regression test covers slow refresh failure.",
      pathPatterns: ["test/**/*.test.ts"],
      requiredDiffTokens: ["times out slow requests"],
      allowedChangeKinds: ["added", "modified"],
    },
  ],
  rules: {
    allowedPaths: ["src/**", "test/**", "package.json", ".github/**"],
    forbiddenPaths: ["secrets/**", "infra/production/**"],
    maxFiles: 4,
    maxChangedLines: 80,
    sourcePatterns: ["src/**"],
    testPatterns: ["test/**/*.test.ts"],
    requireTestsForSourceChanges: true,
    dependencyManifestPatterns: ["package.json", "**/package.json", "*-lock.*"],
    workflowPatterns: [".github/workflows/**"],
    allowDependencyChanges: false,
    allowWorkflowChanges: false,
    protectedPaths: [
      {
        pattern: ".github/workflows/**",
        approvalId: "workflow-admin",
        reason: "CI workflows can change repository authority.",
      },
    ],
    disallowCatchAllClaims: true,
  },
  approvals: [],
};

export const sampleClaims: ClaimManifest = {
  schemaVersion: "1.0",
  contractId: "fix-session-timeout",
  claims: [
    {
      id: "claim-refresh-implementation",
      pathPattern: "src/session.ts",
      outcomeIds: ["bounded-refresh"],
      reason: "Wire the requested timeout into the refresh request.",
    },
    {
      id: "claim-timeout-test",
      pathPattern: "test/**/*.test.ts",
      outcomeIds: ["timeout-regression-test"],
      reason: "Exercise the slow-request failure path.",
    },
  ],
};

export const alignedPatch = `diff --git a/src/session.ts b/src/session.ts
index 9ad41d1..f10ca19 100644
--- a/src/session.ts
+++ b/src/session.ts
@@ -8,7 +8,8 @@ export async function refreshSession(
-  return fetch(endpoint);
+  const signal = AbortSignal.timeout(timeoutMs);
+  return fetch(endpoint, { signal });
 }
diff --git a/test/session.test.ts b/test/session.test.ts
index 2736a12..a940921 100644
--- a/test/session.test.ts
+++ b/test/session.test.ts
@@ -20,3 +20,8 @@ describe("refreshSession", () => {
+  it("times out slow requests", async () => {
+    await expect(refreshSession("/slow", 5)).rejects.toThrow();
+  });
 });
`;

export const scopeCreepPatch = `${alignedPatch}diff --git a/package.json b/package.json
index e100000..e200000 100644
--- a/package.json
+++ b/package.json
@@ -10,3 +10,4 @@
+    "left-pad": "^1.3.0"
diff --git a/.github/workflows/release.yml b/.github/workflows/release.yml
index 0101010..0202020 100644
--- a/.github/workflows/release.yml
+++ b/.github/workflows/release.yml
@@ -4,3 +4,4 @@
+  workflow_dispatch:
`;

export function weakenedContract(): IntentContract {
  const value = structuredClone(sampleContract);
  value.id = "fix-session-timeout-weakened";
  value.rules.maxFiles = 20;
  value.rules.maxChangedLines = 1_000;
  value.rules.allowedPaths.push("**/*");
  value.rules.forbiddenPaths = [];
  value.rules.requireTestsForSourceChanges = false;
  value.rules.allowDependencyChanges = true;
  value.rules.allowWorkflowChanges = true;
  value.rules.protectedPaths = [];
  value.rules.disallowCatchAllClaims = false;
  value.outcomes[0]!.requiredDiffTokens = [];
  value.outcomes[0]!.allowedChangeKinds.push("deleted");
  return value;
}
