### 0.1.2 (May 1, 2024)

- Added support for renaming, expiring, removing, and managing the routes of a machine.
- Implemented an expiry check for machines which now reflect on the machine table.
- Fixed an issue where `HEADSCALE_CONTAINER` was needed to start even without the Docker integration.
- Removed the requirement for the root `API_KEY` unless OIDC was being used for authentication.
- Switched to [React Aria](https://react-spectrum.adobe.com/react-aria/) for better accessibility support.
- Cleaned up various different UI inconsistencies and copied components that could've been abstracted.
- Added a changelog for any new versions going forward.
