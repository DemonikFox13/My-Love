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
import androidx.appcompat.app.AppCompatActivity
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject
import java.net.URI

class MainActivity : AppCompatActivity() {

    // ВАЖНО: Сюда вставь ссылку на твой сайт с BotHost
    private val SERVER_URL = "https://bot-1792486643-5744-demonikfox.bothost.tech"
    private var socket: Socket? = null
    private lateinit var drawView: DrawView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        drawView = DrawView(this)
        setContentView(drawView)

        connectToServer()
    }

    private fun connectToServer() {
        try {
            val options = IO.Options()
            options.transports = arrayOf("websocket")
            options.query = "role=A" // Пока ставим роль A для теста

            socket = IO.socket(URI.create(SERVER_URL), options)

            socket?.on(Socket.EVENT_CONNECT) {
                Log.d("MyLove", "Подключено к серверу!")
            }

            // Принимаем штрихи от партнера (роль B)
            socket?.on("draw") { args ->
                val data = args[0] as JSONObject
                val fromX = data.getJSONObject("from").getDouble("x").toFloat()
                val fromY = data.getJSONObject("from").getDouble("y").toFloat()
                val toX = data.getJSONObject("to").getDouble("x").toFloat()
                val toY = data.getJSONObject("to").getDouble("y").toFloat()
                val colorStr = data.optString("color", "#000000")
                
                runOnUiThread {
                    drawView.drawPartnerStroke(fromX, fromY, toX, toY, Color.parseColor(colorStr))
                }
            }

            socket?.connect()
        } catch (e: Exception) {
            Log.e("MyLove", "Ошибка подключения: ${e.message}")
        }
    }

    // Свой собственный холст
    inner class DrawView(context: Context) : View(context) {
        private val paint = Paint().apply {
            color = Color.BLACK
            style = Paint.Style.STROKE
            strokeWidth = 5f
            isAntiAlias = true
            strokeCap = Paint.Cap.ROUND
        }
        
        private val partnerPaint = Paint().apply {
            style = Paint.Style.STROKE
            strokeWidth = 5f
            isAntiAlias = true
            strokeCap = Paint.Cap.ROUND
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
                        lastX = event.x
                        lastY = event.y
                        
                        // Отправляем штрих на сервер
                        val data = JSONObject().apply {
                            put("from", JSONObject().put("x", lastX).put("y", lastY))
                            put("to", JSONObject().put("x", event.x).put("y", event.y))
                            put("color", "#000000")
                        }
                        socket?.emit("draw", data)
                        
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
            for ((path, p) in paths) {
                canvas.drawPath(path, p)
            }
            currentPath?.let { canvas.drawPath(it, paint) }
        }
    }
}
