# Mobile and PWA UX audit

## Phase 0: baseline

The existing application already had a server-backed Today prioritizer, direct habit/task completion, mobile drawer navigation, settings for light/dark/system, and a service worker that precached the application shell. This audit focused on friction at the authenticated shell and on consistency across theme, install, and brand surfaces.

| Area                 | Baseline observation                                                               | Priority | Outcome                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Today actions        | Today surfaced the next action, but adding a habit or task opened a list first.    | High     | Today links now open the existing creation forms directly.                                                                     |
| Mobile navigation    | Habits and tasks were hidden under More.                                           | High     | Today, Habits, and Tasks are on the bottom bar; More opens the drawer.                                                         |
| Profile              | Profile was a route and logout was buried in the sidebar.                          | High     | Header avatar opens Profile, Friends, Settings, install help, and logout.                                                      |
| Notifications        | The bell navigated away to a full page.                                            | Medium   | Bell opens a real-data overlay; the full page remains available.                                                               |
| Theme                | System mode existed, but design tokens and brand UI remained largely light/purple. | High     | Semantic tokens, PrimeNG surfaces, theme-color, and system preference now share a teal/green identity in light and dark modes. |
| PWA install          | No install prompt or platform guidance existed.                                    | Medium   | Delayed, dismissible install/help experience supports native prompts and manual browser steps.                                 |
| Offline expectations | App shell was cached, while private APIs were intentionally not cached.            | High     | The shell explains that account data still needs a connection; no offline writes are implied.                                  |
| Identity             | Favicon and install icons used the prior purple mark.                              | Medium   | New MIRHAL waypoint mark is used for web/admin favicon and web install assets.                                                 |

## Implementation notes

- Habit and task creation use the existing forms and API contracts. The Today links pass `quickAdd` query parameters; the destination page opens its established editor.
- Notification items are fetched only when the overlay opens. Clicking an unread item marks it read through the existing endpoint; opening the overlay alone does not change read state.
- Install prompting is user initiated. A native `beforeinstallprompt` event is retained for the install button; iOS Safari, Android browsers, and macOS Safari receive manual instructions. Dismissal is remembered for fourteen days when browser storage is available.
- Service worker policy remains app-shell-only. `/api/**` and `/auth/**` remain excluded from navigation fallback, and `dataGroups` stays empty.
- All new shell and install copy is available in English and Arabic. The existing RTL behavior remains driven by the shared language preference.

## Verification matrix

| Surface                                   | Light                          | Dark                           | Arabic / RTL                           | Offline / limited connection                                         |
| ----------------------------------------- | ------------------------------ | ------------------------------ | -------------------------------------- | -------------------------------------------------------------------- |
| Authenticated shell and mobile navigation | Semantic tokens                | Semantic tokens                | Shared translated labels and direction | Connection status is visible; API-backed content remains unavailable |
| PrimeNG dialogs and forms                 | Surface and input tokens       | Dark surface and input tokens  | Existing localized controls            | Existing errors and retry behavior                                   |
| PWA install/help                          | Themed banner/dialog           | Themed banner/dialog           | Localized instructions                 | Copy states that account access still needs internet                 |
| Notification overlay                      | Themed dialog and unread state | Themed dialog and unread state | Localized labels and dates             | Real API error with retry; no fabricated notifications               |

Automated checks run for this implementation are listed in the delivery report. Browser installation prompts vary by browser and require a secure origin; the manual help path remains available where native prompting is unavailable.
