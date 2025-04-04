### 0.5.10 (April 4, 2025)
- Fix an issue where other prefernences to skip onboarding affected every user.

### 0.5.9 (April 3, 2025)
- Filter out empty users from the pre-auth keys page which could possibly cause a crash with unmigrated users.
- OIDC users cannot be renamed, so that functionality has been disabled in the menu options.
- Suppress hydration errors for any fields with a date in it.

### 0.5.8 (April 3, 2025)
- You can now skip the onboarding page if desired.
- Added the UI to change user roles in the dashboard.
- Fixed an issue where integrations would throw instead of loading properly.
- Loading the ACL page no longer spams blank updates to the Headscale database (fixes [#151](https://github.com/tale/headplane/issues/151))
- Automatically create `/var/lib/headplane` in the Docker container (fixes [#166](https://github.com/tale/headplane/issues/166))
- OIDC logout with `disable_api_key_login` set to true will not automatically login again (fixes [#149](https://github.com/tale/headplane/issues/149))

### 0.5.7 (April 2, 2025)
- Hotfix an issue where assets aren't served under `/admin` or the prefix.

### 0.5.6 (April 2, 2025)

### IMPORTANT
> **PLEASE** update to this ASAP if you were using Google OIDC. This is because previously *ANY* accounts have admin access to your Tailnet if they discover the URL that Headplane is being hosted on. This new change enforces that new logins by default are not given any permissions. You will need to re-login to Headplane to generate an owner account and prevent unauthorized access.

Implemented *proper* authentication methods for OIDC.
This is a large update and copies the permission system from Tailscale.
Permissions are not automatically derived from OIDC, but they can be configured via the UI.
Additionally, certain roles give certain capabilities, limiting access to parts of the dashboard.
By default, new users will have a `member` role which forbids access to the UI.
If there are no users, the first user will be given an `owner` role which cannot be removed.

**Changes**:
- Switched the internal server to use `hono` for better performance.
- Fixed an issue that caused dialogs to randomly refocus every 3 seconds.
- Headplane will not send API requests when the tab is not focused.
- Continue loosening the configuration requirements for Headscale (part of an ongoing effort).
- Unknown values in the Headplane config no longer cause a crash.
- Fixed an issue that caused copied commands to have a random space (fixes [#161](https://github.com/tale/headplane/issues/161))

### 0.5.5 (March 18, 2025)
- Hotfix an issue that caused Headplane to crash if no agents are available

### 0.5.4 (March 18, 2025)
- Fixed a typo in the Kubernetes documentation
- Handle split and global DNS records not being set in the Headscale config (via [#129](https://github.com/tale/headplane/pull/129))
- Stop checking for the `mkey:` prefix on machine registration (via [#131](https://github.com/tale/headplane/pull/131))
- OIDC auth was not using information from the `user_info` endpoint.
- Support the picture of the user who is logged in via OIDC if available.
- Rewrote the Agent implementation to better utilize disk space and perform better (coming soon).
- Loosened checking for the Headscale configuration as it was too strict and required certain optional fields.
- Deleting a node will now correctly redirect back to the nodes page (fixes [#137](https://github.com/tale/headplane/issues/137))
- Supports connecting to Headscale via TLS and can accept a certificate file (partially fixes [#82](https://github.com/tale/headplane/issues/82))
- Add support for running Headplane through Nix, though currently unsupported (via [#132](https://github.com/tale/headplane/pull/132))
- You can now pass in an OIDC client secret through `oidc.client_secret_path` in the config (fixes [#126](https://github.com/tale/headplane/issues/126))
- Correctly handle differently localized number inputs (fixes [#125](https://github.com/tale/headplane/issues/125))

### 0.5.3 (March 1, 2025)
- Fixed an issue where Headplane expected the incorrect config value for OIDC scope (fixes [#111](https://github.com/tale/headplane/issues/111))
- Added an ARIA indicator for when an input is required and fixed the confirm buttons (fixed [#116](https://github.com/tale/headplane/issues/116))
- Fixed a typo in the docs that defaulted to `/var/run/docker.dock` for the Docker socket (via [#112](https://github.com/tale/headplane/pull/112))

### 0.5.2 (February 28, 2025)
- Hotfixed an issue where the server bundle got reloaded on each request

### 0.5.1 (February 28, 2025)
- Fixed an issue that caused the entire server to crash on start
- Fixed the published semver tags from Docker
- Fixed the Kubernetes integration not reading the config

### 0.5 (February 27, 2025)
> This release is a major overhaul and contains a significant breaking change.
> We now use a config file for all settings instead of environment variables.
> Please see [config.example.yaml](/config.example.yaml) for the new format.

- Completely redesigned the UI from the ground up for accessibility and performance.
- Switched to a config-file setup (this introduces breaking changes, see [config.example.yaml](/config.example.yaml) for the new format).
- If the config is read-only, the options are still visible, just disabled (fixes [#48](https://github.com/tale/headplane/issues/48))
- Added support for Headscale 0.25.0 (this drops support for any older versions).
- Fixed issues where renaming, deleting, and changing node owners via users was not possible (fixes [#91](https://github.com/tale/headplane/issues/91))
- Operations now have significantly less moving parts and better error handling.
- Updated to `pnpm` 10 and Node.js 22.
- Settings that were previously shared like `public_url` or `oidc` are now separate within Headplane/Headscale. This is a rather large breaking change but fixes cases where a user may choose to utilize Headscale OIDC for Tailscale but not for the Headplane UI.
- Deprecate the `latest` tag in Docker for explicit versioning and `edge` for nightly builds.

### 0.4.1 (January 18, 2025)
- Fixed an urgent issue where the OIDC redirect URI would mismatch.

### 0.4.0 (January 18, 2025)
- Switched from Remix.run to React-Router
- Fixed an issue where some config fields were marked as required even if they weren't (fixes [#66](https://github.com/tale/headplane/issues/66))
- Fixed an issue where the toasts would be obscured by the footer (fixes [#68](https://github.com/tale/headplane/issues/68))
- The footer now blurs your Headscale URL as a privacy measure
- Updated to the next stable beta of the React Compiler
- Changed `/healthz` to use a well-known endpoint instead of trying an invalid API key
- Support `OIDC_REDIRECT_URI` to force a specific redirect URI
- Redo the OIDC integration for better error handling and configuration
- Gracefully handle when Headscale is unreachable instead of crashing the dashboard
- Reusable Pre-Auth Keys no longer show expired when used (PR [#88](https://github.com/tale/headplane/pull/88))
- Tweaked some CSS issues in the UI

### 0.3.9 (December 6, 2024)
- Fixed a race condition bug in the OIDC validation code

### 0.3.8 (December 6, 2024)
- Added a little HTML footer to show the login page and link to a donation page.
- Allow creating pre-auth keys that expire past 90 days (fixes [#58](https://github.com/tale/headplane/issues/58))
- Validates OIDC config and ignores validation if specified via variables or Headscale config (fixes [#63](https://github.com/tale/headplane/issues/63))

### 0.3.7 (November 30, 2024)
- Allow customizing the OIDC token endpoint auth method via `OIDC_CLIENT_SECRET_METHOD` (fixes [#57](https://github.com/tale/headplane/issues/57))
- Added a `/healthz` endpoint for Kubernetes and other health checks (fixes [#59](https://github.com/tale/headplane/issues/59))
- Allow `HEADSCALE_PUBLIC_URL` to be set if `HEADSCALE_URL` points to a different internal address (fixes [#60](https://github.com/tale/headplane/issues/60))
- Fixed an issue where the copy machine registration command had a typo.

### 0.3.6 (November 20, 2024)
- Fixed an issue where select dropdowns would not scroll (fixes [#53](https://github.com/tale/headplane/issues/53))
- Added a button to copy the machine registration command to the clipboard (fixes [#52](https://github.com/tale/headplane/issues/52))

### 0.3.5 (November 8, 2024)
- Quickfix a bug where environment variables are ignored on the server.
- Remove a nagging error about missing cookie since that happens when signed out.

### 0.3.4 (November 7, 2024)
- Clicking on the machine name in the users page now takes you to the machine overview page.
- Completely rebuilt the production server to work better outside of Docker and be lighter. More specifically, we've switched from the `@remix-run/serve` package to our own custom built server.
- Fixed a bunch of silly issues introduced by me not typechecking the codebase.
- Improve documentation and support when running Headplane outside of Docker.
- Removing Split DNS records will no longer result in an error (fixes [#40](https://github.com/tale/headplane/issues/40))
- Removing the last ACL tag on a machine no longer results in an error (fixes [#41](https://github.com/tale/headplane/issues/41))
- Added full support for Exit Nodes in the UI and redesigned the machines page (fixes [#36](https://github.com/tale/headplane/issues/36))
- Added a basic check to see if the API keys passed via cookies are invalid.

### 0.3.3 (October 28, 2024)
- Added the ability to load a `.env` file from the PWD when `LOAD_ENV_FILE=true` is set as an environment variable.
- Fixed an issue where non-English languages could not create Pre-auth keys due to a localization error
- Improved ACL editor performance by switching back to CodeMirror 6
- Fixed an issue where editing the ACL policy would cause it to revert on the UI (fixes [#34](https://github.com/tale/headplane/issues/34))
- Updated to the next stable beta of the React 19 Compiler ([See More](https://react.dev/learn/react-compiler))

### 0.3.2 (October 11, 2024)
- Implement the ability to create and expire pre-auth keys (fixes [#22](https://github.com/tale/headplane/issues/22))
- Fix machine registration not working as expected (fixes [#27](https://github.com/tale/headplane/issues/27))
- Removed more references to usernames in MagicDNS hostnames (fixes [#35](https://github.com/tale/headplane/issues/35))
- Handle `null` values on machine expiry when using a database like PostgreSQL.
- Use `X-Forwarded-Proto` and `Host` headers for building the OIDC callback URL.

### 0.3.1 (October 3, 2024)
- Fixed the Docker integration to properly support custom socket paths. This regressed at some point previously.
- Allow you to register a machine using machine keys (`nodekey:...`) on the machines page.
- Added the option for debug logs with the `DEBUG=true` environment variable.

### 0.3.0 (September 25, 2024)
- Bumped the minimum supported version of Headscale to 0.23.
- Updated the UI to respect `dns.use_username_in_magic_dns`.

### 0.2.4 (August 24, 2024)
- Removed ACL management from the integration since Headscale 0.23-beta2 now supports it natively.
- Removed the `ACL_FILE` environment variable since it's no longer needed.
- Introduce a `COOKIE_SECURE=false` environment variable to disable HTTPS requirements for cookies.
- Fixed a bug where removing Split DNS configurations would crash the UI.

### 0.2.3 (August 23, 2024)
- Change the minimum required version of Headscale to 0.23-beta2
- Support the new API policy mode for Headscale 0.23-beta1
- Switch to the new DNS configuration in Headscale 0.23-beta2 (fixes [#29](https://github.com/tale/headplane/issues/29))
- If OIDC environment variables are defined, don't use configuration file values (fixes [#24](https://github.com/tale/headplane/issues/24))

### 0.2.2 (August 2, 2024)
- Added a proper Kubernetes integration which utilizes `shareProcessNamespace` for PIDs.
- Added a new logger utility that shows categories, levels, and timestamps.
- Reimplemented the integration system to be more resilient and log more information.
- Fixed an issue where the /proc integration found `undefined` PIDs.

### 0.2.1 (July 7, 2024)
- Added the ability to manage custom DNS records on your Tailnet.
- ACL tags for machines are now able to be changed via the machine menu.
- Fixed a bug where the ACL editor did not show the diffs correctly.
- Fixed an issue that stopped the "Discard changes" button in the ACL editor from working.

### 0.2.0 (June 23, 2024)
- Fix the dropdown options for machines not working on the machines page.
- Add an option to change the machine owner in the dropdown (aside from the users page).

### 0.1.9 (June 2, 2024)
- Switch to Monaco editor with proper HuJSON and YAML syntax highlighting.
- Utilize magic DNS hostnames for the machine overview page.
- Fixed the expiry issue once and for all.
- Add a nightly build with the `ghcr.io/tale/headplane:edge` tag

### 0.1.8 (June 2, 2024)
- Built basic functionality for the machine overview page (by machine ID).
- Possibly fixed an issue where expiry disabled machines' timestamps weren't handled correctly.
- Prevent users from being deleted if they still have ownership of machines.
- Fixed some type issues where `Date` was being used instead of `string` for timestamps.

### 0.1.7 (May 30, 2024)
- Added support for the `HEADSCALE_INTEGRATION` variable to allow for advanced integration without Docker.
- Fixed a bug where the `expiry` field on the Headscale configuration could cause crashes.
- Made the strict configuration loader more lenient to allow for more flexibility.
- Added `HEADSCALE_CONFIG_UNSTRICT`=true to revert back to a weaker configuration loader.
- Headplane's context now only loads once at start instead of being lazy-loaded.
- Improved logging and error propagation so that it's easier to debug issues.

### 0.1.6 (May 22, 2024)
- Added experimental support for advanced integration without Docker.
- Fixed a crash where the Docker integration tried to use `process.env.API_KEY` instead of context.
- Fixed a crash where `ROOT_API_KEY` was not respected in the OIDC flow.

### 0.1.5 (May 20, 2024)
- Robust configuration handling with fallbacks based on the headscale source.
- Support for `client_secret_path` on configuration file based OIDC.
- `DISABLE_API_KEY_LOGIN` now works as expected (non 'true' values work).
- `API_KEY` is renamed to `ROOT_API_KEY` for better clarity (old variable still works).
- Fixed button responders not actually being invoked (should fix the ACL page).

### 0.1.4 (May 15, 2024)

- Users can now be created, renamed, and deleted on the users page.
- Machines can be dragged between users to change their ownership.
- The login page actually respects the `DISABLE_API_KEY_LOGIN` variable.
- Implemented some fixes that should stop dialogs from hanging a webpage.
- Upgrade to React 19 beta to take advantage of the compiler (may revert if it causes issues).
- Upgrade other dependencies

### 0.1.3 (May 4, 2024)

- Switched to a better icon set for the UI.
- Support stable scrollbar gutter if supported by the browser.
- Cleaned up the header which fixed a bug that could crash the entire application on fetch errors.

### 0.1.2 (May 1, 2024)

- Added support for renaming, expiring, removing, and managing the routes of a machine.
- Implemented an expiry check for machines which now reflect on the machine table.
- Fixed an issue where `HEADSCALE_CONTAINER` was needed to start even without the Docker integration.
- Removed the requirement for the root `API_KEY` unless OIDC was being used for authentication.
- Switched to [React Aria](https://react-spectrum.adobe.com/react-aria/) for better accessibility support.
- Cleaned up various different UI inconsistencies and copied components that could've been abstracted.
- Added a changelog for any new versions going forward.
