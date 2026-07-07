// SPeecHIT Popup JavaScript

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const toggleInstant = document.getElementById("toggle-instant");
  const toggleFloating = document.getElementById("toggle-floating");
  const speedSlider = document.getElementById("speed-slider");
  const speedValue = document.getElementById("speed-value");
  const voiceSelect = document.getElementById("voice-select");
  const btnPdfReader = document.getElementById("btn-pdf-reader");

  // Load saved settings
  chrome.storage.local.get([
    "instantRead",
    "showFloatingController",
    "readingSpeed",
    "voiceName"
  ], (settings) => {
    // Sync UI with settings
    toggleInstant.checked = settings.instantRead !== false;
    toggleFloating.checked = settings.showFloatingController !== false;
    
    const rate = settings.readingSpeed || 1.0;
    speedSlider.value = rate;
    speedValue.textContent = parseFloat(rate).toFixed(1) + "x";

    // Populate voices and pre-select the saved voice
    const savedVoiceName = settings.voiceName || "";
    initVoices(savedVoiceName);
  });

  // Handle Instant Read Toggle changes
  toggleInstant.addEventListener("change", () => {
    chrome.storage.local.set({ instantRead: toggleInstant.checked });
  });

  // Handle Floating Controller Toggle changes
  toggleFloating.addEventListener("change", () => {
    chrome.storage.local.set({ showFloatingController: toggleFloating.checked });
  });

  // Handle Speed Slider adjustments
  speedSlider.addEventListener("input", () => {
    const rate = parseFloat(speedSlider.value);
    speedValue.textContent = rate.toFixed(1) + "x";
    chrome.storage.local.set({ readingSpeed: rate });
  });

  // Handle Voice selection changes
  voiceSelect.addEventListener("change", () => {
    chrome.storage.local.set({ voiceName: voiceSelect.value });
  });

  // Handle PDF Reader button click
  btnPdfReader.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("pdf-viewer.html") });
  });

  // Helper to load and populate voices
  function initVoices(savedVoiceName) {
    const synth = window.speechSynthesis;
    
    function populateList() {
      // Clear existing options except default
      voiceSelect.innerHTML = '<option value="">System Default Voice</option>';
      
      const voices = synth.getVoices().sort((a, b) => {
        const nameA = a.name.toUpperCase();
        const nameB = b.name.toUpperCase();
        return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
      });

      voices.forEach(voice => {
        const option = document.createElement("option");
        option.value = voice.name;
        // Format voice string nicely
        option.textContent = `${voice.name} (${voice.lang})${voice.default ? ' [Default]' : ''}`;
        
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
});
