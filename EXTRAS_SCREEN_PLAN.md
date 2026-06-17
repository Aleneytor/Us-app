# Extras screen implementation plan

## Goal

Match the requested Extras flow without changing the broader app structure:

- Initial state: purple Extras screen with two large action cards: Ahorros and Planes.
- On pressing Ahorros: the card compresses into an expanded savings view with a smooth animation.
- Expanded Ahorros view shows:
  - "Ver menos" control.
  - Savings summary card with total saved.
  - "Crear Ahorro" button using the same animated border pattern as Categorias.
  - Recent saving contribution rows.
  - Saving preview rows with a category-card-like layout.
  - "Ver Mas" button for access to the full savings screen later.

## Guardrails

- Do not start or open the local dev server.
- Keep edits scoped to `app/(tabs)/extras.tsx` plus this planning note.
- Preserve existing modals and data sources where possible.
- Reuse existing calculations:
  - `savingPlanSavedAmount`
  - `goalProgress`
  - `buildActivityFeed`
- Use existing Expo/React Native dependencies only.
- Verify with static checks only.

## Implementation notes

- Use a local `expandedSection` state for the accordion.
- Keep Planes as a visual entry point for now.
- Use `Animated.Value` for expansion progress.
- Add internal helper components:
  - `ExtrasMenuCard`
  - `SavingsSummaryCard`
  - `CreateSavingsButton`
  - `SavingsMovementRow`
  - `SavingsPreviewRow`
- Do not remove existing detail modals unless they become unused after the edit.
