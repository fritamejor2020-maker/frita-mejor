# Frita Mejor Developer Rules

This file documents critical behavioral rules and coding guidelines for the Frita Mejor project. All AI agents working on this repository must read and strictly adhere to these rules.

## 1. 🔄 Session and Branch Reactivity (Multi-Sede Support)
* **Reactivity in Effects:** Every synchronization hook (`useEffect`), database listener, or component that fetches branch-specific data from Supabase or Zustand must include the active user context (`userBranchId` and/or `userId`) in its dependency array.
* **Why:** In-app logout and login use client-side routing (React Router) which **does not** physically reload the browser tab. If effects are not reactive to user context, the app will continue to display cached state from the previous user's branch (e.g. showing active shifts as closed or empty).
* **Sync Triggers:** Always invoke the store's sync/pull methods (e.g. `useInventoryStore.getState().loadFromRemote()`) whenever the user session changes.

## 2. 🛡️ Safe Git Operations in Background Terminals
* **Credential Prompts:** Never run a plain `git push` command, as it defaults to the interactive Git Credential Manager GUI, which hangs in background non-interactive sessions.
* **wincred Helper:** Always invoke git push using the Windows credential helper configuration flag:
  ```bash
  git -c credential.helper=wincred push origin main
  ```
  This non-interactively reads credentials from the Windows Credential Manager.

## 3. 🧪 Production Builds before Push
* Before pushing any changes to GitHub, always run `npm run build` locally in the workspace directory to ensure there are no TypeScript, compilation, or packaging errors that would break the Vercel deployment pipeline.
