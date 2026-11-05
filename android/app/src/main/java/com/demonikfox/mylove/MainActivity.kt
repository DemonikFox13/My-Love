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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Toast.makeText(this, "Разрешите отображение поверх других приложений, затем нажмите снова", Toast.LENGTH_LONG).show()
            startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
            return
        }
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
