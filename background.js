// SPeecHIT Background Script (Service Worker)

// Initialize settings on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get([
    "instantRead",
    "showFloatingController",
    "readingSpeed",
    "voiceName",
    "theme"
  ], (result) => {
    const defaults = {
      instantRead: true,
      showFloatingController: true,
      readingSpeed: 1.0,
      voiceName: "",
      theme: "dark"
    };

    const updates = {};
    for (const key in defaults) {
      if (result[key] === undefined) {
        updates[key] = defaults[key];
      }
    }

    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates, () => {
        console.log("SPeecHIT default settings initialized:", updates);
      });
    }
  });

  // Create right-click context menu for selection text
  chrome.contextMenus.create({
    id: "speechit-read-selection",
    title: "Read with SPeecHIT",
    contexts: ["selection"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "speechit-read-selection") {
    const selectedText = info.selectionText;
    if (!selectedText) return;

    if (tab && tab.id) {
      // Try to send a message to the content script in the active tab
      chrome.tabs.sendMessage(tab.id, {
        action: "readSelectedText",
        text: selectedText
      }, (response) => {
        // Check for error (e.g. content script not loaded, native PDF viewer)
        if (chrome.runtime.lastError) {
          console.log("Content script not reachable, falling back to background TTS.");
          speakFromBackground(selectedText);
        }
      });
    } else {
      speakFromBackground(selectedText);
    }
  }
});

// Helper function to read from background using chrome.tts (for native PDF pages, etc.)
function speakFromBackground(text) {
  chrome.storage.local.get(["readingSpeed", "voiceName"], (settings) => {
    const rate = settings.readingSpeed || 1.0;
    const voiceName = settings.voiceName || "";

    const options = {
      rate: parseFloat(rate)
    };

    if (voiceName) {
      options.voiceName = voiceName;
    }

    // Stop any current background speech first
    chrome.tts.stop();
    chrome.tts.speak(text, options);
  });
}

// Handle cross-tab coordination and background requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "speechStarted") {
    // Stop any background TTS speech
    chrome.tts.stop();

    // Tell all other tabs to stop speaking (to prevent overlapping voice)
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id && tab.id !== sender.tab?.id) {
          chrome.tabs.sendMessage(tab.id, { action: "stopSpeech" }).catch(() => {
            // Ignore errors for tabs without content scripts
          });
        }
      });
    });
  } else if (message.action === "stopBackgroundSpeech") {
    chrome.tts.stop();
  }
});

// Automatically intercept PDF files and open them in SPeecHIT PDF Viewer
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    const url = changeInfo.url;
    // Check if the URL points to an online PDF file and is not already our viewer (local file:/// URLs cannot be fetched directly by extensions due to CORS)
    if (url.toLowerCase().includes(".pdf") && !url.toLowerCase().startsWith("file://") && !url.startsWith(chrome.runtime.getURL("pdf-viewer.html"))) {
      chrome.tabs.update(tabId, {
        url: chrome.runtime.getURL("pdf-viewer.html") + "#" + encodeURIComponent(url)
      });
    }
  }
});
