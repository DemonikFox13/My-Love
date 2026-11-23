package com.demonikfox.mylove

import android.app.KeyguardManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.PixelFormat
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.MediaStore
import android.util.Base64
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.app.NotificationCompat
import java.io.File
import java.io.FileOutputStream
import java.io.OutputStream

class OverlayService : Service() {
    companion object {
        var isRunning = false
        private const val AUTO_HIDE_SECONDS = 2 * 60 * 60
        private const val TICK_INTERVAL_MS = 10_000L
    }
    private lateinit var windowManager: WindowManager
    private var overlayView: View? = null
    private var webView: WebView? = null
    private val CHANNEL_ID = "OverlayChannel"
    private val NOTIF_ID = 101

    private var visibleSeconds = 0L
    private var isUnlocked = true
    private var hasContent = false
    private var isTimerRunning = false

    private val mainHandler = Handler(Looper.getMainLooper())
    private val tickRunnable = object : Runnable {
        override fun run() {
            if (isTimerRunning && hasContent) {
                visibleSeconds += TICK_INTERVAL_MS / 1000
                if (visibleSeconds >= AUTO_HIDE_SECONDS) {
                    hideAndClear()
                }
            }
            mainHandler.postDelayed(this, TICK_INTERVAL_MS)
        }
    }

    private val screenReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                Intent.ACTION_USER_PRESENT -> {
                    isUnlocked = true
                    if (hasContent) {
                        overlayView?.animate()?.alpha(1f)?.setDuration(300)?.start()
                        isTimerRunning = true
                    }
                }
                Intent.ACTION_SCREEN_OFF -> {
                    isUnlocked = false
                    overlayView?.animate()?.alpha(0f)?.setDuration(0)?.start()
                }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        
        // Проверяем, разблокирован ли телефон прямо сейчас
        val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        isUnlocked = !keyguardManager.isKeyguardLocked

        createNotificationChannel()
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_USER_PRESENT)
            addAction(Intent.ACTION_SCREEN_OFF)
        }
        registerReceiver(screenReceiver, filter)
        mainHandler.post(tickRunnable)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            "STOP_OVERLAY" -> { stopSelf(); return START_NOT_STICKY }
            "SAVE_AND_HIDE" -> {
                webView?.evaluateJavascript("if(window.captureAndSave) window.captureAndSave();", null)
                return START_STICKY
            }
        }
        isRunning = true
        startForeground(NOTIF_ID, createNotification())
        showOverlay()
        return START_STICKY
    }

    @JavascriptInterface
    fun saveImage(dataUrl: String) {
        try {
            val base64Str = dataUrl.substring(dataUrl.indexOf(",") + 1)
            val imageBytes = Base64.decode(base64Str, Base64.DEFAULT)
            val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
            val filename = "LiveDraw_${System.currentTimeMillis()}.png"
            val folderName = "My Love"

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+
                val values = ContentValues().apply {
                    put(MediaStore.Images.Media.DISPLAY_NAME, filename)
                    put(MediaStore.Images.Media.MIME_TYPE, "image/png")
                    put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/$folderName")
                }
                val uri: Uri? = contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
                uri?.let {
                    val outputStream: OutputStream? = contentResolver.openOutputStream(it)
                    bitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream!!)
                    outputStream.close()
                }
            } else {
                // Android 9 и ниже
                val imagesDir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), folderName)
                if (!imagesDir.exists()) imagesDir.mkdirs()
                val imageFile = File(imagesDir, filename)
                val outputStream = FileOutputStream(imageFile)
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream)
                outputStream.flush()
                outputStream.close()
                // Обновляем галерею
                sendBroadcast(Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE, Uri.fromFile(imageFile)))
            }
            mainHandler.post { hideAndClear() }
        } catch (e: Exception) { e.printStackTrace() }
    }

    private fun hideAndClear() {
        mainHandler.post {
            webView?.evaluateJavascript("if (window.LDCanvas) { window.LDCanvas.clearSilent(); window.LDCanvas.clearPaws(); } if (window.LDTextCanvas) window.LDTextCanvas.clearAll(); if (window.LDShapesCanvas) window.LDShapesCanvas.clearAll();", null)
            overlayView?.animate()?.alpha(0f)?.setDuration(500)?.start()
        }
        hasContent = false
        isTimerRunning = false
        visibleSeconds = 0L
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
            alpha = 0f

            addJavascriptInterface(object {
                @JavascriptInterface
                fun onPartnerDraw() {
                    mainHandler.post {
                        val wasHidden = !hasContent || (overlayView?.alpha ?: 0f) < 1f
                        hasContent = true
                        visibleSeconds = 0L // Сбрасываем таймер при новом штрихе
                        
                        if (isUnlocked) {
                            isTimerRunning = true
                            // Запускаем анимацию ТОЛЬКО если оверлей был скрыт, чтобы не было дёрганья
                            if (wasHidden) {
                                overlayView?.animate()?.alpha(1f)?.setDuration(300)?.start()
                            }
                        } else {
                            isTimerRunning = false
                        }
                    }
                }
                @JavascriptInterface
                fun saveImage(dataUrl: String) { this@OverlayService.saveImage(dataUrl) }
            }, "AndroidOverlay")
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
                            #paper, #board, #shapesCanvas, #textCanvas, #pawsCanvas, #previewCanvas { visibility: visible !important; display: block !important; opacity: 1 !important; background: transparent !important; background-color: transparent !important; box-shadow: none !important; z-index: 9999 !important; }
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
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
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
        val saveIntent = Intent(this, OverlayService::class.java).apply { action = "SAVE_AND_HIDE" }
        val savePendingIntent = PendingIntent.getService(this, 0, saveIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Live Draw включен")
            .setContentText("Нажмите 'Посмотреть позже', чтобы сохранить")
            .setSmallIcon(android.R.drawable.ic_menu_edit)
            .setOngoing(true)
            .addAction(android.R.drawable.ic_menu_save, "Посмотреть позже", savePendingIntent)
            .addAction(android.R.drawable.ic_delete, "Выключить", stopPendingIntent)
            .build()
    }
    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        mainHandler.removeCallbacks(tickRunnable)
        try { unregisterReceiver(screenReceiver) } catch (e: Exception) {}
        if (overlayView != null) {
            try {
                webView?.evaluateJavascript("if (window.LDCanvas) window.LDCanvas.clearSilent();", null)
                windowManager.removeView(overlayView)
            } catch (e: Exception) {}
            overlayView = null
            webView = null
        }
    }
    override fun onBind(intent: Intent?): IBinder? = null
}
