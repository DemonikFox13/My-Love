package com.demonikfox.mylove

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webview)
        
        // Настройки WebView, чтобы сайт работал как в обычном браузере
        val webSettings: WebSettings = webView.settings
        webSettings.javaScriptEnabled = true
        webSettings.domStorageEnabled = true
        webSettings.databaseEnabled = true
        webSettings.allowFileAccess = true
        
        // Разрешаем загружать контент
        webSettings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

        webView.webViewClient = WebViewClient()

        // Загружаем твой сайт с ролью A (для телефона)
        // Если это телефон девушки, здесь нужно будет поменять на ?role=B
        webView.loadUrl("https://bot-1792486643-5744-demonikfox.bothost.tech/?role=A")
    }

    // Чтобы кнопка "Назад" на телефоне не закрывала приложение сразу, а работала как в браузере
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
