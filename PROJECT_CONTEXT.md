Project: TinyCompress

Purpose:
Browser-based image compression to a user-selected maximum size.

Stack:
- HTML5
- CSS3
- Vanilla JavaScript (no frameworks)

Architecture:
Client-side only. Zero uploads. Zero servers.

Constraints:
- No backend
- No frameworks
- No external image upload
- Preserve image quality
- Final output must not exceed target size (except PNG)

Current features:
- Drag-and-drop file upload
- File validation (JPEG, PNG, WebP, GIF, SVG)
- Maximum size selector (100KB, 250KB, 500KB, 1MB, 2MB, custom)
- Output format selector (JPEG, WebP, PNG)
- v2 compression: quality binary search + dimension fallback
- Before/after preview
- File size info (original, final, reduction %)
- Download button
- Mobile responsive
- Keyboard accessible

Compression algorithm:
1. Binary search on quality (0.01 - 1.0)
2. If quality min reached and still too large:
   - Scale dimensions by 75%
   - Repeat quality search
3. Min scale: 25% of original

Supported formats:
- Input: JPEG, PNG, WebP, GIF, SVG
- Output: JPEG, WebP, PNG (lossless)

File structure:
- index.html (main page)
- styles.css (all styling)
- app.js (file handling, compression, UI logic)
- tests.html (automated test runner)
- 404.html (error page)

Known bugs:
None currently.
