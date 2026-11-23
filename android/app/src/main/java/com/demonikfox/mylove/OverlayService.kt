package com.demonikfox.mylove

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.app.NotificationCompat

class OverlayService : Service() {
    companion object { var isRunning = false }
    private lateinit var windowManager: WindowManager
    private var overlayView: View? = null
    private var webView: WebView? = null
    private val CHANNEL_ID = "OverlayChannel"
    private val NOTIF_ID = 101

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == "STOP_OVERLAY") { stopSelf(); return START_NOT_STICKY }
        isRunning = true
        startForeground(NOTIF_ID, createNotification())
        showOverlay()
        return START_STICKY
    }

    private fun showOverlay() {
        if (overlayView != null) return
        
        webView = WebView(this).apply {
            setBackgroundColor(Color.TRANSPARENT)
            setLayerType(View.LAYER_TYPE_HARDWARE, null)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.cacheMode = android.webkit.WebSettings.LOAD_NO_CACHE
            settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            clearCache(true)
            // Изначально прячем оверлей (прозрачность 0)
            alpha = 0f 

            // МОСТ: Сайт будет управлять видимостью оверлея
            addJavascriptInterface(object {
                @JavascriptInterface
                fun setDrawingActive(active: Boolean) {
                    runOnUiThread {
                        overlayView?.animate()?.alpha(if (active) 1f else 0f)?.setDuration(300)?.start()
                    }
                }
                @JavascriptInterface
                fun clearOverlay() {
                    runOnUiThread {
                        webView?.evaluateJavascript("if (window.LDCanvas) window.LDCanvas.clearSilent();", null)
                    }
                }
            }, "OverlayBridge")
        }

        webView?.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                view?.evaluateJavascript("""
                    (function() {
                        const style = document.createElement('style');
                        style.textContent = `
                            html, body { background: transparent !important; background-color: transparent !important; }
                            body * { visibility: hidden; background: transparent !important; background-color: transparent !important; box-shadow: none !important; }
                            #paper, #board, #shapesCanvas, #textCanvas, #pawsCanvas, #previewCanvas { 
                                visibility: visible !important; 
                                background: transparent !important; 
                                box-shadow: none !important; 
                            }
                            #paper { position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; transform: none !important; }
                            #bgCanvas { display: none !important; }
                        `;
                        document.head.appendChild(style);
                    })();
                """.trimIndent(), null)
            }
        }
        val t = System.currentTimeMillis()
        webView?.loadUrl("https://bot-1792486643-5744-demonikfox.bothost.tech/?role=B&overlay=1&t=$t")
        
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY else WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or 
            WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or 
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        )
        params.gravity = Gravity.TOP or Gravity.START
        overlayView = webView
        windowManager.addView(overlayView, params)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Live Draw Overlay", NotificationManager.IMPORTANCE_LOW)
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }
    private fun createNotification(): Notification {
        val stopIntent = Intent(this, OverlayService::class.java).apply { action = "STOP_OVERLAY" }
        val stopPendingIntent = PendingIntent.getService(this, 0, stopIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Live Draw включен").setContentText("Рисунок партнера на экране").setSmallIcon(android.R.drawable.ic_menu_edit).setOngoing(true)
            .addAction(android.R.drawable.ic_delete, "Выключить", stopPendingIntent).build()
    }
    override fun onDestroy() { 
        super.onDestroy()
        isRunning = false
        if (overlayView != null) { 
            try { 
                // Очищаем холст при выключении
                webView?.evaluateJavascript("if (window.LDCanvas) window.LDCanvas.clearSilent();", null)
                windowManager.removeView(overlayView) 
            } catch (e: Exception) {} 
            overlayView = null 
            webView = null
        } 
    }
    override fun onBind(intent: Intent?): IBinder? = null
}
