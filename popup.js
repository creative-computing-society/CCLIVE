document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const authSection = document.getElementById('auth-section');
    const streamSection = document.getElementById('stream-section');
    const authBtn = document.getElementById('auth-btn');
    const startStreamBtn = document.getElementById('start-stream-btn');
    const stopStreamBtn = document.getElementById('stop-stream-btn');
    const streamKeyInput = document.getElementById('stream-key');
    const includeAudioCheckbox = document.getElementById('include-audio');
    const helpLink = document.getElementById('help-link');
  
    // Extension state variables
    let currentMeetUrl = '';
    let isInMeeting = false;
  
    // Check authentication status on popup open
    checkAuthStatus();
  
    // Add event listeners
    authBtn.addEventListener('click', handleAuth);
    startStreamBtn.addEventListener('click', startStreaming);
    stopStreamBtn.addEventListener('click', stopStreaming);
    helpLink.addEventListener('click', openHelpPage);
    streamKeyInput.addEventListener('input', saveStreamKey);
  
    // Check if we're in an active Google Meet
    checkIfInMeeting();
  
    // Function to check authentication status
    function checkAuthStatus() {
      chrome.runtime.sendMessage({ action: "checkAuth" }, function(response) {
        if (response && response.isAuthenticated) {
          // User is authenticated
          updateUIForAuthenticatedUser(response.userData);
          
          // Load saved stream key if available
          chrome.storage.local.get(['streamKey', 'includeAudio'], function(result) {
            if (result.streamKey) {
              streamKeyInput.value = result.streamKey;
            }
            if (result.includeAudio !== undefined) {
              includeAudioCheckbox.checked = result.includeAudio;
            }
          });
        } else {
          // User is not authenticated
          updateUIForUnauthenticatedUser();
        }
      });
    }
  
    // Function to handle authentication
    function handleAuth() {
      authBtn.disabled = true;
      authBtn.textContent = "Signing in...";
      
      chrome.runtime.sendMessage({ action: "authenticate" }, function(response) {
        if (response && response.success) {
          updateUIForAuthenticatedUser(response.userData);
        } else {
          authBtn.disabled = false;
          authBtn.textContent = "Sign in with CCS";
          // Show error if there was one
          if (response && response.error) {
            alert("Authentication failed: " + response.error);
          }
        }
      });
    }
  
    // Function to save stream key as user types
    function saveStreamKey() {
      // Debounce the save operation
      clearTimeout(saveStreamKey.timeout);
      saveStreamKey.timeout = setTimeout(() => {
        chrome.storage.local.set({ streamKey: streamKeyInput.value.trim() });
      }, 500);
    }
  
    // Function to start streaming
    function startStreaming() {
      const streamKey = streamKeyInput.value.trim();
      if (!streamKey) {
        alert("Please enter your YouTube stream key");
        return;
      }
  
      startStreamBtn.disabled = true;
      startStreamBtn.textContent = "Starting stream...";
  
      // Save audio preference
      chrome.storage.local.set({ includeAudio: includeAudioCheckbox.checked });
  
      chrome.runtime.sendMessage({ 
        action: "startStream", 
        streamKey: streamKey,
        includeAudio: includeAudioCheckbox.checked,
        meetUrl: currentMeetUrl
      }, function(response) {
        if (response && response.success) {
          updateUIForActiveStream();
          
          // Show notification that streaming has started
          chrome.runtime.sendMessage({
            action: "showNotification",
            title: "CCLIVE Streaming",
            message: "Your Google Meet is now streaming to YouTube"
          });
        } else {
          startStreamBtn.disabled = false;
          startStreamBtn.textContent = "Start Streaming";
          // Show error if there was one
          if (response && response.error) {
            alert("Failed to start streaming: " + response.error);
          }
        }
      });
    }
  
    // Function to stop streaming
    function stopStreaming() {
      stopStreamBtn.disabled = true;
      stopStreamBtn.textContent = "Stopping...";
  
      chrome.runtime.sendMessage({ action: "stopStream" }, function(response) {
        if (response && response.success) {
          updateUIForInactiveStream();
          
          // Show notification that streaming has stopped
          chrome.runtime.sendMessage({
            action: "showNotification",
            title: "CCLIVE Streaming",
            message: "YouTube streaming has ended"
          });
        } else {
          stopStreamBtn.disabled = false;
          stopStreamBtn.textContent = "Stop Streaming";
          // Show error if there was one
          if (response && response.error) {
            alert("Failed to stop streaming: " + response.error);
          }
        }
      });
    }
  
    // Function to open help page
    function openHelpPage(e) {
      e.preventDefault();
      chrome.tabs.create({ url: "https://cclive.codingcommunity.org/help" });
    }
  
    // Function to check if we're in an active Google Meet
    function checkIfInMeeting() {
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        const currentUrl = tabs[0]?.url || '';
        currentMeetUrl = currentUrl;
        isInMeeting = currentUrl.includes('meet.google.com');
        
        if (!isInMeeting) {
          startStreamBtn.disabled = true;
          startStreamBtn.title = "You must be in a Google Meet to start streaming";
          
          // Add visual indication
          startStreamBtn.classList.add('disabled');
          const warningElement = document.createElement('div');
          warningElement.textContent = "⚠️ Must be in Google Meet to stream";
          warningElement.style.color = "#EA4335";
          warningElement.style.fontSize = "12px";
          warningElement.style.marginTop = "5px";
          warningElement.id = "meet-warning";
          
          // Only add the warning if it doesn't already exist
          if (!document.getElementById('meet-warning')) {
            startStreamBtn.parentNode.insertBefore(warningElement, startStreamBtn.nextSibling);
          }
        } else {
          startStreamBtn.disabled = false;
          startStreamBtn.title = "";
          startStreamBtn.classList.remove('disabled');
          
          // Remove warning if exists
          const warningElement = document.getElementById('meet-warning');
          if (warningElement) {
            warningElement.remove();
          }
          
          // Check if we're already streaming this meeting
          chrome.runtime.sendMessage({ 
            action: "isStreamingMeeting", 
            meetUrl: currentUrl 
          }, function(response) {
            if (response && response.isStreaming) {
              updateUIForActiveStream();
            }
          });
        }
      });
    }
  
    // Function to update UI for authenticated user
    function updateUIForAuthenticatedUser(userData) {
      authSection.classList.add('hidden');
      streamSection.classList.remove('hidden');
      
      statusDot.classList.add('online');
      statusText.textContent = `Connected as ${userData.name || 'User'}`;
      
      // Check if we're already streaming
      chrome.runtime.sendMessage({ action: "getStreamStatus" }, function(response) {
        if (response && response.isStreaming) {
          updateUIForActiveStream();
          if (response.streamKey) {
            streamKeyInput.value = response.streamKey;
          }
          if (response.includeAudio !== undefined) {
            includeAudioCheckbox.checked = response.includeAudio;
          }
        }
      });
    }
  
    // Function to update UI for unauthenticated user
    function updateUIForUnauthenticatedUser() {
      authSection.classList.remove('hidden');
      streamSection.classList.add('hidden');
      
      statusDot.classList.remove('online');
      statusText.textContent = "Disconnected";
    }
  
    // Function to update UI for active stream
    function updateUIForActiveStream() {
      startStreamBtn.classList.add('hidden');
      stopStreamBtn.classList.remove('hidden');
      streamKeyInput.disabled = true;
      includeAudioCheckbox.disabled = true;
      
      // Indicate active streaming
      statusDot.classList.add('online');
      statusDot.style.animation = "pulse 2s infinite";
      statusText.textContent = "Streaming active";
      
      // Add streaming duration counter
      if (!document.getElementById('stream-duration')) {
        const durationElement = document.createElement('div');
        durationElement.id = 'stream-duration';
        durationElement.style.fontSize = '12px';
        durationElement.style.marginTop = '5px';
        durationElement.style.textAlign = 'center';
        durationElement.textContent = 'Duration: 00:00';
        stopStreamBtn.parentNode.insertBefore(durationElement, stopStreamBtn.nextSibling);
        
        // Start counting
        let seconds = 0;
        window.streamDurationInterval = setInterval(() => {
          seconds++;
          const minutes = Math.floor(seconds / 60);
          const remainingSeconds = seconds % 60;
          durationElement.textContent = `Duration: ${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        }, 1000);
      }
    }
  
    // Function to update UI for inactive stream
    function updateUIForInactiveStream() {
      startStreamBtn.classList.remove('hidden');
      stopStreamBtn.classList.add('hidden');
      startStreamBtn.disabled = isInMeeting ? false : true;
      startStreamBtn.textContent = "Start Streaming";
      streamKeyInput.disabled = false;
      includeAudioCheckbox.disabled = false;
      
      // Reset status indicator
      statusDot.style.animation = "";
      
      // Remove duration counter
      const durationElement = document.getElementById('stream-duration');
      if (durationElement) {
        durationElement.remove();
      }
      
      // Clear interval
      if (window.streamDurationInterval) {
        clearInterval(window.streamDurationInterval);
        window.streamDurationInterval = null;
      }
      
      // Update status text based on auth state
      chrome.runtime.sendMessage({ action: "checkAuth" }, function(response) {
        if (response && response.isAuthenticated && response.userData) {
          statusText.textContent = `Connected as ${response.userData.name || 'User'}`;
        } else {
          statusText.textContent = "Disconnected";
          statusDot.classList.remove('online');
        }
      });
    }
  
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
      if (request.action === "streamStatusChanged") {
        if (request.isStreaming) {
          updateUIForActiveStream();
        } else {
          updateUIForInactiveStream();
        }
      } else if (request.action === "authStatusChanged") {
        if (request.isAuthenticated) {
          updateUIForAuthenticatedUser(request.userData);
        } else {
          updateUIForUnauthenticatedUser();
        }
      } else if (request.action === "meetStatusChanged") {
        checkIfInMeeting();
      }
      return true;
    });
    
    // Add keystrokes for stream key field
    streamKeyInput.addEventListener('keydown', function(event) {
      if (event.key === 'Enter' && !startStreamBtn.disabled && !startStreamBtn.classList.contains('hidden')) {
        startStreaming();
      }
    });
    
    // Add style for pulse animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
      }
      
      .disabled {
        opacity: 0.6;
      }
    `;
    document.head.appendChild(style);
  });