# CCLIVE
CCLIVE is a Chrome extension that enables users to live-stream Coding Community Google Meet sessions directly to YouTube after signing in via CCS SSO.

## Features
- Sign in using a custom SSO authentication system.
- Capture Google Meet screen and audio.
- Stream the captured session to YouTube Live.

## Suggested Project structure
/cclive
├──/src
│   ├──background.js  # Handles streaming logic
│   ├──content.js     # Captures Google Meet session
│   ├──popup.js       # Manages popup interactions
│   ├──auth.js        # Handles SSO authentication
│
├──popup.html         # UI for extension popup
├──manifest.json      # Chrome extension configuration
└──README.md
