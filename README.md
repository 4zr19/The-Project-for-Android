the downloadable apk is mobile-port\ScamScanner\android\app\build\outputs\apk\release

An Android app that silently monitors your screen in real time and alerts you when it detects scams, phishing attempts, or suspicious content — before you click anything.


What It Does

Lighthouse runs in the background while you use your phone normally. Every time your screen changes — a new webpage, email, or message — Lighthouse reads the visible text and checks it for threats using AI. If something looks dangerous, you get an instant notification warning you not to click.

It's designed especially for people who may not recognize scams on their own, like older adults or anyone unfamiliar with phishing tactics.


How It Works

Screen changes (browser, email, SMS, etc.)
        ↓
Android Accessibility Service reads visible text
        ↓
Text is sent to a local AI model (Ollama / llama3.2)
        ↓
AI scores the content: safe / low / medium / high
        ↓
If medium or high → notification fires instantly
        ↓
"WARNING — Do not click anything"

The 4 Main Components

FileWhat it doesScreenWatcherService.ktAndroid Accessibility Service — reads on-screen text when the screen changes
AndroidScreenWatcher.ts Bridge between the Kotlin native code and the JavaScript 
sidethreatDetection.ts Sends text to Ollama for AI scoring, falls back to keyword detection if offline
App.tsxThe UI — shows protection status and displays threat alerts


Features


Real-time screen monitoring using Android Accessibility Services (no screenshots, no screen recording)
AI-powered threat detection via a local Ollama model — understands context, not just keywords
Instant push notifications when suspicious content is detected
Keyword fallback if the AI model is offline
Cooldown system to prevent alert spam (high threats: 5 min cooldown, medium: 1 min)
Works across all apps — browser, email, SMS, WhatsApp, and more
Privacy first — all text is processed locally, nothing is sent to external servers
