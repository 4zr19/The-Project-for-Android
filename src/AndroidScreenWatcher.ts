/**
 * AndroidScreenWatcher.ts
 *
 * JS/TS side of the Android background scanner. The actual screen-reading
 * happens in a native Kotlin AccessibilityService (see
 * android-native/ScreenWatcherService.kt) — this file just defines the bridge
 * contract and a React hook that consumes it, then runs every captured
 * line of on-screen text through the SAME `analyzeScreenText` +
 * `AlertCooldownTracker` used everywhere else in this app.
 *
 * Why an AccessibilityService and not OCR-on-a-screenshot-loop (like the
 * desktop app's ScreenScanner)?
 *   - It's event-driven (fires when the visible window's content changes),
 *     not a fixed poll, so it's both faster and lighter on battery than
 *     screenshotting every 5s.
 *   - It reads structured text nodes directly — no OCR errors.
 *   - It's the only API Android exposes for this; MediaProjection screen
 *     capture is the alternative and it forces a persistent, user-visible
 *     "this app is capturing your screen" system notification that cannot
 *     be hidden, which defeats the point of being unobtrusive.
 *
 * IMPORTANT: enabling this still requires the user to explicitly grant
 * Accessibility permission once, in Android Settings. There is no way to
 * silently acquire this — Android shows the user exactly what they're
 * granting, and Play Store policy requires you to disclose why the app
 * uses it (a short in-app explanation screen is expected before you deep
 * link the user to the settings page).
 */

import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { AlertCooldownTracker, type AnalysisResult } from './threatDetection';

interface ScreenWatcherNativeModule {
  /** Opens Android's Accessibility settings page so the user can enable the service. */
  openAccessibilitySettings(): void;
  /** Returns whether our AccessibilityService is currently enabled by the user. */
  isServiceEnabled(): Promise<boolean>;
}

const { ScreenWatcherModule } = NativeModules as {
  ScreenWatcherModule?: ScreenWatcherNativeModule;
};

const SCREEN_TEXT_EVENT = 'ScreenWatcher:onScreenTextChanged';

export interface ScreenWatcherHandle {
  /** Stop listening for native screen-text events. Call on unmount. */
  unsubscribe: () => void;
}

/**
 * Subscribe to on-screen text changes reported by the native
 * AccessibilityService, score each one, and invoke `onAlert` only when
 * the shared detection logic + cooldown tracker decide it's worth
 * surfacing to the user (matches desktop app's high/medium gating).
 */
export function watchScreenForThreats(onAlert: (result: AnalysisResult) => void): ScreenWatcherHandle {
  if (Platform.OS !== 'android') {
    // No-op on platforms without this capability (see ios/ for the
    // alternative, user-initiated flow).
    return { unsubscribe: () => {} };
  }

  const tracker = new AlertCooldownTracker();
  const emitter = new NativeEventEmitter(NativeModules.ScreenWatcherModule);

  const subscription = emitter.addListener(SCREEN_TEXT_EVENT, async (payload: { text?: string }) => {
    const text = payload?.text ?? '';
    const result = await tracker.process(text);
    if (result) {
      onAlert(result);
    }
  });

  return {
    unsubscribe: () => subscription.remove(),
  };
}

export async function isAccessibilityServiceEnabled(): Promise<boolean> {
  if (Platform.OS !== 'android' || !ScreenWatcherModule) return false;
  try {
    return await ScreenWatcherModule.isServiceEnabled();
  } catch {
    return false;
  }
}

export function openAccessibilitySettings(): void {
  if (Platform.OS !== 'android' || !ScreenWatcherModule) return;
  ScreenWatcherModule.openAccessibilitySettings();
}
