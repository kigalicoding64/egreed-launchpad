# Fix workspace preview and live updates

## Changes
- Give every live-update subscriber a stable, unique channel name so nested workspace views cannot reuse an open channel.
- Track connection state, remove each channel on unmount or retry, and expose an in-place retry action on the workspace page.
- Preserve the workspace editor and current file while reconnecting; refresh relevant project, deployment, and domain data after reconnection.
- Show preview build failures inside the preview area with a one-click retry instead of relying only on a temporary notification.
- Replace vague repository failures with actionable guidance covering private repositories, missing branches, and missing account permissions; distinguish missing uploaded files and explain re-uploading them.

## Technical details
- Extend the existing live-update hook with a per-instance channel ID, subscription status handling, cleanup, and retry generation.
- Surface connection status from the dashboard shell only on workspace URLs.
- Store the last preview error in the preview component and clear it after a successful rebuild.
- Preserve server-side error details through the existing preview server function.

## Verification
- Check the current build result and TypeScript validation.
- Open the authenticated workspace, confirm it no longer crashes with nested subscribers, force/retry preview builds, and verify the failure guidance and retry controls render correctly.
