import express from 'express';
import { loadConfig, isDevMode, getPort } from './config.js';
import { logInfo, logError } from './logger.js';
import router from './routes.js';
import { initializeAuth } from './auth.js';

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(router);

app.get('/', (req, res) => {
  res.json({
    name: 'droid2api',
    version: '1.0.0',
    description: 'OpenAI Compatible API Proxy',
    endpoints: [
      'GET /v1/models',
      'POST /v1/chat/completions'
    ]
  });
});

app.use((err, req, res, next) => {
  logError('Unhandled error', err);
  res.status(500).json({
    error: 'Internal server error',
    message: isDevMode() ? err.message : undefined
  });
});

(async () => {
  try {
    loadConfig();
    logInfo('Configuration loaded successfully');
    logInfo(`Dev mode: ${isDevMode()}`);
    
    // Initialize auth system (load and refresh API key)
    await initializeAuth();
    
    const PORT = getPort();
  logInfo(`Starting server on port ${PORT}...`);
  
  const server = app.listen(PORT)
    .on('listening', () => {
      logInfo(`Server running on http://localhost:${PORT}`);
      logInfo('Available endpoints:');
      logInfo('  GET  /v1/models');
      logInfo('  POST /v1/chat/completions');
    })
    .on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n${'='.repeat(80)}`);
        console.error(`ERROR: Port ${PORT} is already in use!`);
        console.error('');
        console.error('Please choose one of the following options:');
        console.error(`  1. Stop the process using port ${PORT}:`);
        console.error(`     lsof -ti:${PORT} | xargs kill`);
        console.error('');
        console.error('  2. Change the port in config.json:');
        console.error('     Edit config.json and modify the "port" field');
        console.error(`${'='.repeat(80)}\n`);
        process.exit(1);
      } else {
        logError('Failed to start server', err);
        process.exit(1);
      }
    });
  } catch (error) {
    logError('Failed to start server', error);
    process.exit(1);
  }
})();
