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
