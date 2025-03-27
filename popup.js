document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const authSection = document.getElementById('auth-section');
    const streamSection = document.getElementById('stream-section');
    const authBtn = document.getElementById('auth-btn');
    const startStreamBtn = document.getElementById('start-stream-btn');
    const stopStreamBtn = document.getElementById('stop-stream-btn');
    const includeAudioCheckbox = document.getElementById('include-audio');
    const helpLink = document.getElementById('help-link');
  
    // Extension state variables
    let currentMeetUrl = '';
    let isInMeeting = false;

    // Socket.io
    const state = { media: null }
    const socket = io()
  
    // Check authentication status on popup open
    checkAuthStatus();
  
    // Add event listeners
    authBtn.addEventListener('click', handleAuth);
    startStreamBtn.addEventListener('click', startStreaming);
    stopStreamBtn.addEventListener('click', stopStreaming);
    helpLink.addEventListener('click', openHelpPage);
  
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
  
    // Function to start streaming
    function startStreaming() {
      const mediaRecorder = new MediaRecorder(state.media, {
        audioBitsPerSecond: 128000,
        videoBitsPerSecond: 2500000,
        framerate: 25
      })

      mediaRecorder.ondataavailable = ev => {
        console.log('Binary Stream Available', ev.data)
        socket.emit('binarystream', ev.data)
      }

      mediaRecorder.start(25)

      window.addEventListener('load', async e => {
        const media = await navigator
            .mediaDevices
            .getUserMedia({ audio: true, video: true })
        const screenMedia = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        state.media = {
          userMedia,
          screenMedia
        };
      })
    }
  
    // Function to stop streaming
    function stopStreaming() {
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop(); // Stop recording
        console.log("Streaming stopped.");
      }

      // Stop all media tracks
      if (state.media?.userMedia) {
        state.media.userMedia.getTracks().forEach(track => track.stop());
      }
      if (state.media?.screenMedia) {
        state.media.screenMedia.getTracks().forEach(track => track.stop());
      }
    }
  
    // Function to open help page
    function openHelpPage(e) {
      e.preventDefault();
      chrome.tabs.create({ url: "https://cclive.codingcommunity.org/help" });
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