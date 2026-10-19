# Upstream Sync & Custom Feature Preservation Rule

## Objective
Ensure that whenever this fork is synced with the upstream repository (`https://github.com/rociiu/talorys`), no custom features or enhancements are lost. If upstream introduces a feature that we previously built as a custom capability, adopt upstream's base architecture while retaining and re-integrating any custom extensions or enhancements unique to our implementation.

---

## The Sync Protocol

When a user requests to sync with upstream or update Talorys:

### Step 1: Pre-Sync Inventory Audit
1. Read [`CUSTOM_FEATURES.md`](file:///g:/My%20Drive/Projects/Talorys/CUSTOM_FEATURES.md) to review all active custom enhancements, touched files, database migrations, and integration points.
2. Ensure the working tree is clean (`git status`).

### Step 2: Fetch and Inspect Upstream Changes
1. Fetch latest changes:
   ```bash
   git fetch upstream
   ```
2. Diff incoming commits against the current branch:
   ```bash
   git log --oneline HEAD..upstream/main
   git diff --name-only HEAD..upstream/main
   ```

### Step 3: Feature Overlap & Diff Analysis
Compare incoming changes against [`CUSTOM_FEATURES.md`](file:///g:/My%20Drive/Projects/Talorys/CUSTOM_FEATURES.md):
- **Scenario A: Upstream implemented a feature we previously added custom (e.g. MCP):**
  1. Carefully compare upstream's schema, API routes, and agent runner integration with our custom implementation.
  2. Adopt upstream's base design/API to remain compatible with future upstream updates.
  3. Re-introduce any specialized custom features missing from upstream:
     - Cloudflare Inkstone Quick-Connect & note recall.
     - Free-tier optimizations (tool filtering, context budgeting).
     - Custom UI controls and connection testers.
- **Scenario B: Upstream did NOT touch our custom features:**
  1. Merge/rebase upstream changes:
     ```bash
     git merge upstream/main
     ```
  2. Resolve any mechanical merge conflicts, ensuring none of our custom routes, migrations, UI tabs, or schemas are removed.

### Step 4: Database Migration Safety
- If upstream added migrations, verify migration numbering order in `apps/agent/src/db/migrations.ts`.
- Ensure custom migrations (e.g., migration 11 for `tal_mcp_servers`) are assigned sequential, non-conflicting IDs.

### Step 5: Automated Verification & Compilation
Before marking any sync complete:
1. Sync modified files to the local NTFS build directory (`$env:TEMP\talorys-build`).
2. Run full TypeScript validation and bundling:
   ```powershell
   npm run build -w @talorys/web
   npm run build -w @talorys/agent
   ```
3. Verify both builds succeed with exit code 0.

### Step 6: Update Documentation & Commit
1. Update [`CUSTOM_FEATURES.md`](file:///g:/My%20Drive/Projects/Talorys/CUSTOM_FEATURES.md) if feature implementations were adapted to match upstream conventions.
2. Commit with a descriptive message: `sync: merge upstream/main and preserve custom features`.
