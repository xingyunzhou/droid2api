import { logDebug } from '../logger.js';

export function transformToOpenAI(openaiRequest) {
  logDebug('Transforming OpenAI request to target OpenAI format');
  
  const targetRequest = {
    model: openaiRequest.model,
    input: [],
    store: false,
    stream: openaiRequest.stream !== false
  };

  // Transform max_tokens to max_output_tokens
  if (openaiRequest.max_tokens) {
    targetRequest.max_output_tokens = openaiRequest.max_tokens;
  } else if (openaiRequest.max_completion_tokens) {
    targetRequest.max_output_tokens = openaiRequest.max_completion_tokens;
  }

  // Transform messages to input
  if (openaiRequest.messages && Array.isArray(openaiRequest.messages)) {
    for (const msg of openaiRequest.messages) {
      const inputMsg = {
        role: msg.role,
        content: []
      };

      // Determine content type based on role
      // user role uses 'input_text', assistant role uses 'output_text'
      const textType = msg.role === 'assistant' ? 'output_text' : 'input_text';
      const imageType = msg.role === 'assistant' ? 'output_image' : 'input_image';

      if (typeof msg.content === 'string') {
        inputMsg.content.push({
          type: textType,
          text: msg.content
        });
      } else if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'text') {
            inputMsg.content.push({
              type: textType,
              text: part.text
            });
          } else if (part.type === 'image_url') {
            inputMsg.content.push({
              type: imageType,
              image_url: part.image_url
            });
          } else {
            // Pass through other types as-is
            inputMsg.content.push(part);
          }
        }
      }

      targetRequest.input.push(inputMsg);
    }
  }

  // Transform tools if present
  if (openaiRequest.tools && Array.isArray(openaiRequest.tools)) {
    targetRequest.tools = openaiRequest.tools.map(tool => ({
      ...tool,
      strict: false
    }));
  }

  // Extract system message as instructions
  const systemMessage = openaiRequest.messages?.find(m => m.role === 'system');
  if (systemMessage) {
    if (typeof systemMessage.content === 'string') {
      targetRequest.instructions = systemMessage.content;
    } else if (Array.isArray(systemMessage.content)) {
      targetRequest.instructions = systemMessage.content
        .filter(p => p.type === 'text')
        .map(p => p.text)
        .join('\n');
    }
    targetRequest.input = targetRequest.input.filter(m => m.role !== 'system');
  }

  // Pass through other parameters
  if (openaiRequest.temperature !== undefined) {
    targetRequest.temperature = openaiRequest.temperature;
  }
  if (openaiRequest.top_p !== undefined) {
    targetRequest.top_p = openaiRequest.top_p;
  }
  if (openaiRequest.presence_penalty !== undefined) {
    targetRequest.presence_penalty = openaiRequest.presence_penalty;
  }
  if (openaiRequest.frequency_penalty !== undefined) {
    targetRequest.frequency_penalty = openaiRequest.frequency_penalty;
  }
  if (openaiRequest.parallel_tool_calls !== undefined) {
    targetRequest.parallel_tool_calls = openaiRequest.parallel_tool_calls;
  }

  logDebug('Transformed target OpenAI request', targetRequest);
  return targetRequest;
}

export function getOpenAIHeaders(authHeader, clientHeaders = {}) {
  // Generate unique IDs if not provided
  const sessionId = clientHeaders['x-session-id'] || generateUUID();
  const messageId = clientHeaders['x-assistant-message-id'] || generateUUID();
  
  const headers = {
    'content-type': 'application/json',
    'authorization': authHeader || '',
    'x-api-key': 'placeholder',
    'x-factory-client': 'cli',
    'x-session-id': sessionId,
    'x-assistant-message-id': messageId,
    'user-agent': 'cB/JS 5.22.0',
    'connection': 'keep-alive'
  };

  // Pass through Stainless SDK headers with defaults
  const stainlessDefaults = {
    'x-stainless-arch': 'x64',
    'x-stainless-lang': 'js',
    'x-stainless-os': 'MacOS',
    'x-stainless-runtime': 'node',
    'x-stainless-retry-count': '0',
    'x-stainless-package-version': '5.22.0',
    'x-stainless-runtime-version': 'v24.3.0'
  };

  // Copy Stainless headers from client or use defaults
  Object.keys(stainlessDefaults).forEach(header => {
    headers[header] = clientHeaders[header] || stainlessDefaults[header];
  });



  return headers;
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
