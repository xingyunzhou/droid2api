import { logDebug } from '../logger.js';

export function transformToAnthropic(openaiRequest) {
  logDebug('Transforming OpenAI request to Anthropic format');
  
  const anthropicRequest = {
    model: openaiRequest.model,
    messages: [],
    stream: openaiRequest.stream !== false
  };

  // Handle max_tokens
  if (openaiRequest.max_tokens) {
    anthropicRequest.max_tokens = openaiRequest.max_tokens;
  } else if (openaiRequest.max_completion_tokens) {
    anthropicRequest.max_tokens = openaiRequest.max_completion_tokens;
  } else {
    anthropicRequest.max_tokens = 4096;
  }

  // Extract system message(s) and transform other messages
  let systemContent = [];
  
  if (openaiRequest.messages && Array.isArray(openaiRequest.messages)) {
    for (const msg of openaiRequest.messages) {
      // Handle system messages separately
      if (msg.role === 'system') {
        if (typeof msg.content === 'string') {
          systemContent.push({
            type: 'text',
            text: msg.content
          });
        } else if (Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part.type === 'text') {
              systemContent.push({
                type: 'text',
                text: part.text
              });
            } else {
              systemContent.push(part);
            }
          }
        }
        continue; // Skip adding system messages to messages array
      }

      const anthropicMsg = {
        role: msg.role,
        content: []
      };

      if (typeof msg.content === 'string') {
        anthropicMsg.content.push({
          type: 'text',
          text: msg.content
        });
      } else if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'text') {
            anthropicMsg.content.push({
              type: 'text',
              text: part.text
            });
          } else if (part.type === 'image_url') {
            anthropicMsg.content.push({
              type: 'image',
              source: part.image_url
            });
          } else {
            anthropicMsg.content.push(part);
          }
        }
      }

      anthropicRequest.messages.push(anthropicMsg);
    }
  }

  // Add system parameter if system content exists
  if (systemContent.length > 0) {
    anthropicRequest.system = systemContent;
  }

  // Transform tools if present
  if (openaiRequest.tools && Array.isArray(openaiRequest.tools)) {
    anthropicRequest.tools = openaiRequest.tools.map(tool => {
      if (tool.type === 'function') {
        return {
          name: tool.function.name,
          description: tool.function.description,
          input_schema: tool.function.parameters || {}
        };
      }
      return tool;
    });
  }

  // Pass through other compatible parameters
  if (openaiRequest.temperature !== undefined) {
    anthropicRequest.temperature = openaiRequest.temperature;
  }
  if (openaiRequest.top_p !== undefined) {
    anthropicRequest.top_p = openaiRequest.top_p;
  }
  if (openaiRequest.stop !== undefined) {
    anthropicRequest.stop_sequences = Array.isArray(openaiRequest.stop) 
      ? openaiRequest.stop 
      : [openaiRequest.stop];
  }

  logDebug('Transformed Anthropic request', anthropicRequest);
  return anthropicRequest;
}

export function getAnthropicHeaders(authHeader, clientHeaders = {}, isStreaming = true) {
  // Generate unique IDs if not provided
  const sessionId = clientHeaders['x-session-id'] || generateUUID();
  const messageId = clientHeaders['x-assistant-message-id'] || generateUUID();
  
  const headers = {
    'accept': 'application/json',
    'content-type': 'application/json',
    'anthropic-version': '2023-06-01',
    'anthropic-beta': 'interleaved-thinking-2025-05-14',
    'x-api-key': 'placeholder',
    'authorization': authHeader || '',
    'x-model-provider': 'anthropic',
    'x-factory-client': 'cli',
    'x-session-id': sessionId,
    'x-assistant-message-id': messageId,
    'user-agent': 'a$/JS 0.57.0',
    'x-stainless-timeout': '600',
    'connection': 'keep-alive'
  };

  // Pass through Stainless SDK headers with defaults
  const stainlessDefaults = {
    'x-stainless-arch': 'x64',
    'x-stainless-lang': 'js',
    'x-stainless-os': 'MacOS',
    'x-stainless-runtime': 'node',
    'x-stainless-retry-count': '0',
    'x-stainless-package-version': '0.57.0',
    'x-stainless-runtime-version': 'v24.3.0'
  };

  // Set helper-method based on streaming
  if (isStreaming) {
    headers['x-stainless-helper-method'] = 'stream';
  }

  // Copy Stainless headers from client or use defaults
  Object.keys(stainlessDefaults).forEach(header => {
    headers[header] = clientHeaders[header] || stainlessDefaults[header];
  });

  // Override timeout from defaults if client provided
  if (clientHeaders['x-stainless-timeout']) {
    headers['x-stainless-timeout'] = clientHeaders['x-stainless-timeout'];
  }

  return headers;
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
