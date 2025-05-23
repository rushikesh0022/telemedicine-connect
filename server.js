// server.js - Professional Node.js backend for video calling platform
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || crypto.randomBytes(64).toString('hex');

// Enhanced logging with daily rotate
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'video-call-app' },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log',
      level: 'error',
      maxFiles: '14d'
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxFiles: '14d'
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Rate limiting with different windows for different endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per window
  message: { 
    success: false, 
    message: 'Too many login attempts, please try again later.' 
  }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { 
    success: false, 
    message: 'Too many requests from this IP, please try again later.'
  }
});

// Security and performance middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.socket.io", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      mediaSrc: ["'self'", "blob:"],
      fontSrc: ["'self'", "https:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6 // Balanced compression level
}));

app.use('/api/', apiLimiter);
app.use('/login', authLimiter);
app.use('/register', authLimiter);

const corsOptions = {
  origin: process.env.NODE_ENV === 'production' ? 'your-domain.com' : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600 // Cache preflight requests for 10 minutes
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Enhanced data stores with monitoring
class MonitoredMap extends Map {
  constructor(name) {
    super();
    this.name = name;
    this.monitorInterval = setInterval(() => this.monitor(), 300000); // Monitor every 5 minutes
  }

  monitor() {
    logger.info(`${this.name} stats: ${this.size} entries`);
  }

  cleanup() {
    clearInterval(this.monitorInterval);
  }
}

const users = new MonitoredMap('Users');
const activeSessions = new MonitoredMap('Active Sessions');
const rooms = new MonitoredMap('Rooms');
const userSockets = new MonitoredMap('User Sockets');

// Create required directories
['./uploads', './logs'].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Enhanced WebSocket server with monitoring
const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions,
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
});

// Socket.IO middleware for authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const user = jwt.verify(token, SECRET_KEY);
    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

