# CVS Chat Bot

A standalone Ollama-powered chat bot module for CVS app testing assistance.

## Features

- **AI Assistant**: Helps with test coverage analysis, gap identification, and test recommendations
- **Ollama Integration**: Uses local LLM models for intelligent responses
- **Fallback Mode**: Works even when Ollama is unavailable
- **Standalone Server**: Runs on port 3004 independently
- **Modern UI**: Clean, responsive chat interface

## Setup

### Prerequisites

- Node.js (v14 or higher)
- Ollama installed and running (optional, for AI features)
- Ollama model: `llama3.2` (or any compatible model)

### Installation

```bash
cd chat-bot
npm install
```

### Usage

#### Start the Chat Bot Server

```bash
npm start
# or
node server.js
```

The chat bot will be available at `http://localhost:3004`

#### Start Ollama (if not already running)

```bash
# Install Ollama if not already installed
curl -fsSL https://ollama.ai/install.sh | sh

# Start Ollama service
ollama serve

# Pull the default model
ollama pull llama3.2
```

## Integration with Electron GUI

The chat bot is integrated into the main dashboard:

1. **Floating Action Button**: 🤖 button in bottom-right corner
2. **Side Panel**: Slides in from the right when clicked
3. **Status Indicators**: Badge shows connection status:
   - 🟢 Green: Ollama connected and ready
   - 🟡 Yellow: Ollama offline (fallback mode)
   - ⚪ Gray: Chat bot server not running

## API Endpoints

### `GET /api/ollama/status`
Check Ollama connection and available models.

### `POST /api/chat`
Send chat messages and get AI responses.

**Request:**
```json
{
  "message": "What are the test coverage gaps?",
  "history": [],
  "model": "llama3.2"
}
```

**Response:**
```json
{
  "reply": "Based on the current analysis...",
  "source": "ollama",
  "model": "llama3.2"
}
```

### `GET /api/graph`
Get the current test coverage graph data.

## Configuration

Environment variables:

- `PORT`: Server port (default: 3004)
- `OLLAMA_URL`: Ollama API URL (default: http://localhost:11434)
- `OLLAMA_MODEL`: Default model (default: llama3.2)

## Development

### Project Structure

```
chat-bot/
├── package.json          # Dependencies and scripts
├── server.js             # Express server and API endpoints
├── public/
│   └── index.html        # Chat interface
└── README.md             # This file
```

### How it Works

1. **File Scanning**: Scans `.maestro/flows` for test files
2. **Graph Building**: Creates a coverage graph from test data
3. **AI Analysis**: Uses Ollama to analyze coverage and provide recommendations
4. **Fallback Responses**: Provides helpful responses even without AI

## Troubleshooting

### Chat bot not responding

1. Check if the server is running: `http://localhost:3004`
2. Verify Ollama is running: `ollama list`
3. Check browser console for errors

### Ollama connection issues

1. Ensure Ollama is installed and running
2. Check if the model is downloaded: `ollama list`
3. Verify Ollama URL: `curl http://localhost:11434/api/tags`

### Integration issues

1. Check if the chat bot server is running on port 3004
2. Verify the dashboard can access `http://localhost:3004`
3. Check browser network tab for CORS issues

## Features in Detail

### Coverage Analysis
- Identifies screens with no tests
- Highlights feature coverage gaps
- Provides coverage statistics

### Test Recommendations
- Suggests high-priority test flows
- Recommends test strategies
- Identifies missing edge cases

### Interactive Chat
- Natural language interface
- Context-aware responses
- Quick prompt buttons

## License

MIT License - see LICENSE file for details.
