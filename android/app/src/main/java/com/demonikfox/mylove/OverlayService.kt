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
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.app.NotificationCompat

class OverlayService : Service() {

    companion object {
        var isRunning = false
    }

    private lateinit var windowManager: WindowManager
    private var overlayView: View? = null
    private val CHANNEL_ID = "OverlayChannel"
    private val NOTIF_ID = 101

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == "STOP_OVERLAY") {
            stopSelf()
            return START_NOT_STICKY
        }

        isRunning = true
        startForeground(NOTIF_ID, createNotification())
        showOverlay()
        return START_STICKY
    }

    private fun showOverlay() {
        if (overlayView != null) return

        val webView = WebView(this).apply {
            setBackgroundColor(Color.TRANSPARENT)
            setLayerType(WebView.LAYER_TYPE_SOFTWARE, null)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.cacheMode = android.webkit.WebSettings.LOAD_NO_CACHE
            settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }

        // Принудительная прозрачность после загрузки (страховка)
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                view?.evaluateJavascript("""
                    (function() {
                        const style = document.createElement('style');
                        style.textContent = 'html, body { background: transparent !important; background-color: transparent !important; } #bgCanvas { display: none !important; } #paper { background: transparent !important; }';
                        document.head.appendChild(style);
                    })();
                """.trimIndent(), null)
            }
        }

        webView.loadUrl("https://bot-1792486643-5744-demonikfox.bothost.tech/?role=B&overlay=1&v=1")

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            } else {
                WindowManager.LayoutParams.TYPE_PHONE
            },
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        )
        params.gravity = Gravity.TOP or Gravity.START

        overlayView = webView
        windowManager.addView(overlayView, params)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "Live Draw Overlay",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        val stopIntent = Intent(this, OverlayService::class.java).apply {
            action = "STOP_OVERLAY"
        }
        val stopPendingIntent = PendingIntent.getService(
            this, 0, stopIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Live Draw включен")
            .setContentText("Рисунок партнера на экране")
            .setSmallIcon(android.R.drawable.ic_menu_edit)
            .setOngoing(true)
            .addAction(android.R.drawable.ic_delete, "Выключить", stopPendingIntent)
            .build()
    }

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        if (overlayView != null) {
            try { windowManager.removeView(overlayView) } catch (e: Exception) {}
            overlayView = null
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
EOcat > android/app/src/main/java/com/demonikfox/mylove/MainActivity.kt << 'EOF'
package com.demonikfox.mylove

import android.Manifest
import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    private val fileChooserLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == RESULT_OK) {
            val data = result.data
            filePathCallback?.onReceiveValue(if (data?.data != null) arrayOf(data.data!!) else null)
        } else {
            filePathCallback?.onReceiveValue(null)
        }
        filePathCallback = null
    }

    private val notifPermLauncher = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) doStartOverlay()
        else Toast.makeText(this, "Без уведомлений оверлей не запустить", Toast.LENGTH_LONG).show()
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webview)
        webView.clearCache(true)

        val webSettings: WebSettings = webView.settings
        webSettings.javaScriptEnabled = true
        webSettings.domStorageEnabled = true
        webSettings.databaseEnabled = true
        webSettings.allowFileAccess = true
        webSettings.cacheMode = WebSettings.LOAD_NO_CACHE
        webSettings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

        // Мост для кнопки в тулбаре
        webView.addJavascriptInterface(object {
            @JavascriptInterface
            fun toggleOverlay() {
                runOnUiThread {
                    if (OverlayService.isRunning) {
                        stopService(Intent(this@MainActivity, OverlayService::class.java))
                    } else {
                        startOverlay()
                    }
                }
            }
            @JavascriptInterface
            fun isRunning(): Boolean = OverlayService.isRunning
        }, "AndroidOverlay")

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                injectOverlayBtn()
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(w: WebView?, f: ValueCallback<Array<Uri>>?, p: FileChooserParams?): Boolean {
                filePathCallback = f
                val intent = p?.createIntent()
                if (intent != null) { fileChooserLauncher.launch(intent); return true }
                return false
            }
            override fun onJsConfirm(view: WebView?, url: String?, message: String?, result: android.webkit.JsResult?): Boolean {
                AlertDialog.Builder(this@MainActivity).setMessage(message)
                    .setPositiveButton(android.R.string.ok) { _, _ -> result?.confirm() }
                    .setNegativeButton(android.R.string.cancel) { _, _ -> result?.cancel() }.show()
                return true
            }
        }

        webView.loadUrl("https://bot-1792486643-5744-demonikfox.bothost.tech/?role=A&v=72")
    }

    private fun injectOverlayBtn() {
        val running = OverlayService.isRunning
        val icon = if (running) "🔴" else "👁"
        val title = if (running) "Выключить оверлей" else "Включить оверлей"
        val js = """
            (function() {
                let btn = document.getElementById('overlayToggleBtn');
                if (!btn) {
                    btn = document.createElement('button');
                    btn.id = 'overlayToggleBtn';
                    btn.className = 'btn';
                    btn.style.cssText = 'width:38px;height:38px;font-size:16px;padding:0;display:inline-flex;align-items:center;justify-content:center;';
                    btn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        if (window.AndroidOverlay) window.AndroidOverlay.toggleOverlay();
                        setTimeout(function() {
                            if (window.AndroidOverlay) {
                                btn.textContent = window.AndroidOverlay.isRunning() ? '🔴' : '👁';
                                btn.title = window.AndroidOverlay.isRunning() ? 'Выключить оверлей' : 'Включить оверлей';
                            }
                        }, 500);
                    });
                    const topbar = document.getElementById('topbar');
                    if (topbar) topbar.insertBefore(btn, topbar.firstChild);
                    else { btn.style.cssText += 'position:fixed;top:50px;right:20px;z-index:99999;'; document.body.appendChild(btn); }
                }
                btn.textContent = '$icon';
                btn.title = '$title';
            })();
        """.trimIndent()
        webView.evaluateJavascript(js, null)
    }

    private fun startOverlay() {
        // Разрешение "поверх других приложений"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Toast.makeText(this, "Разрешите отображение поверх других приложений, затем нажмите снова", Toast.LENGTH_LONG).show()
            startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
            return
        }
        // Разрешение на уведомления
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                notifPermLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                return
            }
        }
        doStartOverlay()
    }

    private fun doStartOverlay() {
        val intent = Intent(this, OverlayService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent)
        else startService(intent)
        Toast.makeText(this, "Оверлей включен. Выключить — в уведомлении", Toast.LENGTH_SHORT).show()
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}
