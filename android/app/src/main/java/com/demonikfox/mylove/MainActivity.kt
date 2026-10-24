package com.demonikfox.mylove

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.os.Bundle
import android.view.MotionEvent
import android.view.View
import android.widget.Button
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
        setContentView(R.layout.activity_main)

        val container = findViewById<FrameLayout>(R.id.canvas_container)
        statusText = findViewById(R.id.status_text)

        drawView = DrawView(this)
        container.addView(drawView, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))

        findViewById<Button>(R.id.btn_black).setOnClickListener { setColor("#000000", false) }
        findViewById<Button>(R.id.btn_red).setOnClickListener { setColor("#FF0000", false) }
        findViewById<Button>(R.id.btn_blue).setOnClickListener { setColor("#0000FF", false) }
        findViewById<Button>(R.id.btn_eraser).setOnClickListener { setColor("#000000", true) } // Цвет не важен для ластика
        findViewById<Button>(R.id.btn_clear).setOnClickListener { clearCanvas() }

        connectToServer()
    }

    private fun setColor(hex: String, isEraser: Boolean) {
        drawView.currentColor = Color.parseColor(hex)
        drawView.isEraser = isEraser
    }

    private fun clearCanvas() {
        drawView.clearMyCanvas()
        socket?.emit("clear_my_canvas")
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
                    for (i in 0 until array.length()) parseAndDraw(array.getJSONObject(i))
                    drawView.invalidate()
                }
            }
            socket?.on("draw") { args ->
                val data = args[0] as JSONObject
                runOnUiThread { parseAndDraw(data); drawView.invalidate() }
            }
            socket?.on("clear") { _ ->
                runOnUiThread { drawView.clearPartnerCanvas(); drawView.invalidate() }
            }
            socket?.connect()
        } catch (e: Exception) {
            statusText.text = "Ошибка: ${e.message}"
        }
    }

    private fun parseAndDraw(stroke: JSONObject) {
        if (!stroke.has("from") || !stroke.has("to")) return
        val fromObj = stroke.getJSONObject("from")
        val toObj = stroke.getJSONObject("to")
        
        val fx = fromObj.optDouble("xPct", 0.0).toFloat()
        val fy = fromObj.optDouble("yPct", 0.0).toFloat()
        val tx = toObj.optDouble("xPct", 0.0).toFloat()
        val ty = toObj.optDouble("yPct", 0.0).toFloat()
        
        val colorStr = stroke.optString("color", "#000000")
        val isEraser = stroke.optBoolean("isEraser", false)
        drawView.addPartnerStroke(fx, fy, tx, ty, Color.parseColor(colorStr), isEraser)
    }

    data class PStroke(val fx: Float, val fy: Float, val tx: Float, val ty: Float, val color: Int, val isEraser: Boolean)

    inner class DrawView(context: Context) : View(context) {
        var currentColor = Color.BLACK
        var isEraser = false

        init {
            // Включаем программную отрисовку, чтобы ластик (CLEAR) работал корректно
            setLayerType(View.LAYER_TYPE_SOFTWARE, null)
        }

        private val paint = Paint().apply { style = Paint.Style.STROKE; strokeWidth = 5f; isAntiAlias = true; strokeCap = Paint.Cap.ROUND }
        private val partnerPaint = Paint().apply { style = Paint.Style.STROKE; strokeWidth = 5f; isAntiAlias = true; strokeCap = Paint.Cap.ROUND }
        
        private val partnerStrokes = mutableListOf<PStroke>()
        private val myPaths = mutableListOf<Pair<Path, Pair<Int, Boolean>>>()
        
        private var lastX = 0f
        private var lastY = 0f
        private var currentPath: Path? = null
        private var currentPathColor = Color.BLACK
        private var currentPathEraser = false
        private var isDrawing = false

        fun clearMyCanvas() {
            myPaths.clear()
            currentPath = null
            invalidate()
        }

        fun clearPartnerCanvas() {
            partnerStrokes.clear()
        }

        fun addPartnerStroke(fx: Float, fy: Float, tx: Float, ty: Float, color: Int, eraser: Boolean) {
            partnerStrokes.add(PStroke(fx, fy, tx, ty, color, eraser))
        }

        override fun onTouchEvent(event: MotionEvent): Boolean {
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    currentPath = Path().apply { moveTo(event.x, event.y) }
                    currentPathColor = currentColor
                    currentPathEraser = isEraser
                    lastX = event.x; lastY = event.y; isDrawing = true
                    return true
                }
                MotionEvent.ACTION_MOVE -> {
                    if (isDrawing) {
                        currentPath?.quadTo(lastX, lastY, event.x, event.y)
                        val w = if (width > 0) width.toDouble() else 1.0
                        val h = if (height > 0) height.toDouble() else 1.0
                        
                        val colorHex = String.format("#%06X", 0xFFFFFF and currentColor)
                        
                        val data = JSONObject().apply {
                            put("from", JSONObject().put("xPct", lastX / w).put("yPct", lastY / h))
                            put("to", JSONObject().put("xPct", event.x / w).put("yPct", event.y / h))
                            put("color", colorHex)
                            put("isEraser", currentPathEraser)
                        }
                        socket?.emit("draw", data)
                        lastX = event.x; lastY = event.y; invalidate()
                    }
                    return true
                }
                MotionEvent.ACTION_UP -> {
                    currentPath?.let { myPaths.add(it to Pair(currentPathColor, currentPathEraser)) }
                    currentPath = null; isDrawing = false
                    invalidate()
                    return true
                }
            }
            return super.onTouchEvent(event)
        }

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            
            // Рисуем свои линии
            for ((path, pInfo) in myPaths) {
                paint.color = pInfo.first
                // Если это ластик — включаем режим стирания (прозрачность)
                paint.xfermode = if (pInfo.second) PorterDuffXfermode(PorterDuff.Mode.CLEAR) else null
                canvas.drawPath(path, paint)
            }
            currentPath?.let {
                paint.color = currentPathColor
                paint.xfermode = if (currentPathEraser) PorterDuffXfermode(PorterDuff.Mode.CLEAR) else null
                canvas.drawPath(it, paint)
            }
            paint.xfermode = null // Сбрасываем режим
            
            // Рисуем линии партнера
            for (s in partnerStrokes) {
                partnerPaint.color = s.color
                partnerPaint.xfermode = if (s.isEraser) PorterDuffXfermode(PorterDuff.Mode.CLEAR) else null
                val path = Path().apply { moveTo(s.fx * width, s.fy * height); lineTo(s.tx * width, s.ty * height) }
                canvas.drawPath(path, partnerPaint)
            }
            partnerPaint.xfermode = null
        }
    }
}
