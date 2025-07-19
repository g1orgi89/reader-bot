# Temporary rename for debugging

This folder was temporarily renamed from `mini-app` to `mini-app-disabled` to check if the Mini App files are causing the server startup issue.

If the server starts successfully after this rename, then the problem is in one of the Mini App files.

## Files that were in this folder:
- index.html
- manifest.json  
- service-worker.js
- css/, js/, assets/ folders
- Various config files

## Next steps:
1. Check if server starts with this folder renamed
2. If yes, identify the problematic file
3. Fix the specific issue
4. Rename back to `mini-app`
