package com.demonikfox.mylove

import android.os.Bundle
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val text = TextView(this).apply {
            text = "Hello Live Draw!\n\nСборка APK работает."
            textSize = 22f
            setPadding(80, 200, 80, 80)
        }
        setContentView(text)
    }
}
