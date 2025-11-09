const express = require('express');
const http = require('http');
require('dotenv').config();
const path = require('path');
const fs = require('fs');
// Import professional API middleware
const {
  rateLimiters,
  securityMiddleware,
  requestLogger,
  errorHandler,
  healthCheck,
  responseFormatter,
  requestId,
  apiVersioning,
  cacheControl
} = require('./middleware/apiMiddleware');

// Import enhanced security middleware
const {
  securityMiddleware: enhancedSecurity,
  sanitizeRequest,
  logRequest,
  errorHandler: enhancedErrorHandler
} = require('./middleware/securityMiddleware');

// Import monitoring
const { recordRequestMetrics } = require('./routes/monitoring');

const agentRoutes = require('./routes/agents');
const chatRoutes = require('./routes/chat');
const blockchainRoutes = require('./routes/blockchain');
const analyticsRoutes = require('./routes/analytics');
const chartRoutes = require('./routes/chartRoutes');
const authRoutes = require('./routes/auth');
const tradingRoutes = require('./routes/trading');
const uploadRoutes = require('./routes/upload');
const { router: monitoringRoutes } = require('./routes/monitoring');

// Services
const EventListener = require('./services/EventListener');
const WebSocketService = require('./services/WebSocketService');
const BlockchainService = require('./services/BlockchainService');
const TradingService = require('./services/TradingService');
const databaseService = require('./config/database');
const RealTimeUpdater = require('./services/RealTimeUpdater');
const RealTimeDataProcessor = require('./services/RealTimeDataProcessor');
const LoggingService = require('./services/LoggingService');
const MonitoringService = require('./services/MonitoringService');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// CORS middleware - MUST BE FIRST
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-payment-signature');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// Professional API middleware setup
app.use(requestId);
app.use(logRequest);
app.use(recordRequestMetrics);
app.use(healthCheck);
app.use(apiVersioning);
app.use(enhancedSecurity.helmet);
app.use(sanitizeRequest);
app.use(...securityMiddleware);
// RATE LIMITING DISABLED FOR DEVELOPMENT

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Response formatting
app.use(responseFormatter);

// WebSocket service will be initialized in startServer function

// WebSocket status endpoint will be added after service initialization

// Add Database status endpoint
app.get('/api/database/status', async (req, res) => {
  try {
    const healthCheck = await DatabaseService.healthCheck();
    const stats = await DatabaseService.getStats();

    res.json({
      health: healthCheck,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get database status',
      timestamp: new Date().toISOString()
    });
  }
});

// Add monitoring endpoints
app.get('/api/monitoring/health', async (req, res) => {
  try {
    const healthSummary = await global.monitoringService?.getHealthSummary() || {
      status: 'unknown',
      message: 'Monitoring service not available'
    };
    res.json(healthSummary);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/monitoring/metrics', async (req, res) => {
  try {
    const metrics = global.monitoringService?.getCurrentMetrics() || {};
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API Routes - RATE LIMITING DISABLED FOR TRADING
app.use('/api/auth', authRoutes);
app.use('/api/trading', tradingRoutes); // NO RATE LIMITING
app.use('/api/agents', agentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/chart', chartRoutes);
app.use('/api/social', require('./routes/social'));
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/dex', require('./routes/dex'));


// Serve uploaded files statically with CORS
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  },
  express.static(uploadDir)
);


// Professional error handling middleware
app.use(enhancedErrorHandler);
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Initialize and start server
async function startServer() {
  try {
    // Connect to database
    await databaseService.connect();

    // Initialize logging and monitoring
    console.log('🔧 Initializing logging and monitoring...');
    const loggingService = new LoggingService();
    const monitoringService = new MonitoringService(databaseService, loggingService);

    // Make services globally available
    global.loggingService = loggingService;
    global.monitoringService = monitoringService;

    // Initialize services
    console.log('🔧 Initializing services...');

    // Initialize blockchain service
    const blockchainService = new BlockchainService();

    // Initialize WebSocket service
    const websocketService = new WebSocketService(server);

    // Make services globally available
    global.websocketService = websocketService;
    global.databaseService = databaseService;

    // Initialize real-time data processor
    const dataProcessor = new RealTimeDataProcessor(
      blockchainService,
      databaseService,
      websocketService
    );

    // Initialize event listener with data processor
    const eventListener = new EventListener(blockchainService, websocketService);
    eventListener.dataProcessor = dataProcessor;
    blockchainService.setEventListener(eventListener);

    // Initialize real-time updater
    console.log('🚀 Starting real-time blockchain data updater...');
    const realTimeUpdater = new RealTimeUpdater();
    realTimeUpdater.start();

    // Start real-time event processing
    setInterval(() => {
      eventListener.processRealTimeEvents();
    }, 30000); // Process every 30 seconds

    // Add WebSocket status endpoint
    app.get('/api/websocket/status', (req, res) => {
      res.json({
        connected: websocketService.getConnectedClients(),
        subscriptions: websocketService.getClientSubscriptions(),
        timestamp: new Date().toISOString()
      });
    });

    console.log('✅ Services initialized successfully!');

    // Database ready for real agents
    console.log('🌱 Database ready for real agents...');
    const Agent = require('./models/Agent');
    const agentCount = await Agent.countDocuments();
    console.log(`📊 Current agents in database: ${agentCount}`);
    console.log('🚀 Ready to receive real agent deployments from Solana devnet!');

    // Start server
    console.log(`🔧 Attempting to start server on port ${PORT}...`);
    server.listen(PORT, () => {
      console.log(`🚀 URSUS Backend API running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🤖 AI Agents API: http://localhost:${PORT}/api/agents`);
      console.log(`💬 Chat API: http://localhost:${PORT}/api/chat`);
      console.log(`⛓️  Blockchain API: http://localhost:${PORT}/api/blockchain`);
      console.log(` Analytics API: http://localhost:${PORT}/api/analytics`);
      console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
      console.log(`📡 WebSocket Status: http://localhost:${PORT}/api/websocket/status`);
      console.log(`📊 Database Status: http://localhost:${PORT}/api/database/status`);
      console.log('✅ All services initialized successfully!');
    });

    // Handle server errors
    server.on('error', (error) => {
      console.error('❌ Server error:', error);
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
