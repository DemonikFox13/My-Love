const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const config = require('./src/config');
const apiRouter = require('./src/api');
const storage = require('./src/storage');
const { initSocket } = require('./src/socket');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json({ limit: `${Math.floor(config.MAX_BACKGROUND_BYTES / (1024*1024))}mb` }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/saves', express.static(storage.SAVES_DIR));
app.use('/api', apiRouter);

initSocket(io);

const PORT = 8000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
  console.log(`   Папка сохранений: ${storage.SAVES_DIR}`);
});
