# ATTS Agent Skills

Cursor agent skills for the ATTS Employee Portal. Skills provide procedural "how-to" 
knowledge that agents load on demand — complementing the always-on `.cursor/rules/`.

## Installed Skills

| Skill | Triggers | Last Reviewed |
|---|---|---|
| `scaffold-safety-form` | "create a new form", "scaffold form", "new inspection/report form" | 2026-02-17 |
| `create-supabase-query-hook` | "create a query hook", "add data fetching", "new useQuery" | 2026-02-17 |
| `create-supabase-migration` | "create migration", "add table", "schema change" | 2026-02-17 |
| `project-conventions` | "implement feature", "generate code", any .ts/.tsx file creation | 2026-02-17 |
| `scaffold-admin-page` | "create admin page", "new admin dashboard", "admin table page" | 2026-02-17 |
| `create-edge-function` | "create edge function", "new supabase function", "cron function" | 2026-02-17 |
| `add-offline-support` | "add offline support", "make form work offline", "offline queue" | 2026-02-17 |
| `add-e2e-test` | "add e2e test", "create playwright test", "write e2e spec" | 2026-02-17 |
| `add-dashboard-widget` | "add dashboard widget", "create widget", "new dashboard card" | 2026-02-17 |
| `ui-design-guide` | "create a page", "build a component", "style", "layout", "loading state", any .tsx creation | 2026-02-17 |

## When to Update a Skill

Update a skill when:
- The pattern it covers changes (e.g., a new hook API replaces an old one)
- A new project convention is established
- A pain point is found in generated code that the skill should have prevented
- After a major refactor that touches the files a skill references

Bump the `version` field and update `reviewed` date when you make changes.

## How to Add a New Skill

1. Create a directory: `.cursor/skills/<skill-name>/`
2. Create `SKILL.md` with the required frontmatter:
   ```yaml
   ---
   name: skill-name
   description: One sentence. Include the trigger phrases agents use to discover it.
   triggers:
     - "phrase that should load this skill"
   version: 1.0
   reviewed: YYYY-MM-DD
   ---
   ```
3. Add reference files in `references/` if templates are needed
4. Test: ask the agent to perform a task that should trigger the skill, then verify it was loaded
5. Add the skill to this README

## When to Audit Skills

Review all skills when:
- Onboarding a new developer (they should read these as documentation too)
- After a major dependency upgrade (React Query v6, Supabase v3, etc.)
- After a significant architecture change
- Quarterly as part of tech debt review

## Skills vs. Rules

| | Skills | Rules (`.cursor/rules/`) |
|---|---|---|
| Loading | On demand, when relevant | Always active |
| Content | Procedural how-tos, templates | Constraints, standards |
| Good for | "How to scaffold a form" | "Never use console.log" |
