# droid2api

OpenAI 兼容的 API 代理服务器，统一访问不同的 LLM 模型。

## 功能特性

- 🎯 **标准 OpenAI API 接口** - 使用熟悉的 OpenAI API 格式访问所有模型
- 🔄 **自动格式转换** - 自动处理不同 LLM 提供商的格式差异
- 🌊 **流式响应支持** - 支持实时流式输出
- 🔐 **自动认证管理** - 自动刷新和管理 API 访问令牌
- ⚙️ **灵活配置** - 通过配置文件自定义模型和端点

## 安装

```bash
npm install
```

## 快速开始

### 1. 配置认证

设置环境变量或配置文件：

```bash
# 方式1：环境变量
export DROID_REFRESH_KEY="your_refresh_token_here"

# 方式2：配置文件 ~/.factory/auth.json
{
  "access_token": "your_access_token",
  "refresh_token": "your_refresh_token"
}
```

### 2. 配置模型（可选）

编辑 `config.json` 添加或修改模型：

```json
{
  "port": 3000,
  "models": [
    {
      "name": "Claude Opus 4",
      "id": "claude-opus-4-1-20250805",
      "type": "anthropic"
    },
    {
      "name": "GPT-5",
      "id": "gpt-5-2025-08-07",
      "type": "openai"
    }
  ]
}
```

## 使用方法

### 启动服务器

```bash
npm start
```

或使用快捷脚本：

```bash
./start.sh
```

服务器默认运行在 `http://localhost:3000`。

### API 使用

#### 获取模型列表

```bash
curl http://localhost:3000/v1/models
```

#### 对话补全

使用标准 OpenAI 格式调用任何模型：

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-opus-4-1-20250805",
    "messages": [
      {"role": "user", "content": "你好"}
    ],
    "stream": true
  }'
```

**支持的参数：**
- `model` - 模型 ID（必需）
- `messages` - 对话消息数组（必需）
- `stream` - 是否流式输出（默认 true）
- `max_tokens` - 最大输出长度
- `temperature` - 温度参数（0-1）

## 常见问题

### 如何更改端口？

编辑 `config.json` 中的 `port` 字段：

```json
{
  "port": 8080
}
```

### 如何启用调试日志？

在 `config.json` 中设置：

```json
{
  "dev_mode": true
}
```

## 故障排查

### 认证失败

确保已正确配置 refresh token：
- 设置环境变量 `DROID_REFRESH_KEY`
- 或创建 `~/.factory/auth.json` 文件

### 模型不可用

检查 `config.json` 中的模型配置，确保模型 ID 和类型正确。

## 许可证

MIT
