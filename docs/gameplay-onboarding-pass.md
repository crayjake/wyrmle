# Gameplay, onboarding and difficulty review

This review tested the frozen DESPAIR board now published for both September 24 and 25, 2026 UTC. New or untouched attempts on either date share that exact puzzle; started/completed attempts keep their original board, including older MELANCHOLY publications. Normal, Hard and Hardcore share each day's enemy, board, tile identities, armour, Resolve, refill and combat rules. REGEN is available in authored encounters and optional generation; it is not retrofitted into these published puzzles.

## First-time research before changes

A fresh Chromium player agent used only the visible tutorial and game, without source, internal notes, stored solutions or application-state inspection. It completed the old tutorial and played FRIENDLY, HOPE and SHADY against DESPAIR.

- Armour was explained after the first armoured hit. The player expected ICE to remove C and was surprised when it survived.
- An adjective bonus appeared before its explanation. LONG first appeared in the Daily without being taught at all.
- “First matching letter” did not make spelling-order targeting clear.
- FRIENDLY received an adjective bonus, while SHADY did not. The player could not reconcile this with the grammar lesson.
- The Daily preview omitted total strikes and Resolve afterward, forcing the player to combine several distant UI regions.
- Minimum word length, unrestricted board selection and refill behaviour were discovered incidentally.

Once the player understood the enemy markers, its final preattack predictions matched the Daily outcomes. The redesign therefore teaches each marker and rule before the relevant commitment, and keeps those predictions explicit in normal play.

## Independent player test after redesign

A second fresh agent used only rendered UI and completed the revised tutorial, then played three Daily turns. All nine tutorial attack predictions matched the actual letters and Resolve changes. It correctly identified armour damage versus removal, STRIKE through resistance, WARD's free turn, and both REGEN previews before choosing the safe E.

Its Daily predictions also matched:

| Word | Prediction and observed result | Resolve |
| --- | --- | --- |
| FAIR | One neutral strike removes A | 5 → 4 |
| HOPE | Counter with STRIKE E and WARD O removes P and breaks E's armour | 4 → 4 |
| STEADY | Neutral + LONG + adjective removes S, E and D | 4 → 3 |

The remaining confusion was grammar eligibility: FAIR seemed like an adjective, but its preview awarded no bonus. This prompted another copy revision: the preview now says **Word type unknown · no bonus** or **Multiple word types · no bonus**, while the grammar lesson and Help explicitly explain confirmed-type eligibility. The tester rechecked FAIR in a fresh context and confirmed that the explanation resolved its confusion. Semantic categories can still require checking the preview; they are not inferred from arbitrary natural-language meaning.

The player found the individual lessons clear but the 26 steps somewhat long. That pacing is intentional for this full first-time explanation; Skip and later replay remain available. REGEN is taught through two real-engine inspections and a safe choice rather than forcing the player to heal the enemy. A development hot reload interrupted the first traversal; it was replayed through visible UI and treated as a testing interruption.

## Revised tutorial

Twenty-six short gated steps use the real engine, enemy, tiles, Resolve and preview components. There are nine submitted words and three inspection-only previews. Steps pause for acknowledgement after each outcome.

1. SAD: goal, five Resolve, manually build GLAD, connect selected A/D to enemy A/D, then counter and remove them. SUN demonstrates neutral targeting and finishes the tiny battle.
2. Armour: double border → single border → dot across two separate attacks.
3. Resistance: inspect zero strikes, then use STRIKE through resistance.
4. WARD: play DIG and watch Resolve stay 3/5 → 3/5.
5. REGEN: inspect a dead E returning and a living E gaining armour, then use the plain E to avoid recovery.
6. Grammar and LONG: DAMP shows a recognized adjective allowance; STREAM shows the six-letter neutral bonus and exact spelling-order targets.

Unrelated tiles are disabled and dimmed; the next letter is highlighted. Skip is always available. First-time completion/Skip leads to mode choice. Help offers replay without changing Daily progress or statistics. Settings now offers **Beta tools → Reset tutorial**, which marks onboarding incomplete and starts the lessons immediately while preserving the Daily and preferred mode. Reloading during that reset keeps the tutorial open; completion or Skip returns to the Daily. DEV provides step/fixture jumps using real replayed states.

