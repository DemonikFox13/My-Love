package com.demonikfox.mylove

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.os.Bundle
import android.view.MotionEvent
import android.view.View
import android.widget.FrameLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONArray
import org.json.JSONObject
import java.net.URI

class MainActivity : AppCompatActivity() {
    private val SERVER_URL = "https://bot-1792486643-5744-demonikfox.bothost.tech"
    private var socket: Socket? = null
    private lateinit var drawView: DrawView
    private lateinit var statusText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = FrameLayout(this)
        
        drawView = DrawView(this)
        // ТЕ САМЫЕ НАСТРОЙКИ: растягиваем холст на весь экран
        root.addView(drawView, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))

        statusText = TextView(this).apply {
            text = "Подключение..."
            setTextColor(Color.RED)
            textSize = 16f
            setPadding(30, 60, 30, 30)
            setBackgroundColor(Color.argb(150, 255, 255, 255))
        }
        root.addView(statusText)
        setContentView(root)
        connectToServer()
    }

    private fun connectToServer() {
        try {
            val options = IO.Options()
            options.query = "role=A"
            socket = IO.socket(URI.create(SERVER_URL), options)

            socket?.on(Socket.EVENT_CONNECT) {
                runOnUiThread { statusText.text = "ПОДКЛЮЧЕНО"; statusText.setTextColor(Color.GREEN) }
            }
            socket?.on(Socket.EVENT_DISCONNECT) {
                runOnUiThread { statusText.text = "ОФЛАЙН"; statusText.setTextColor(Color.RED) }
            }

            socket?.on("history") { args ->
                val array = args[0] as JSONArray
                runOnUiThread {
                    for (i in 0 until array.length()) {
                        val stroke = array.getJSONObject(i)
                        if (stroke.has("from") && stroke.has("to")) {
                            parseAndDraw(stroke)
                        }
                    }
                }
            }

            socket?.on("draw") { args ->
                val data = args[0] as JSONObject
                runOnUiThread { parseAndDraw(data) }
            }
            socket?.connect()
        } catch (e: Exception) {
            statusText.text = "Ошибка: ${e.message}"
        }
    }

    private fun parseAndDraw(stroke: JSONObject) {
        val fromObj = stroke.getJSONObject("from")
        val toObj = stroke.getJSONObject("to")
        
        val fx: Float; val fy: Float; val tx: Float; val ty: Float
        // Если координаты в процентах (0..1) — умножаем на размер экрана
        if (fromObj.has("xPct")) {
            fx = (fromObj.getDouble("xPct") * drawView.width).toFloat()
            fy = (fromObj.getDouble("yPct") * drawView.height).toFloat()
            tx = (toObj.getDouble("xPct") * drawView.width).toFloat()
            ty = (toObj.getDouble("yPct") * drawView.height).toFloat()
        } else {
            // Запасной вариант для старых линий (в пикселях)
            fx = fromObj.getDouble("x").toFloat()
            fy = fromObj.getDouble("y").toFloat()
            tx = toObj.getDouble("x").toFloat()
            ty = toObj.getDouble("y").toFloat()
        }
        val colorStr = stroke.optString("color", "#000000")
        drawView.drawPartnerStroke(fx, fy, tx, ty, Color.parseColor(colorStr))
    }

    inner class DrawView(context: Context) : View(context) {
        private val paint = Paint().apply { color = Color.BLACK; style = Paint.Style.STROKE; strokeWidth = 5f; isAntiAlias = true; strokeCap = Paint.Cap.ROUND }
        private val partnerPaint = Paint().apply { style = Paint.Style.STROKE; strokeWidth = 5f; isAntiAlias = true; strokeCap = Paint.Cap.ROUND }
        private var lastX = 0f
        private var lastY = 0f
        private val paths = mutableListOf<Pair<Path, Paint>>()
        private var currentPath: Path? = null
        private var isDrawing = false

        override fun onTouchEvent(event: MotionEvent): Boolean {
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    currentPath = Path().apply { moveTo(event.x, event.y) }
                    lastX = event.x; lastY = event.y; isDrawing = true
                    socket?.emit("drawing_start")
                    return true
                }
                MotionEvent.ACTION_MOVE -> {
                    if (isDrawing) {
                        currentPath?.quadTo(lastX, lastY, event.x, event.y)
                        val w = if (width > 0) width.toDouble() else 1.0
                        val h = if (height > 0) height.toDouble() else 1.0
                        val data = JSONObject().apply {
                            put("from", JSONObject().put("xPct", lastX / w).put("yPct", lastY / h))
                            put("to", JSONObject().put("xPct", event.x / w).put("yPct", event.y / h))
                            put("color", "#000000")
                        }
                        socket?.emit("draw", data)
                        lastX = event.x; lastY = event.y; invalidate()
                    }
                    return true
                }
                MotionEvent.ACTION_UP -> {
                    currentPath?.let { paths.add(it to paint) }
                    currentPath = null; isDrawing = false
                    socket?.emit("drawing_stop"); invalidate()
                    return true
                }
            }
            return super.onTouchEvent(event)
        }

        fun drawPartnerStroke(fx: Float, fy: Float, tx: Float, ty: Float, color: Int) {
            val path = Path().apply { moveTo(fx, fy); lineTo(tx, ty) }
            partnerPaint.color = color
            paths.add(path to partnerPaint)
            invalidate()
        }

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            for ((path, p) in paths) canvas.drawPath(path, p)
            currentPath?.let { canvas.drawPath(it, paint) }
        }
    }
}
