package com.demonikfox.mylove

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.os.Bundle
import android.util.Log
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
        root.addView(drawView)

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
            options.query = "role=A" // Роль для телефона

            socket = IO.socket(URI.create(SERVER_URL), options)

            socket?.on(Socket.EVENT_CONNECT) {
                runOnUiThread {
                    statusText.text = "ПОДКЛЮЧЕНО (Онлайн)"
                    statusText.setTextColor(Color.GREEN)
                }
            }
            socket?.on(Socket.EVENT_DISCONNECT) {
                runOnUiThread {
                    statusText.text = "ОФЛАЙН"
                    statusText.setTextColor(Color.RED)
                }
            }

            // Принимаем историю (только проценты)
            socket?.on("history") { args ->
                val array = args[0] as JSONArray
                runOnUiThread {
                    for (i in 0 until array.length()) {
                        val stroke = array.getJSONObject(i)
                        if (stroke.has("from") && stroke.has("to")) {
                            val fromObj = stroke.getJSONObject("from")
                            val toObj = stroke.getJSONObject("to")
                            if (fromObj.has("xPct") && toObj.has("xPct")) {
                                val fx = (fromObj.getDouble("xPct") * drawView.width).toFloat()
                                val fy = (fromObj.getDouble("yPct") * drawView.height).toFloat()
                                val tx = (toObj.getDouble("xPct") * drawView.width).toFloat()
                                val ty = (toObj.getDouble("yPct") * drawView.height).toFloat()
                                val colorStr = stroke.optString("color", "#000000")
                                drawView.drawPartnerStroke(fx, fy, tx, ty, Color.parseColor(colorStr))
                            }
                        }
                    }
                }
            }

            // Принимаем новые штрихи (только проценты)
            socket?.on("draw") { args ->
                val data = args[0] as JSONObject
                runOnUiThread {
                    val fromObj = data.getJSONObject("from")
                    val toObj = data.getJSONObject("to")
                    if (fromObj.has("xPct") && toObj.has("xPct")) {
                        val fx = (fromObj.getDouble("xPct") * drawView.width).toFloat()
                        val fy = (fromObj.getDouble("yPct") * drawView.height).toFloat()
                        val tx = (toObj.getDouble("xPct") * drawView.width).toFloat()
                        val ty = (toObj.getDouble("yPct") * drawView.height).toFloat()
                        val colorStr = data.optString("color", "#000000")
                        drawView.drawPartnerStroke(fx, fy, tx, ty, Color.parseColor(colorStr))
                    }
                }
            }

            socket?.connect()
        } catch (e: Exception) {
            statusText.text = "Ошибка: ${e.message}"
        }
    }

    inner class DrawView(context: Context) : View(context) {
        private val paint = Paint().apply {
            color = Color.BLACK; style = Paint.Style.STROKE; strokeWidth = 5f
            isAntiAlias = true; strokeCap = Paint.Cap.ROUND
        }
        private val partnerPaint = Paint().apply {
            style = Paint.Style.STROKE; strokeWidth = 5f
            isAntiAlias = true; strokeCap = Paint.Cap.ROUND
        }

        private var lastX = 0f
        private var lastY = 0f
        private val paths = mutableListOf<Pair<Path, Paint>>()
        private var currentPath: Path? = null
        private var isDrawing = false

        override fun onTouchEvent(event: MotionEvent): Boolean {
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    currentPath = Path().apply { moveTo(event.x, event.y) }
                    lastX = event.x
                    lastY = event.y
                    isDrawing = true
                    socket?.emit("drawing_start")
                    return true
                }
                MotionEvent.ACTION_MOVE -> {
                    if (isDrawing) {
                        currentPath?.quadTo(lastX, lastY, event.x, event.y)
                        
                        // Отправляем координаты ТОЛЬКО в процентах
                        val w = width.toDouble()
                        val h = height.toDouble()
                        
                        val data = JSONObject().apply {
                            put("from", JSONObject().put("xPct", lastX / w).put("yPct", lastY / h))
                            put("to", JSONObject().put("xPct", event.x / w).put("yPct", event.y / h))
                            put("color", "#000000")
                        }
                        socket?.emit("draw", data)
                        
                        lastX = event.x
                        lastY = event.y
                        invalidate()
                    }
                    return true
                }
                MotionEvent.ACTION_UP -> {
                    currentPath?.let { paths.add(it to paint) }
                    currentPath = null
                    isDrawing = false
                    socket?.emit("drawing_stop")
                    invalidate()
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
