# SPeecHIT - Selection Text-to-Speech Browser Extension

SPeecHIT is a modern, high-performance Chrome and Microsoft Edge compatible browser extension that instantly reads selected text aloud the moment it is highlighted. It features real-time speed adjustments, custom voice selection, a sleek floating control capsule, and a fully custom PDF reading workspace.

---

## Features

1. **Instant Selection Read:** Highlight any text on a webpage, and SPeecHIT will immediately speak it using the browser's speech synthesis engine.
2. **Sleek Floating Player:** An isolated glassmorphic overlay appears near your selection with play, pause, stop, speed cycling buttons, and an animated audio wave visualizer.
3. **Pace Control:** Speed can be adjusted on-the-fly from the floating widget or settings popup in steps from `0.5x` up to `3.0x`.
4. **Voice Customization:** Pick any browser-native voice (including Edge's premium neural voices if running in Microsoft Edge) from a sleek search dropdown.
5. **SPeecHIT PDF Reader:** An integrated document reader page powered by PDF.js. Drag and drop any PDF to render it with a standard HTML text-selection overlay.
6. **Cross-Tab Control:** Speech is coordinated globally so that playing audio in one tab automatically halts reading in other tabs.

---

## Installation & Setup

Because browser extensions cannot load remote CDN scripts (under Manifest V3 security rules) and must contain local icon files, you will need to run two quick PowerShell setup scripts included in the root directory.

### Step 1: Initialize Files (Download PDF.js & Generate Icons)

Open a **PowerShell** window in the project directory (`d:\websites\aiAgency\AI-customer-support`) and execute the following two commands:

1. **Download PDF.js files locally:**
   ```powershell
   .\download_pdfjs.ps1
   ```
   *This downloads the standard pre-compiled `pdf.min.js` and `pdf.worker.min.js` into the `speechit/lib` directory.*

2. **Generate PNG icons:**
   ```powershell
   .\generate_icons.ps1
   ```
   *This generates clean logo icons (`icon16.png`, `icon48.png`, `icon128.png`) in the `speechit/icons` directory using native Windows graphics components.*

---

### Step 2: Load SPeecHIT in your Browser

1. Open **Google Chrome** or **Microsoft Edge**.
2. Navigate to the extension management page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
3. Toggle the **Developer mode** switch (usually found in the top-right corner or left sidebar).
4. Click **Load unpacked** (top-left).
5. Select the **`speechit`** folder inside the workspace.
6. SPeecHIT is now installed! Pin the extension to your toolbar for easy access.

---

## PDF Document Setup (Highly Recommended)

### Read Local PDFs (`file://` URLs)
To read local PDF files from your computer:
1. Go to `chrome://extensions` (or `edge://extensions`).
2. Click **Details** on the **SPeecHIT** extension card.
3. Scroll down and turn ON **Allow access to file URLs**.

### How to use the PDF Reader Workspace
1. Click the SPeecHIT extension icon in the toolbar to open the settings popup.
2. Click **Open SPeecHIT PDF Reader**.
3. Drag and drop any PDF file into the dropzone or click **Browse Files** to open a file.
4. Highlight text inside the PDF page to hear it spoken instantly!
