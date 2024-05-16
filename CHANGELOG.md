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
