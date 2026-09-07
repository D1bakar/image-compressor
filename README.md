# TinyCompress

Browser-based image compression tool. Compress images directly in your browser with no uploads, no servers, and complete privacy.

## Features

- Drag-and-drop file upload
- File validation (JPEG, PNG, WebP, GIF, SVG)
- Maximum size selector (100KB, 250KB, 500KB, 1MB, 2MB, custom)
- Output format selector (JPEG, WebP, PNG)
- Quality binary search compression algorithm
- Before/after preview
- File size info (original, final, reduction %)
- Download button
- Mobile responsive
- Keyboard accessible

## Project Structure

```
tinycompress/
├── src/
│   ├── index.html      # Main application page
│   ├── styles.css      # All styling
│   ├── app.js          # File handling, compression, UI logic
│   ├── 404.html        # Error page
│   └── favicon.svg     # Favicon
├── tests/
│   └── tests.html      # Automated test runner
├── PROJECT_CONTEXT.md  # Project documentation
└── README.md           # This file
```

## Usage

1. Open `src/index.html` in a web browser
2. Drag and drop an image or click to browse
3. Select target size and output format
4. Click "Compress"
5. Download the compressed image

## Compression Algorithm

1. Binary search on quality (0.01 - 1.0)
2. If quality minimum reached and still too large:
   - Scale dimensions by 75%
   - Repeat quality search
3. Minimum scale: 25% of original

## Supported Formats

- **Input:** JPEG, PNG, WebP, GIF, SVG
- **Output:** JPEG, WebP, PNG (lossless)

## Development

No build tools required. Simply open the HTML files in a browser.

To run tests, open `tests/tests.html` in a browser and click "Run Tests".

## License

All compression happens locally in your browser. No data is sent to any server.
