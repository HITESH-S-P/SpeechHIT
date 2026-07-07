// SPeecHIT PDF Viewer Workspace JavaScript

const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const dropzone = document.getElementById("pdf-dropzone");
  const fileInput = document.getElementById("pdf-file-input");
  const btnBrowseFile = document.getElementById("btn-browse-file");
  const btnBrowseHeader = document.getElementById("btn-browse-header");
  const btnClosePdf = document.getElementById("btn-close-pdf");
  const activeFilename = document.getElementById("active-filename");
  const fileStatus = document.querySelector(".file-status");
  const viewerContainer = document.getElementById("pdf-viewer-container");
  const loadingOverlay = document.getElementById("loading-overlay");
  
  const voiceSelect = document.getElementById("workspace-voice-select");
  const speedDisplay = document.getElementById("workspace-speed-display");
  const btnSpeedDown = document.getElementById("btn-speed-down");
  const btnSpeedUp = document.getElementById("btn-speed-up");

  // Speech State Variables
  let currentText = "";
  let currentUtterance = null;
  let isSpeaking = false;
  let isPaused = false;
  let activeSpeed = 1.0;
  let activeVoiceName = "";
  let instantReadEnabled = true;

  // Floating Player Elements (for PDF viewer page selection)
  let floatingPlayer = null;
  let playBtn = null;
  let stopBtn = null;
  let floatingSpeedBtn = null;
  let visualizerElement = null;

  // Context validation helpers to handle extension updates/reloads gracefully
  function isContextValid() {
    return typeof chrome !== "undefined" && typeof chrome.runtime !== "undefined" && !!chrome.runtime.id;
  }

  function checkAndCleanUpContext() {
    if (!isContextValid()) {
      viewerContainer.removeEventListener("mouseup", handleSelection);
      viewerContainer.removeEventListener("keyup", handleSelection);
      document.removeEventListener("mousedown", handleDocumentClick);
      
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}

      hideFloatingPlayer();
      showReloadBanner();
      return false;
    }
    return true;
  }

  function showReloadBanner() {
    if (document.getElementById("speechit-reload-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "speechit-reload-overlay";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(15, 23, 42, 0.9)";
    overlay.style.backdropFilter = "blur(8px)";
    overlay.style.zIndex = "999999";
    overlay.style.display = "flex";
    overlay.style.flexDirection = "column";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.color = "#fff";
    overlay.style.fontFamily = "'Plus Jakarta Sans', sans-serif";

    overlay.innerHTML = `
      <div style="text-align: center; max-width: 400px; padding: 32px; background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.5);">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px;">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">Extension Context Invalidated</h2>
        <p style="font-size: 14px; color: #94a3b8; margin-bottom: 24px; line-height: 1.5;">SPeecHIT has been reloaded or updated. Please refresh the page to restore PDF reader functionality.</p>
        <button id="btn-reload-page" style="background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%); color: white; border: none; padding: 10px 24px; border-radius: 9999px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; font-size: 14px; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);">
          Reload Page
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    const reloadBtn = document.getElementById("btn-reload-page");
    if (reloadBtn) {
      reloadBtn.addEventListener("click", () => {
        window.location.reload();
      });
    }
  }

  // Initial Sync from Storage
  if (isContextValid() && chrome.storage?.local) {
    try {
      chrome.storage.local.get(["readingSpeed", "voiceName", "instantRead"], (settings) => {
        if (!settings) return;
        activeSpeed = settings.readingSpeed || 1.0;
        activeVoiceName = settings.voiceName || "";
        instantReadEnabled = settings.instantRead !== false;

        updateSpeedDisplay();
        initVoices(activeVoiceName);
      });
    } catch (e) {
      console.warn("SPeecHIT PDF Viewer: Failed to load settings from storage", e);
    }
  }

  // Sync settings dynamically
  if (isContextValid()) {
    try {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "local") {
          if (changes.instantRead) instantReadEnabled = changes.instantRead.newValue !== false;
          if (changes.readingSpeed) {
            activeSpeed = changes.readingSpeed.newValue || 1.0;
            updateSpeedDisplay();
          }
          if (changes.voiceName) {
            activeVoiceName = changes.voiceName.newValue || "";
            if (voiceSelect) {
              voiceSelect.value = activeVoiceName;
            }
          }
        }
      });
    } catch (e) {
      console.warn("SPeecHIT PDF Viewer: Failed to register settings change listener", e);
    }
  }

  // Check if there is an auto-loaded PDF file in the URL hash
  const hashUrl = location.hash ? decodeURIComponent(location.hash.slice(1)) : "";
  if (hashUrl) {
    loadPdfFromUrl(hashUrl);
  }

  // Voice dropdown change
  voiceSelect.addEventListener("change", () => {
    if (!checkAndCleanUpContext()) return;
    activeVoiceName = voiceSelect.value;
    if (isContextValid() && chrome.storage?.local) {
      try {
        chrome.storage.local.set({ voiceName: activeVoiceName });
      } catch (e) {
        console.warn("SPeecHIT PDF Viewer: Failed to save voiceName setting", e);
      }
    }
    if (isSpeaking) {
      speakSelectedText(currentText);
    }
  });

  // Speed controls
  btnSpeedDown.addEventListener("click", () => {
    adjustSpeed(-0.1);
  });

  btnSpeedUp.addEventListener("click", () => {
    adjustSpeed(0.1);
  });

  function adjustSpeed(delta) {
    if (!checkAndCleanUpContext()) return;
    activeSpeed = Math.min(3.0, Math.max(0.5, parseFloat((activeSpeed + delta).toFixed(2))));
    if (isContextValid() && chrome.storage?.local) {
      try {
        chrome.storage.local.set({ readingSpeed: activeSpeed });
      } catch (e) {
        console.warn("SPeecHIT PDF Viewer: Failed to save readingSpeed setting", e);
      }
    }
    updateSpeedDisplay();
    if (isSpeaking) {
      speakSelectedText(currentText);
    }
  }

  function updateSpeedDisplay() {
    speedDisplay.textContent = activeSpeed.toFixed(1) + "x";
    if (floatingSpeedBtn) {
      floatingSpeedBtn.textContent = activeSpeed.toFixed(2) + "x";
    }
  }

  // Browse File Triggers
  btnBrowseFile.addEventListener("click", () => fileInput.click());
  btnBrowseHeader.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", handleFileSelect);

  // Close File Trigger
  btnClosePdf.addEventListener("click", closeDocument);

  // Drag and drop event listeners
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("dragover");
  });

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      processFile(file);
    } else {
      alert("Please upload a valid PDF file.");
    }
  });

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      processFile(file);
    }
  }

  // Load file and convert to ArrayBuffer
  function processFile(file) {
    showLoading(true, "Opening PDF file...");
    
    // Update Header info
    fileStatus.style.display = "none";
    activeFilename.textContent = file.name;
    activeFilename.style.display = "inline";
    btnBrowseHeader.style.display = "none";
    btnClosePdf.style.display = "inline-block";

    const fileReader = new FileReader();
    fileReader.onload = function(e) {
      const typedArray = new Uint8Array(e.target.result);
      renderDocument(typedArray);
    };
    fileReader.readAsArrayBuffer(file);
  }

  // Load PDF from a network or local URL
  async function loadPdfFromUrl(url) {
    showLoading(true, "Downloading PDF...");
    
    // Update Header info
    fileStatus.style.display = "none";
    const filename = url.substring(url.lastIndexOf("/") + 1).split("?")[0] || "document.pdf";
    activeFilename.textContent = filename;
    activeFilename.style.display = "inline";
    btnBrowseHeader.style.display = "none";
    btnClosePdf.style.display = "inline-block";

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const typedArray = new Uint8Array(arrayBuffer);
      renderDocument(typedArray);
    } catch (error) {
      console.error("Failed to load PDF from URL:", error);
      showLoading(false);
      
      if (url.startsWith("file:///")) {
        alert("To view local PDF files, please ensure SPeecHIT has 'Allow access to file URLs' enabled on your Chrome Extensions page (chrome://extensions).");
      } else {
        alert(`Failed to load PDF: ${error.message}. (Note: Cross-Origin Resource Sharing [CORS] must be enabled on the hosting server).`);
      }
      closeDocument();
    }
  }

  // Parse and render the PDF document
  async function renderDocument(typedArray) {
    showLoading(true, "Parsing pages...");
    viewerContainer.innerHTML = "";
    stopSpeechPlayback();

    try {
      const pdf = await pdfjsLib.getDocument(typedArray).promise;
      showLoading(true, `Loading ${pdf.numPages} pages...`);

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        showLoading(true, `Rendering page ${pageNum} of ${pdf.numPages}...`);
        const page = await pdf.getPage(pageNum);
        await renderPage(page, pageNum);
      }

      // Hide dropzone, show viewer
      dropzone.style.display = "none";
      viewerContainer.style.display = "flex";
      showLoading(false);
    } catch (error) {
      console.error("Error rendering PDF:", error);
      alert("Failed to render PDF. Please verify the file is not corrupted.");
      closeDocument();
    }
  }

  // Render a single PDF page (Canvas + text layer overlay)
  async function renderPage(page, pageNum) {
    // Page Container
    const pageContainer = document.createElement("div");
    pageContainer.className = "pdf-page-container";
    pageContainer.dataset.pageNumber = pageNum;

    // Viewport setup (standard scale 1.5)
    const viewport = page.getViewport({ scale: 1.5 });
    
    // Canvas setup
    const canvas = document.createElement("canvas");
    canvas.className = "pdf-canvas";
    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    pageContainer.appendChild(canvas);
    pageContainer.style.width = `${viewport.width}px`;
    pageContainer.style.height = `${viewport.height}px`;

    // Render Canvas
    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };
    await page.render(renderContext).promise;

    // Render HTML Text Layer Overlay
    const textLayerDiv = document.createElement("div");
    textLayerDiv.className = "textLayer";
    pageContainer.appendChild(textLayerDiv);

    try {
      const textContent = await page.getTextContent();
      const textLayer = new pdfjsLib.TextLayer({
        container: textLayerDiv,
        textContentSource: textContent,
        viewport: viewport
      });
      await textLayer.render();
    } catch (e) {
      console.error("Text layer render failed for page", pageNum, e);
    }

    viewerContainer.appendChild(pageContainer);
  }

  function closeDocument() {
    stopSpeechPlayback();
    hideFloatingPlayer();
    
    viewerContainer.innerHTML = "";
    viewerContainer.style.display = "none";
    dropzone.style.display = "block";
    fileInput.value = "";

    fileStatus.style.display = "inline";
    activeFilename.style.display = "none";
    btnBrowseHeader.style.display = "inline-block";
    btnClosePdf.style.display = "none";

    showLoading(false);
  }

  function showLoading(show, text = "") {
    if (show) {
      loadingOverlay.querySelector(".loading-text").textContent = text;
      loadingOverlay.style.display = "flex";
    } else {
      loadingOverlay.style.display = "none";
    }
  }

  // Handle Text Selection inside rendered text layers
  viewerContainer.addEventListener("mouseup", handleSelection);
  viewerContainer.addEventListener("keyup", handleSelection);
  document.addEventListener("mousedown", handleDocumentClick);

  function handleSelection(e) {
    if (!checkAndCleanUpContext()) return;
    if (floatingPlayer && floatingPlayer.contains(e.target)) return;

    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (!text) return;

    if (text === currentText && floatingPlayer && floatingPlayer.style.display !== "none") {
      return;
    }

    currentText = text;
    showFloatingPlayerAtSelection();

    if (instantReadEnabled) {
      speakSelectedText(currentText);
    }
  }

  function handleDocumentClick(e) {
    if (!checkAndCleanUpContext()) return;
    if (floatingPlayer && floatingPlayer.contains(e.target)) return;

    setTimeout(() => {
      if (!checkAndCleanUpContext()) return;
      const selection = window.getSelection();
      if (selection.toString().trim() === "") {
        stopSpeechPlayback();
        hideFloatingPlayer();
      }
    }, 100);
  }

  // Voice player functions
  function speakSelectedText(text) {
    const synth = window.speechSynthesis;
    
    synth.cancel();
    isSpeaking = false;
    isPaused = false;
    updateUIState();

    // Notify other tabs via background to stop playing
    if (isContextValid()) {
      try {
        chrome.runtime.sendMessage({ action: "speechStarted" });
      } catch (e) {
        console.warn("SPeecHIT PDF Viewer: Failed to send speechStarted message", e);
      }
    }

    // Small delay to allow the browser synthesis engine to fully cancel and reset
    setTimeout(() => {
      currentUtterance = new SpeechSynthesisUtterance(text);
      currentUtterance.rate = activeSpeed;

      if (activeVoiceName) {
        const voices = synth.getVoices();
        const voice = voices.find(v => v.name === activeVoiceName);
        if (voice) {
          currentUtterance.voice = voice;
        }
      }

      currentUtterance.onstart = () => {
        isSpeaking = true;
        isPaused = false;
        updateUIState();
      };

      currentUtterance.onend = () => {
        isSpeaking = false;
        isPaused = false;
        updateUIState();
      };

      currentUtterance.onerror = (err) => {
        if (err.error !== "interrupted") {
          console.error("Speech error:", err);
        }
        isSpeaking = false;
        isPaused = false;
        updateUIState();
      };

      currentUtterance.onpause = () => {
        isSpeaking = false;
        isPaused = true;
        updateUIState();
      };

      currentUtterance.onresume = () => {
        isSpeaking = true;
        isPaused = false;
        updateUIState();
      };

      synth.speak(currentUtterance);
    }, 100);
  }

  function togglePlayPause() {
    const synth = window.speechSynthesis;
    if (synth.speaking) {
      if (synth.paused) {
        synth.resume();
      } else {
        synth.pause();
      }
    } else if (currentText) {
      speakSelectedText(currentText);
    }
  }

  function stopSpeechPlayback() {
    window.speechSynthesis.cancel();
    isSpeaking = false;
    isPaused = false;
    updateUIState();
    if (isContextValid()) {
      try {
        chrome.runtime.sendMessage({ action: "stopBackgroundSpeech" });
      } catch (e) {
        console.warn("SPeecHIT PDF Viewer: Failed to send stopBackgroundSpeech message", e);
      }
    }
  }

  // Cycle speed for floating selector
  function cycleSpeed() {
    const speeds = [1.0, 1.25, 1.5, 1.75, 2.0, 0.75];
    let currentIndex = speeds.indexOf(activeSpeed);
    if (currentIndex === -1) currentIndex = 0;
    
    const nextIndex = (currentIndex + 1) % speeds.length;
    activeSpeed = speeds[nextIndex];

    if (isContextValid() && chrome.storage?.local) {
      try {
        chrome.storage.local.set({ readingSpeed: activeSpeed });
      } catch (e) {
        console.warn("SPeecHIT PDF Viewer: Failed to save readingSpeed setting", e);
      }
    }
    updateSpeedDisplay();

    if (window.speechSynthesis.speaking) {
      speakSelectedText(currentText);
    }
  }

  // Floating Player Management
  function createFloatingPlayer() {
    if (floatingPlayer) return;

    floatingPlayer = document.createElement("div");
    floatingPlayer.className = "speechit-player-workspace";
    floatingPlayer.style.position = "absolute";
    floatingPlayer.style.zIndex = "2000";
    
    // Visual layout (matching the popup & floating controller)
    floatingPlayer.innerHTML = `
      <div class="player-content-workspace">
        <button class="control-btn play-btn" title="Play/Pause">
          <svg class="icon-play" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          <svg class="icon-pause" viewBox="0 0 24 24" fill="currentColor" style="display:none;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        </button>
        <button class="control-btn stop-btn" title="Stop">
          <svg class="icon-stop" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>
        </button>
        <button class="speed-btn" title="Reading speed">${activeSpeed.toFixed(2)}x</button>
        <div class="visualizer">
          <div class="v-bar v-bar-1"></div>
          <div class="v-bar v-bar-2"></div>
          <div class="v-bar v-bar-3"></div>
          <div class="v-bar v-bar-4"></div>
        </div>
      </div>
    `;

    document.body.appendChild(floatingPlayer);

    // Apply specific styles for workspace floating controls (inlining to avoid complex import rules)
    const style = document.createElement("style");
    style.textContent = `
      .speechit-player-workspace {
        font-family: 'Plus Jakarta Sans', sans-serif;
        background-color: hsla(224, 25%, 12%, 0.95);
        border: 1px solid hsla(210, 20%, 98%, 0.15);
        border-radius: 22px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        padding: 6px 12px;
        height: 44px;
        pointer-events: auto;
      }
      .player-content-workspace {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 100%;
      }
      .speechit-player-workspace .control-btn {
        background: none;
        border: none;
        color: #fff;
        cursor: pointer;
        padding: 6px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        transition: all 0.2s ease;
      }
      .speechit-player-workspace .control-btn:hover {
        background-color: rgba(255,255,255,0.1);
        color: #00f2fe;
      }
      .speechit-player-workspace .stop-btn:hover {
        color: #ef4444;
      }
      .speechit-player-workspace .control-btn svg {
        width: 14px;
        height: 14px;
      }
      .speechit-player-workspace .speed-btn {
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px;
        color: #00f2fe;
        cursor: pointer;
        font-size: 11px;
        font-weight: 700;
        padding: 4px 8px;
        transition: all 0.2s ease;
      }
      .speechit-player-workspace .speed-btn:hover {
        background: rgba(0, 242, 254, 0.1);
      }
      .speechit-player-workspace .visualizer {
        display: flex;
        align-items: flex-end;
        gap: 3px;
        height: 14px;
        width: 24px;
      }
      .speechit-player-workspace .v-bar {
        width: 3px;
        background-color: #64748b;
        border-radius: 1px;
        height: 4px;
      }
      .speechit-player-workspace .visualizer.animating .v-bar-1 { background-color: #a855f7; animation: wave 0.7s infinite alternate; }
      .speechit-player-workspace .visualizer.animating .v-bar-2 { background-color: #6366f1; animation: wave 0.9s infinite alternate; }
      .speechit-player-workspace .visualizer.animating .v-bar-3 { background-color: #00f2fe; animation: wave 0.6s infinite alternate; }
      .speechit-player-workspace .visualizer.animating .v-bar-4 { background-color: #a855f7; animation: wave 0.8s infinite alternate; }
      
      @keyframes wave {
        0% { height: 3px; }
        100% { height: 14px; }
      }
    `;
    document.head.appendChild(style);

    // Bindings
    playBtn = floatingPlayer.querySelector(".play-btn");
    stopBtn = floatingPlayer.querySelector(".stop-btn");
    floatingSpeedBtn = floatingPlayer.querySelector(".speed-btn");
    visualizerElement = floatingPlayer.querySelector(".visualizer");

    playBtn.addEventListener("click", togglePlayPause);
    stopBtn.addEventListener("click", stopSpeechPlayback);
    floatingSpeedBtn.addEventListener("click", cycleSpeed);
  }

  function showFloatingPlayerAtSelection() {
    const selection = window.getSelection();
    if (selection.isCollapsed) return;

    createFloatingPlayer();

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    const playerWidth = 150;
    const playerHeight = 44;

    let x = rect.left + rect.width / 2 - playerWidth / 2 + window.scrollX;
    let y = rect.bottom + window.scrollY + 10;

    if (x < 10) x = 10;
    if (x + playerWidth > window.innerWidth - 10) {
      x = window.innerWidth - playerWidth - 10;
    }
    if (rect.bottom + playerHeight + 20 > window.innerHeight) {
      y = rect.top + window.scrollY - playerHeight - 10;
    }

    floatingPlayer.style.left = `${x}px`;
    floatingPlayer.style.top = `${y}px`;
    floatingPlayer.style.display = "block";

    if (floatingSpeedBtn) {
      floatingSpeedBtn.textContent = activeSpeed.toFixed(2) + "x";
    }

    updateUIState();
  }

  function hideFloatingPlayer() {
    if (floatingPlayer) {
      floatingPlayer.style.display = "none";
    }
  }

  function updateUIState() {
    if (!floatingPlayer) return;

    const iconPlay = floatingPlayer.querySelector(".icon-play");
    const iconPause = floatingPlayer.querySelector(".icon-pause");

    if (isSpeaking) {
      if (iconPlay) iconPlay.style.display = "none";
      if (iconPause) iconPause.style.display = "block";
      if (visualizerElement) visualizerElement.classList.add("animating");
    } else {
      if (iconPlay) iconPlay.style.display = "block";
      if (iconPause) iconPause.style.display = "none";
      if (visualizerElement) visualizerElement.classList.remove("animating");
    }
  }

  // Populate Voice dropdown
  function initVoices(savedVoiceName) {
    const synth = window.speechSynthesis;
    
    function populateList() {
      voiceSelect.innerHTML = '<option value="">System Default Voice</option>';
      const voices = synth.getVoices().sort((a, b) => {
        return a.name.localeCompare(b.name);
      });

      voices.forEach(voice => {
        const option = document.createElement("option");
        option.value = voice.name;
        option.textContent = `${voice.name} (${voice.lang})`;
        
        if (voice.name === savedVoiceName) {
          option.selected = true;
        }
        voiceSelect.appendChild(option);
      });
    }

    populateList();
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = populateList;
    }
  }

  // Listen to background requests to stop speech
  if (isContextValid()) {
    try {
      chrome.runtime.onMessage.addListener((message) => {
        if (message.action === "stopSpeech") {
          stopSpeechPlayback();
        }
      });
    } catch (e) {
      console.warn("SPeecHIT PDF Viewer: Failed to register onMessage listener", e);
    }
  }
});
