// SPeecHIT Content Script

(function () {
  // Prevent duplicate injection
  if (window.speechItInitialized) return;
  window.speechItInitialized = true;

  // Speech State Variables
  let currentText = "";
  let currentUtterance = null;
  let isSpeaking = false;
  let isPaused = false;
  let activeSpeed = 1.0;
  let activeVoiceName = "";

  // Cached Settings
  let instantRead = true;
  let showFloatingController = true;

  // UI Element Variables
  let hostElement = null;
  let shadowRoot = null;
  let playerElement = null;
  let visualizerElement = null;
  let playBtn = null;
  let speedBtn = null;

  // Context validation helpers to handle extension updates/reloads gracefully
  function isContextValid() {
    return typeof chrome !== "undefined" && typeof chrome.runtime !== "undefined" && !!chrome.runtime.id;
  }

  function checkAndCleanUpContext() {
    if (!isContextValid()) {
      document.removeEventListener("mouseup", handleSelectionChange);
      document.removeEventListener("keyup", handleSelectionChange);
      document.removeEventListener("mousedown", handleDocumentClick);
      
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}

      if (hostElement) {
        try {
          hostElement.remove();
        } catch (e) {}
        hostElement = null;
      }
      return false;
    }
    return true;
  }

  // Load and cache settings
  if (isContextValid() && chrome.storage?.local) {
    try {
      chrome.storage.local.get(["instantRead", "showFloatingController", "readingSpeed", "voiceName"], (settings) => {
        if (settings) {
          instantRead = settings.instantRead !== false;
          showFloatingController = settings.showFloatingController !== false;
          activeSpeed = settings.readingSpeed || 1.0;
          activeVoiceName = settings.voiceName || "";
        }
      });
    } catch (e) {
      console.warn("SPeecHIT: Failed to load settings at startup", e);
    }
  }

  // Sync settings dynamically
  if (isContextValid()) {
    try {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "local") {
          if (changes.instantRead) instantRead = changes.instantRead.newValue !== false;
          if (changes.showFloatingController) showFloatingController = changes.showFloatingController.newValue !== false;
          if (changes.readingSpeed) activeSpeed = changes.readingSpeed.newValue || 1.0;
          if (changes.voiceName) activeVoiceName = changes.voiceName.newValue || "";
        }
      });
    } catch (e) {
      console.warn("SPeecHIT: Failed to register settings change listener", e);
    }
  }

  // Listen to messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "stopSpeech") {
      stopSpeech();
    } else if (message.action === "readSelectedText") {
      // Triggered from context menu
      const textToRead = message.text || window.getSelection().toString().trim();
      if (textToRead) {
        currentText = textToRead;
        showPlayerAtSelection();
        speakText(currentText);
      }
    }
  });

  // Listen for selection events on the document
  document.addEventListener("mouseup", handleSelectionChange);
  document.addEventListener("keyup", handleSelectionChange);
  
  // Listen for clicks on the document to dismiss the player
  document.addEventListener("mousedown", handleDocumentClick);

  function handleSelectionChange(e) {
    if (!checkAndCleanUpContext()) return;

    // Avoid running on events inside our player host
    if (hostElement && hostElement.contains(e.target)) return;

    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (!text) {
      // Selection cleared, stop speech if desired or just hide player
      // We will stop the speech if the player is closed or if they click elsewhere
      return;
    }

    if (text === currentText && hostElement && shadowRoot.querySelector(".speechit-player")) {
      // Selection didn't change and player is already showing, do nothing
      return;
    }

    currentText = text;

    if (showFloatingController) {
      showPlayerAtSelection();
    } else {
      hidePlayer();
    }

    if (instantRead) {
      speakText(currentText);
    }
  }

  function handleDocumentClick(e) {
    if (!checkAndCleanUpContext()) return;

    // If the click is inside our player, ignore it
    if (hostElement && hostElement.contains(e.target)) return;

    // If the click is on some text, selection will update, so wait
    setTimeout(() => {
      if (!checkAndCleanUpContext()) return;

      const selection = window.getSelection();
      if (selection.toString().trim() === "") {
        stopSpeech();
        hidePlayer();
      }
    }, 100);
  }

  // Speak selected text using window.speechSynthesis
  function speakText(text) {
    const synth = window.speechSynthesis;
    
    // Stop any existing page speech
    synth.cancel();
    isSpeaking = false;
    isPaused = false;
    updateUIState();

    // Signal to background to stop other tabs' speech
    if (isContextValid()) {
      try {
        chrome.runtime.sendMessage({ action: "speechStarted" });
      } catch (e) {
        console.warn("SPeecHIT: Failed to send speechStarted message", e);
      }
    }

    // Small delay to allow the browser synthesis engine to fully cancel and reset
    setTimeout(() => {
      currentUtterance = new SpeechSynthesisUtterance(text);
      currentUtterance.rate = activeSpeed;
      
      // Apply selected voice
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

      currentUtterance.onerror = (e) => {
        if (e.error !== "interrupted") {
          console.error("SPeecHIT speech synthesis error:", e);
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

      // Speak
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
      speakText(currentText);
    }
  }

  function stopSpeech() {
    window.speechSynthesis.cancel();
    isSpeaking = false;
    isPaused = false;
    updateUIState();
    if (isContextValid()) {
      try {
        chrome.runtime.sendMessage({ action: "stopBackgroundSpeech" });
      } catch (e) {
        console.warn("SPeecHIT: Failed to send stopBackgroundSpeech message", e);
      }
    }
  }

  function cycleSpeed() {
    // Cycle rate: 1.0 -> 1.25 -> 1.5 -> 1.75 -> 2.0 -> 0.75 -> 1.0
    const speeds = [1.0, 1.25, 1.5, 1.75, 2.0, 0.75];
    let currentIndex = speeds.indexOf(activeSpeed);
    if (currentIndex === -1) {
      currentIndex = 0;
    }
    
    const nextIndex = (currentIndex + 1) % speeds.length;
    activeSpeed = speeds[nextIndex];

    // Save in storage
    if (isContextValid() && chrome.storage?.local) {
      try {
        chrome.storage.local.set({ readingSpeed: activeSpeed });
      } catch (e) {
        console.warn("SPeecHIT: Failed to save speed settings", e);
      }
    }

    // Update speed button text
    if (speedBtn) {
      speedBtn.textContent = activeSpeed.toFixed(2) + "x";
    }

    // Apply speed changes in real-time to active utterance if speaking
    const synth = window.speechSynthesis;
    if (synth.speaking) {
      // In some browsers, changing rate on-the-fly works; in others, we need to restart.
      // Re-speaking is the most robust way to change rate in Web Speech API.
      speakText(currentText);
    }
  }

  // Create and inject the floating player in a isolated Shadow DOM
  function createPlayerUI() {
    if (hostElement) return;

    hostElement = document.createElement("div");
    hostElement.id = "speechit-host";
    // Important CSS for the outer host container to make positioning work
    hostElement.style.position = "absolute";
    hostElement.style.zIndex = "2147483647"; // Max z-index to overlay on everything
    hostElement.style.pointerEvents = "none";
    document.body.appendChild(hostElement);

    shadowRoot = hostElement.attachShadow({ mode: "open" });

    // Create container
    playerElement = document.createElement("div");
    playerElement.className = "speechit-player";
    playerElement.style.pointerEvents = "auto"; // Re-enable pointer events for the UI controls

    // Inject SVG and layout
    playerElement.innerHTML = `
      <div class="player-content">
        <!-- Logo -->
        <div class="mini-logo">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12" stroke="url(#logo-grad)" stroke-width="2" stroke-linecap="round"/>
            <path d="M12 6V18" stroke="cyan" stroke-width="2" stroke-linecap="round"/>
            <path d="M8 10V14" stroke="url(#logo-grad)" stroke-width="2" stroke-linecap="round"/>
            <path d="M16 8V16" stroke="url(#logo-grad)" stroke-width="2" stroke-linecap="round"/>
            <defs>
              <linearGradient id="logo-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                <stop stop-color="#a855f7"/>
                <stop offset="1" stop-color="#6366f1"/>
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div class="divider-v"></div>

        <!-- Play/Pause Button -->
        <button class="control-btn play-btn" title="Play/Pause">
          <svg class="icon-play" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          <svg class="icon-pause" viewBox="0 0 24 24" fill="currentColor" style="display:none;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        </button>

        <!-- Stop Button -->
        <button class="control-btn stop-btn" title="Stop">
          <svg class="icon-stop" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>
        </button>

        <!-- Speed Button -->
        <button class="speed-btn" title="Reading speed">${activeSpeed.toFixed(2)}x</button>

        <div class="divider-v"></div>

        <!-- Waveform Visualizer -->
        <div class="visualizer">
          <div class="v-bar v-bar-1"></div>
          <div class="v-bar v-bar-2"></div>
          <div class="v-bar v-bar-3"></div>
          <div class="v-bar v-bar-4"></div>
        </div>
      </div>
    `;

    shadowRoot.appendChild(playerElement);

    // Apply Content CSS
    if (isContextValid()) {
      try {
        const styleLink = document.createElement("link");
        styleLink.rel = "stylesheet";
        styleLink.href = chrome.runtime.getURL("content.css");
        shadowRoot.appendChild(styleLink);
      } catch (e) {
        console.warn("SPeecHIT: Failed to inject stylesheet", e);
      }
    }

    // Bind Controls
    playBtn = shadowRoot.querySelector(".play-btn");
    const stopBtn = shadowRoot.querySelector(".stop-btn");
    speedBtn = shadowRoot.querySelector(".speed-btn");
    visualizerElement = shadowRoot.querySelector(".visualizer");

    playBtn.addEventListener("click", togglePlayPause);
    stopBtn.addEventListener("click", stopSpeech);
    speedBtn.addEventListener("click", cycleSpeed);
  }

  function showPlayerAtSelection() {
    const selection = window.getSelection();
    if (selection.isCollapsed) return;

    createPlayerUI();

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Position coordinates
    const playerWidth = 240; // Approximate width of player
    const playerHeight = 44; // Approximate height of player

    // Calculate center horizontal alignment
    let x = rect.left + rect.width / 2 - playerWidth / 2 + window.scrollX;
    // Place below selection by default
    let y = rect.bottom + window.scrollY + 10;

    // Boundary collision check
    if (x < 10) x = 10; // Keep off left edge
    if (x + playerWidth > window.innerWidth + window.scrollX - 10) {
      x = window.innerWidth + window.scrollX - playerWidth - 10;
    }

    // If placed off bottom of screen, show above selection instead
    if (rect.bottom + playerHeight + 20 > window.innerHeight) {
      y = rect.top + window.scrollY - playerHeight - 10;
    }

    // If y is off the top of screen, default to a minimum distance
    if (y < window.scrollY) {
      y = rect.bottom + window.scrollY + 10;
    }

    hostElement.style.left = `${x}px`;
    hostElement.style.top = `${y}px`;
    hostElement.style.display = "block";

    // Set initial speed button text
    if (speedBtn) {
      speedBtn.textContent = activeSpeed.toFixed(2) + "x";
    }

    updateUIState();
  }

  function hidePlayer() {
    if (hostElement) {
      hostElement.style.display = "none";
    }
  }

  // Update UI play/pause buttons and sound wave animations
  function updateUIState() {
    if (!shadowRoot) return;

    const iconPlay = shadowRoot.querySelector(".icon-play");
    const iconPause = shadowRoot.querySelector(".icon-pause");

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
})();