## Gameplay and persistence

REGEN resolves after all strikes. Each used REGEN tile restores one matching enemy copy: dead to one hit, or one hit to two. Dead copies take priority, then unarmoured living copies, with left-to-right ordering within each group. Already armoured and unrelated letters cannot benefit. Red recovery markers and text supplement the ordinary strike preview; history, solver and results retain the recovery evidence.

Normal provides a definition and three undos; Hard hides the definition and provides one; Hardcore hides it and provides none. Begin fixes the mode. Undo in Log restores an immutable full preturn snapshot, including board IDs, refill cursor, enemy states, Resolve and history. Usage survives reload and cannot be replenished by replaying a turn. Revision checks protect against stale tabs. Permanently saved results cannot be undone.

Schema 5 records undo usage and original result difficulty. Historical saves are validated against their original schema and enriched in memory without read-time writes. A later difficulty recalibration preserves completed results' original labels.

During beta, production **Settings → Beta tools → Reset puzzle** clears the open date's run and result and starts a fresh attempt on its current publication. This switches an older September 24 or 25 attempt to DESPAIR. Other dates and preferences remain intact. Statistics are derived again from the remaining results. This explicit reset also permits replaying a completed date.

After the final scheduling correction, all 312 automated tests, TypeScript, lint and production build pass; date/content tests cover both days sharing the exact DESPAIR encounter. The preceding production-browser checks verified active and completed puzzle resets, preservation of other days and preferred mode, statistics recalculation, reset synchronization across tabs, and tutorial reset/reload/Skip without changing Daily bytes. A browser clock at September 25 verified the selected DESPAIR board and MEDIUM label. Those browser checks used a temporary schedule with September 24 MELANCHOLY; September 24 has since been restored to DESPAIR. Beta controls were present and DEV controls absent in that production build.

## Difficulty evidence

`src/generator/difficulty.ts` makes winning depth the primary input, adjusted by Resolve slack, observed strategy/opening diversity, required-word familiarity, armour, special-tile/grammar dependence, traps and proved clutch-only dependence. Thresholds and weights are centralized. Full analysis distinguishes a proved minimum from a bounded winning witness and observed route counts from exhaustive counts.

The DESPAIR shared by September 24 and 25 is **MEDIUM**. Its three-word minimum is proved: exhaustive enumeration checked 17,178 physical opening selections and 2,824,308 potentially winning second-word selections without finding a one- or two-word win. A real-engine three-word win supplies the upper bound. The proof is fingerprinted to the exact encounter. `npm run prove-daily-minimum` reproduces it; `npm run rate-dailies` refreshes metadata and public labels.

Other archived ratings currently use bounded winning witnesses and are explicitly estimates in DEV metadata. Ordinary play receives only the difficulty label before Begin. Full analysis and solution-related metadata are excluded from the production bundle.

## Validation

At completion of the original gameplay pass, all 311 tests, TypeScript, lint and production build passed. Engine tests covered REGEN priority, caps, ordering, preview equality, solver choices and deterministic optional generation. Undo tests covered complete restoration, reload, all modes, finalization, stale tabs, storage failures and legacy migration. Tutorial tests replayed every step and DEV jump; difficulty tests covered depth, diversity, vocabulary and equal ratings across modes. The browser findings below also record that original pass.

Chromium checks completed the same three-word DESPAIR victory in all three modes, verified definition visibility and 3/1/0 allowances, compared complete states before/after undo, refreshed persisted usage, changed the preferred mode during a run, replayed/skipped tutorial without altering Daily bytes, and confirmed terminal undo is disabled. These checks passed with both reduced and full motion, including attacking again after undo. Final result metadata was checked; no browser errors occurred.

Layout testing caught and fixed a collapsed tutorial flex region, a specificity conflict that oversized the mobile board, and animation styles overriding disabled-tile dimming. All 26 steps were then checked before and after selection at 1440×1000, 375×629 and 320×568: 156 states with no horizontal/vertical overflow or instruction/board overlap, the enemy below the header, and all tile/action targets at least 44px.