// WebSocket connection handling with improved error handling
io.on('connection', (socket) => {
  logger.info(`New WebRTC connection: ${socket.id}`);

  // Set per-socket timeout handling
  socket.conn.on('timeout', () => {
    logger.warn(`Socket ${socket.id} timed out`);
    socket.disconnect(true);
  });

  // Track socket errors
  socket.conn.on('error', (error) => {
    logger.error(`Socket ${socket.id} error:`, error);
  });

  // Join room with validation and error handling
  socket.on('join-room', async (data) => {
    try {
      const { roomId, userId, userName } = data;
      
      if (!roomId || !userId || !userName) {
        throw new Error('Invalid room join request');
      }

      // Rate limit room joins
      const joinCount = socket.joinCount || 0;
      if (joinCount > 10) { // Max 10 room joins per connection
        throw new Error('Too many room join attempts');
      }
      socket.joinCount = joinCount + 1;

      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
      }

      // Limit room size
      if (rooms.get(roomId).size >= 10) { // Max 10 users per room
        throw new Error('Room is full');
      }

      rooms.get(roomId).add(socket.id);
      userSockets.set(socket.id, { userId, userName, roomId });
      
      await socket.join(roomId);

      // Notify others in the room
      socket.to(roomId).emit('user-joined', {
        userId,
        userName,
        socketId: socket.id
      });

      // Send existing users to the new participant
      const existingUsers = Array.from(rooms.get(roomId))
        .filter(id => id !== socket.id)
        .map(id => userSockets.get(id))
        .filter(user => user);

      socket.emit('existing-users', existingUsers);
      logger.info(`User ${userName} joined room ${roomId}`);

    } catch (error) {
      logger.error('Error joining room:', error);
      socket.emit('error', { message: error.message });
    }
  });
  
  // WebRTC signaling
  socket.on('offer', (data) => {
    socket.to(data.target).emit('offer', {
      offer: data.offer,
      sender: socket.id
    });
  });
  
  socket.on('answer', (data) => {
    socket.to(data.target).emit('answer', {
      answer: data.answer,
      sender: socket.id
    });
  });
  
  socket.on('ice-candidate', (data) => {
    socket.to(data.target).emit('ice-candidate', {
      candidate: data.candidate,
      sender: socket.id
    });
  });
  
  // Chat messages
  socket.on('chat-message', (data) => {
    const userInfo = userSockets.get(socket.id);
    if (userInfo) {
      socket.to(userInfo.roomId).emit('chat-message', {
        message: data.message,
        sender: userInfo.userName,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Screen sharing
  socket.on('start-screen-share', (data) => {
    const userInfo = userSockets.get(socket.id);
    if (userInfo) {
      socket.to(userInfo.roomId).emit('screen-share-started', {
        sender: socket.id,
        userName: userInfo.userName
      });
    }
  });
  
  socket.on('stop-screen-share', (data) => {
    const userInfo = userSockets.get(socket.id);
    if (userInfo) {
      socket.to(userInfo.roomId).emit('screen-share-stopped', {
        sender: socket.id
      });
    }
  });
  
  // Handle encrypted message events
  socket.on('chat-message', (data) => {
    try {
      const roomId = data.roomId;
      const room = rooms.get(roomId);
      
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      
      const sender = users.get(socket.id);
      if (!sender) {
        socket.emit('error', { message: 'User not found' });
        return;
      }
      
      // Forward the message to all users in the room except the sender
      socket.to(roomId).emit('chat-message', {
        message: data.message,
        sender: sender.name,
        encrypted: data.encrypted || false,
        timestamp: new Date().toISOString()
      });
      
      logger.info(`${data.encrypted ? 'Encrypted' : ''} Chat message sent in room ${roomId} by ${sender.name}`);
    } catch (error) {
      logger.error('Error handling chat message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });
  
  // Handle file transfer events
  socket.on('file-transfer', (data) => {
    try {
      const roomId = data.roomId;
      const room = rooms.get(roomId);
      
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      
      const sender = users.get(socket.id);
      if (!sender) {
        socket.emit('error', { message: 'User not found' });
        return;
      }
      
      // If a specific target is provided, send only to that user
      if (data.target) {
        socket.to(data.target).emit('file-transfer', {
          fileData: data.fileData,
          fileInfo: data.fileInfo,
          fileName: data.fileName,
          fileType: data.fileType,
          fileSize: data.fileSize,
          encrypted: data.encrypted || false,
          sender: sender.name,
          timestamp: new Date().toISOString()
        });
      } else {
        // Otherwise, broadcast to all users in the room except the sender
        socket.to(roomId).emit('file-transfer', {
          fileData: data.fileData,
          fileInfo: data.fileInfo,
          fileName: data.fileName,
          fileType: data.fileType,
          fileSize: data.fileSize,
          encrypted: data.encrypted || false,
          sender: sender.name,
          timestamp: new Date().toISOString()
        });
      }
      
      logger.info(`${data.encrypted ? 'Encrypted' : ''} File transfer in room ${roomId} by ${sender.name}`);
    } catch (error) {
      logger.error('Error handling file transfer:', error);
      socket.emit('error', { message: 'Failed to transfer file' });
    }
  });
  
  // Handle encryption public key sharing
  socket.on('public-key', (data) => {
    try {
      const roomId = data.roomId;
      const room = rooms.get(roomId);
      
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      
      // If a specific target is provided, send only to that user
      if (data.target) {
        socket.to(data.target).emit('public-key', {
          publicKey: data.publicKey,
          sender: socket.id
        });
      } else {
        // Otherwise, broadcast to all users in the room except the sender
        socket.to(roomId).emit('public-key', {
          publicKey: data.publicKey,
          sender: socket.id
        });
      }
      
      logger.info(`Public key shared in room ${roomId} by ${socket.id}`);
    } catch (error) {
      logger.error('Error handling public key sharing:', error);
      socket.emit('error', { message: 'Failed to share public key' });
    }
  });
  
  // Handle encrypted session key sharing
  socket.on('encrypted-session-key', (data) => {
    try {
      // Send only to the target user
      if (data.target) {
        socket.to(data.target).emit('encrypted-session-key', {
          encryptedSessionKey: data.encryptedSessionKey,
          sender: socket.id
        });
        
        logger.info(`Encrypted session key shared with ${data.target} by ${socket.id}`);
      } else {
        socket.emit('error', { message: 'Target required for sharing encrypted session key' });
      }
    } catch (error) {
      logger.error('Error handling encrypted session key sharing:', error);
      socket.emit('error', { message: 'Failed to share encrypted session key' });
    }
  });
  
  // Enhanced cleanup on disconnect
  socket.on('disconnect', async () => {
    try {
      const userInfo = userSockets.get(socket.id);
      if (userInfo) {
        const { roomId, userName } = userInfo;

        if (rooms.has(roomId)) {
          rooms.get(roomId).delete(socket.id);
          if (rooms.get(roomId).size === 0) {
            rooms.delete(roomId);
          }
        }

        socket.to(roomId).emit('user-left', {
          socketId: socket.id,
          userName
        });

        userSockets.delete(socket.id);
        logger.info(`User ${userName} left room ${roomId}`);
      }
    } catch (error) {
      logger.error('Error handling disconnect:', error);
    }
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Starting graceful shutdown...');
  
  // Close all WebSocket connections
  io.close(() => {
    logger.info('All WebSocket connections closed.');
  });

  // Close HTTP server
  server.close(() => {
    logger.info('HTTP server closed.');
    
    // Cleanup data stores
    [users, activeSessions, rooms, userSockets].forEach(store => {
      if (store.cleanup) store.cleanup();
    });

    // Exit process
    process.exit(0);
  });

  // Force exit if graceful shutdown fails
  setTimeout(() => {
    logger.error('Forced shutdown initiated.');
    process.exit(1);
  }, 10000);
});

// Start server
server.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
    console.log(`🚀 Professional Video Call Server running on http://localhost:${PORT}`);
});
