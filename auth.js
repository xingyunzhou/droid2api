import fs from 'fs';
import path from 'path';
import os from 'os';
import fetch from 'node-fetch';
import { logDebug, logError, logInfo } from './logger.js';

// State management for API key and refresh
let currentApiKey = null;
let currentRefreshToken = null;
let lastRefreshTime = null;
let clientId = null;
let authSource = null; // 'env' or 'file'
let authFilePath = null;

const REFRESH_URL = 'https://api.workos.com/user_management/authenticate';
const REFRESH_INTERVAL_HOURS = 6; // Refresh every 6 hours
const TOKEN_VALID_HOURS = 8; // Token valid for 8 hours

/**
 * Generate a ULID (Universally Unique Lexicographically Sortable Identifier)
 * Format: 26 characters using Crockford's Base32
 * First 10 chars: timestamp (48 bits)
 * Last 16 chars: random (80 bits)
 */
function generateULID() {
  // Crockford's Base32 alphabet (no I, L, O, U to avoid confusion)
  const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  
  // Get timestamp in milliseconds
  const timestamp = Date.now();
  
  // Encode timestamp to 10 characters
  let time = '';
  let ts = timestamp;
  for (let i = 9; i >= 0; i--) {
    const mod = ts % 32;
    time = ENCODING[mod] + time;
    ts = Math.floor(ts / 32);
  }
  
  // Generate 16 random characters
  let randomPart = '';
  for (let i = 0; i < 16; i++) {
    const rand = Math.floor(Math.random() * 32);
    randomPart += ENCODING[rand];
  }
  
  return time + randomPart;
}

/**
 * Generate a client ID in format: client_01{ULID}
 */
function generateClientId() {
  const ulid = generateULID();
  return `client_01${ulid}`;
}

/**
 * Load initial refresh token from environment or config file
 */
function loadRefreshToken() {
  // 1. Check environment variable DROID_REFRESH_KEY
  const envRefreshKey = process.env.DROID_REFRESH_KEY;
  if (envRefreshKey && envRefreshKey.trim() !== '') {
    logInfo('Using refresh token from DROID_REFRESH_KEY environment variable');
    authSource = 'env';
    authFilePath = path.join(process.cwd(), 'auth.json');
    return envRefreshKey.trim();
  }

  // 2. Check ~/.factory/auth.json
  const homeDir = os.homedir();
  const factoryAuthPath = path.join(homeDir, '.factory', 'auth.json');
  
  try {
    if (fs.existsSync(factoryAuthPath)) {
      const authContent = fs.readFileSync(factoryAuthPath, 'utf-8');
      const authData = JSON.parse(authContent);
      
      if (authData.refresh_token && authData.refresh_token.trim() !== '') {
        logInfo('Using refresh token from ~/.factory/auth.json');
        authSource = 'file';
        authFilePath = factoryAuthPath;
        
        // Also load access_token if available
        if (authData.access_token) {
          currentApiKey = authData.access_token.trim();
        }
        
        return authData.refresh_token.trim();
      }
    }
  } catch (error) {
    logError('Error reading ~/.factory/auth.json', error);
  }

  // 3. No refresh token found - throw error
  const errorMessage = `
╔════════════════════════════════════════════════════════════════╗
║              Refresh Token Not Found                           ║
╚════════════════════════════════════════════════════════════════╝

No valid refresh token found. Please use one of the following methods:

1. Set environment variable:
   export DROID_REFRESH_KEY="your_refresh_token_here"

2. Or ensure ~/.factory/auth.json exists with valid refresh_token:
   {
     "access_token": "your_access_token",
     "refresh_token": "your_refresh_token"
   }

Current status:
  - DROID_REFRESH_KEY: ${envRefreshKey ? 'empty or whitespace' : 'not set'}
  - ~/.factory/auth.json: ${fs.existsSync(factoryAuthPath) ? 'exists but invalid/empty refresh_token' : 'not found'}
`;

  logError(errorMessage);
  throw new Error('Refresh token not found. Please configure DROID_REFRESH_KEY or ~/.factory/auth.json');
}

/**
 * Refresh API key using refresh token
 */
async function refreshApiKey() {
  if (!currentRefreshToken) {
    throw new Error('No refresh token available');
  }

  if (!clientId) {
    clientId = 'client_01HNM792M5G5G1A2THWPXKFMXB';
    logDebug(`Using fixed client ID: ${clientId}`);
  }

  logInfo('Refreshing API key...');

  try {
    // Create form data
    const formData = new URLSearchParams();
    formData.append('grant_type', 'refresh_token');
    formData.append('refresh_token', currentRefreshToken);
    formData.append('client_id', clientId);

    const response = await fetch(REFRESH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to refresh token: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    // Update tokens
    currentApiKey = data.access_token;
    currentRefreshToken = data.refresh_token;
    lastRefreshTime = Date.now();

    // Log user info
    if (data.user) {
      logInfo(`Authenticated as: ${data.user.email} (${data.user.first_name} ${data.user.last_name})`);
      logInfo(`User ID: ${data.user.id}`);
      logInfo(`Organization ID: ${data.organization_id}`);
    }

    // Save tokens to file
    saveTokens(data.access_token, data.refresh_token);

    logInfo('API key refreshed successfully');
    return data.access_token;

  } catch (error) {
    logError('Failed to refresh API key', error);
    throw error;
  }
}

/**
 * Save tokens to appropriate file
 */
function saveTokens(accessToken, refreshToken) {
  try {
    const authData = {
      access_token: accessToken,
      refresh_token: refreshToken,
      last_updated: new Date().toISOString()
    };

    // Ensure directory exists
    const dir = path.dirname(authFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // If saving to ~/.factory/auth.json, preserve other fields
    if (authSource === 'file' && fs.existsSync(authFilePath)) {
      try {
        const existingData = JSON.parse(fs.readFileSync(authFilePath, 'utf-8'));
        Object.assign(authData, existingData, {
          access_token: accessToken,
          refresh_token: refreshToken,
          last_updated: authData.last_updated
        });
      } catch (error) {
        logError('Error reading existing auth file, will overwrite', error);
      }
    }

    fs.writeFileSync(authFilePath, JSON.stringify(authData, null, 2), 'utf-8');
    logDebug(`Tokens saved to ${authFilePath}`);

  } catch (error) {
    logError('Failed to save tokens', error);
  }
}

/**
 * Check if API key needs refresh (older than 6 hours)
 */
function shouldRefresh() {
  if (!lastRefreshTime) {
    return true;
  }

  const hoursSinceRefresh = (Date.now() - lastRefreshTime) / (1000 * 60 * 60);
  return hoursSinceRefresh >= REFRESH_INTERVAL_HOURS;
}

/**
 * Initialize auth system - load refresh token and get initial API key
 */
export async function initializeAuth() {
  try {
    currentRefreshToken = loadRefreshToken();
    
    // Always refresh on startup to get fresh token
    await refreshApiKey();
    
    logInfo('Auth system initialized successfully');
  } catch (error) {
    logError('Failed to initialize auth system', error);
    throw error;
  }
}

/**
 * Get API key, refresh if needed
 */
export async function getApiKey() {
  // Check if we need to refresh
  if (shouldRefresh()) {
    logInfo('API key needs refresh (6+ hours old)');
    await refreshApiKey();
  }

  if (!currentApiKey) {
    throw new Error('No API key available. Please initialize auth system first.');
  }

  return `Bearer ${currentApiKey}`;
}
