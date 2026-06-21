package com.scamscanner

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.provider.Settings
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.text.Normalizer
import com.facebook.react.bridge.Arguments

class ScreenWatcherService : AccessibilityService() {

    private var lastEmittedText: String = ""

    override fun onServiceConnected() {
        super.onServiceConnected()
        val info = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED or
                AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            notificationTimeout = 300
            flags = AccessibilityServiceInfo.DEFAULT
        }
        serviceInfo = info
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        val root: AccessibilityNodeInfo = rootInActiveWindow ?: return
        val text = StringBuilder()
        collectText(root, text, maxNodes = 400)
        root.recycle()

        val normalized = normalize(text.toString())
        if (normalized.isNotEmpty() && normalized != lastEmittedText) {
            lastEmittedText = normalized
            ScreenWatcherModule.emitScreenText(normalized)
        }
    }

    override fun onInterrupt() {}

    private fun collectText(node: AccessibilityNodeInfo, out: StringBuilder, maxNodes: Int, visited: Int = 0): Int {
        var count = visited
        if (count >= maxNodes) return count
        node.text?.let {
            if (it.isNotBlank()) out.append(it).append('\n')
        }
        count++
        for (i in 0 until node.childCount) {
            if (count >= maxNodes) break
            val child = node.getChild(i) ?: continue
            count = collectText(child, out, maxNodes, count)
            child.recycle()
        }
        return count
    }

    private fun normalize(raw: String): String {
        val stripped = Normalizer.normalize(raw, Normalizer.Form.NFKC)
        return stripped.replace(Regex("\\s+"), " ").trim()
    }
}

class ScreenWatcherModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    init {
        instance = this
    }

    override fun getName() = "ScreenWatcherModule"

    @ReactMethod
    fun openAccessibilitySettings() {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactApplicationContext.startActivity(intent)
    }

    @ReactMethod
    fun isServiceEnabled(promise: Promise) {
        try {
            val enabledServices = Settings.Secure.getString(
                reactApplicationContext.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
            ) ?: ""
            val componentName = "${reactApplicationContext.packageName}/${ScreenWatcherService::class.java.name}"
            promise.resolve(enabledServices.contains(componentName))
        } catch (e: Exception) {
            promise.reject("CHECK_FAILED", e)
        }
    }

    companion object {
        private var instance: ScreenWatcherModule? = null

        fun emitScreenText(text: String) {
            val context = instance?.reactApplicationContext ?: return

            // Send to JS
            context
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("ScreenWatcher:onScreenTextChanged", Arguments.createMap().apply { putString("text", text) })

            // Show notification if dangerous
            val lower = text.lowercase()
            val dangerous = listOf(
                "virus detected", "call microsoft", "your computer has been blocked",
                "verify your account", "gift card", "wire transfer", "bitcoin",
                "social security", "credit card number", "account suspended",
                "click here immediately", "you have won", "claim your prize"
            )

            if (dangerous.any { lower.contains(it) }) {
                showNotification(context, "Lighthouse Warning", "Suspicious content detected! Do not click anything.")
            }
        }

        private fun showNotification(context: ReactApplicationContext, title: String, message: String) {
            val channelId = "lighthouse_alerts"
            val manager = context.getSystemService(android.app.NotificationManager::class.java)

            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                val channel = android.app.NotificationChannel(
                    channelId, "Lighthouse Alerts", android.app.NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Alerts when suspicious content is detected on screen"
                    enableVibration(true)
                }
                manager.createNotificationChannel(channel)
            }

            val notification = androidx.core.app.NotificationCompat.Builder(context, channelId)
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setContentTitle(title)
                .setContentText(message)
                .setPriority(androidx.core.app.NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .build()

            manager.notify(1001, notification)
        }
    }
}