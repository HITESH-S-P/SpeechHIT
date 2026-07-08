# 🎙️ SPeecHIT - Selection Text-to-Speech Browser Extension

SPeecHIT is a modern, high-performance, glassmorphic browser extension compatible with Google Chrome, Microsoft Edge, Brave, and other Chromium-based browsers. It instantly reads selected text aloud the moment it is highlighted, featuring real-time speed adjustments, custom voice selection, a sleek floating control capsule, and a fully custom offline PDF reading workspace.

---

## 🌟 Key Features

*   **Instant Read on Selection:** Highlight any text on a webpage and SPeecHIT will immediately read it using the browser's speech synthesis engine.
*   **Sleek Floating Player:** An isolated glassmorphic overlay appears near your selection with play/pause, stop, speed cycling controls, and an animated audio wave visualizer.
*   **Pace Control (Speed):** Adjust speech rate on-the-fly from `0.5x` up to `3.0x` via the floating widget, settings popup, or the PDF workspace.
*   **Voice Customization:** Pick any browser-native voice (including Microsoft Edge's premium neural voices when running in Edge) via a sleek search dropdown.
*   **Integrated PDF Workspace:** A feature-rich local document reader powered by PDF.js. Simply drag and drop any PDF to render it with standard text-selection overlays for instant TTS reading.
*   **Cross-Tab Speech Coordination:** Automatically halts reading in other tabs when audio starts in a new tab to avoid overlapping speech.

---

## 📦 Installation

Since all dependencies (such as `PDF.js` libraries in `lib/`) and default logos/icons are already pre-packaged in the extension directory, installation takes less than a minute!

### Step 1: Load SPeecHIT in your Browser

1.  Open **Google Chrome**, **Microsoft Edge**, or any other Chromium browser.
2.  Navigate to the extensions manager page:
    *   **Chrome:** `chrome://extensions`
    *   **Edge:** `edge://extensions`
3.  Turn **ON** the **Developer mode** toggle (typically in the top-right corner or side menu).
4.  Click the **Load unpacked** button (usually in the top-left).
5.  Select the **`speechit`** folder inside this repository.
6.  *SPeecHIT is now installed!* Pin it to your browser toolbar for quick access.

### Step 2: Configure Local PDF Access (Recommended)

To read local PDF files directly from your computer:
1.  On the extension management page, click **Details** on the **SPeecHIT** card.
2.  Scroll down to find **Allow access to file URLs** and toggle it **ON**.

---

## 🚀 How to Use

### 1. Web Page Reading
*   Select text on any webpage.
*   If **Instant Read on Selection** is enabled in settings, SPeecHIT will start reading immediately.
*   A sleek floating control panel will appear near the selection. You can use it to:
    *   **Play / Pause** the speech.
    *   **Stop** the speech.
    *   **Cycle Speed** (`1.0x` ➔ `1.2x` ➔ `1.5x` ➔ `2.0x` ➔ `0.8x`).

### 2. Context Menu Reading
*   Right-click any selected text on a webpage.
*   Select **Read with SPeecHIT** from the context menu to read the text.

### 3. Settings Popup
*   Click the extension icon in the browser toolbar to:
    *   Toggle **Instant Read on Selection** on or off.
    *   Toggle the **Floating Controller** visibility.
    *   Fine-tune **Reading Speed** with a precision slider (`0.5x` - `3.0x`).
    *   Choose a preferred TTS **Voice** from the list of available system voices.

### 4. PDF Reader Workspace
1.  Open the settings popup and click **Open SPeecHIT PDF Reader** (or navigate to options).
2.  Drag and drop any PDF file into the workspace, or click **Browse Files** to open a file.
3.  Select any text within the PDF document to read it aloud instantly with the same controls.

---

## 🛠️ File Structure

*   [`manifest.json`](file:///d:/websites/SPeecHIT/speechit/manifest.json) - Extension configuration and metadata.
*   [`background.js`](file:///d:/websites/SPeecHIT/speechit/background.js) - Service worker handling initialization, context menus, and cross-tab stop communication.
*   [`content.js`](file:///d:/websites/SPeecHIT/speechit/content.js) & [`content.css`](file:///d:/websites/SPeecHIT/speechit/content.css) - Script and styles injected into web pages to detect selections and display the floating player.
*   [`popup.html`](file:///d:/websites/SPeecHIT/speechit/popup.html), [`popup.css`](file:///d:/websites/SPeecHIT/speechit/popup.css), & [`popup.js`](file:///d:/websites/SPeecHIT/speechit/popup.js) - The toolbar options/settings control UI.
*   [`pdf-viewer.html`](file:///d:/websites/SPeecHIT/speechit/pdf-viewer.html), [`pdf-viewer.css`](file:///d:/websites/SPeecHIT/speechit/pdf-viewer.css), & [`pdf-viewer.js`](file:///d:/websites/SPeecHIT/speechit/pdf-viewer.js) - The standalone PDF reader workspace.
*   [`lib/`](file:///d:/websites/SPeecHIT/speechit/lib) - Houses local copy of `pdf.min.js` and `pdf.worker.min.js` to ensure compliance with strict Manifest V3 remote code execution security guidelines.
*   [`icons/`](file:///d:/websites/SPeecHIT/speechit/icons) - Directory containing the application logos.
