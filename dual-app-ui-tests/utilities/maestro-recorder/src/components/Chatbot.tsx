import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  TextField,
  IconButton,
  Typography,
  List,
  ListItem,
  Chip,
  Fab,
  Collapse,
  Divider,
  Avatar
} from '@mui/material';
import {
  Send as SendIcon,
  Close as CloseIcon,
  SmartToy as BotIcon
} from '@mui/icons-material';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatbotProps {
  ws: WebSocket | null;
  context?: {
    currentScreen?: string;
    devicePlatform?: string;
    recordedSteps?: number;
    recentActions?: string[];
  };
}

export const Chatbot: React.FC<ChatbotProps> = ({ ws, context }) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [helpTopics, setHelpTopics] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);

      if (data.type === 'chat-response') {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.message,
          timestamp: data.timestamp
        }]);
      } else if (data.type === 'help-topics') {
        setHelpTopics(data.topics);
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open && helpTopics.length === 0 && ws) {
      ws.send(JSON.stringify({ type: 'get-help-topics' }));
    }
  }, [open, ws, helpTopics.length]);

  const handleSendMessage = () => {
    if (!inputMessage.trim() || !ws) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);

    ws.send(JSON.stringify({
      type: 'chat-message',
      message: inputMessage,
      context: context
    }));

    setInputMessage('');
  };

  const handleTopicClick = (topic: string) => {
    if (!ws) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: topic,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);

    ws.send(JSON.stringify({
      type: 'chat-message',
      message: topic,
      context: context
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="chat"
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000
        }}
        onClick={() => setOpen(!open)}
      >
        {open ? <CloseIcon /> : <BotIcon />}
      </Fab>

      {/* Chat Window */}
      <Collapse in={open}>
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            bottom: 96,
            right: 24,
            width: 400,
            height: 600,
            zIndex: 999,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 2
          }}
        >
          {/* Header */}
          <Box
            sx={{
              p: 2,
              bgcolor: 'primary.main',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTopLeftRadius: 8,
              borderTopRightRadius: 8
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BotIcon />
              <Typography variant="h6">Maestro Assistant</Typography>
            </Box>
            <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Quick Help Topics */}
          {messages.length === 0 && helpTopics.length > 0 && (
            <Box sx={{ p: 2, bgcolor: '#f5f5f5' }}>
              <Typography variant="caption" sx={{ mb: 1, display: 'block', color: '#666' }}>
                Quick Help Topics:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {helpTopics.slice(0, 6).map((topic, index) => (
                  <Chip
                    key={index}
                    label={topic}
                    size="small"
                    onClick={() => handleTopicClick(topic)}
                    sx={{ 
                      cursor: 'pointer',
                      bgcolor: '#e0e0e0',
                      color: '#333',
                      '&:hover': {
                        bgcolor: '#d0d0d0'
                      }
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}

          <Divider />

          {/* Messages */}
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              p: 2,
              bgcolor: '#f5f5f5'
            }}
          >
            {messages.length === 0 ? (
              <Box sx={{ textAlign: 'center', mt: 4, color: '#666' }}>
                <BotIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5, color: '#999' }} />
                <Typography variant="body2" sx={{ color: '#333' }}>
                  Hi! I'm your Maestro Assistant. Ask me anything about:
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, color: '#555' }}>
                  • Recording and editing tests<br />
                  • Accessibility validation<br />
                  • Exporting flows and subflows<br />
                  • Device-specific steps<br />
                  • Framework best practices
                </Typography>
              </Box>
            ) : (
              <List sx={{ p: 0 }}>
                {messages.map((msg, index) => (
                  <ListItem
                    key={index}
                    sx={{
                      display: 'flex',
                      justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      mb: 1,
                      p: 0
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        gap: 1,
                        maxWidth: '85%',
                        flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor: msg.role === 'user' ? 'primary.main' : 'secondary.main'
                        }}
                      >
                        {msg.role === 'user' ? 'U' : <BotIcon sx={{ fontSize: 20 }} />}
                      </Avatar>
                      <Paper
                        elevation={1}
                        sx={{
                          p: 1.5,
                          bgcolor: msg.role === 'user' ? '#22d3ee' : 'rgba(255,255,255,0.92)',
                          color: msg.role === 'user' ? '#0b1220' : 'inherit',
                          borderRadius: 2
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            color: msg.role === 'user' ? 'white' : '#333'
                          }}
                        >
                          {msg.content}
                        </Typography>
                      </Paper>
                    </Box>
                  </ListItem>
                ))}
                <div ref={messagesEndRef} />
              </List>
            )}
          </Box>

          {/* Input */}
          <Box sx={{ p: 2, bgcolor: 'white', borderTop: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Ask me anything..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                multiline
                maxRows={3}
                sx={{
                  '& .MuiInputBase-root': {
                    bgcolor: 'white',
                    color: '#333'
                  },
                  '& .MuiInputBase-input': {
                    color: '#333'
                  },
                  '& .MuiInputBase-input::placeholder': {
                    color: '#999',
                    opacity: 1
                  }
                }}
                InputProps={{
                  sx: {
                    bgcolor: 'white',
                    color: '#333'
                  }
                }}
              />
              <IconButton
                color="primary"
                onClick={handleSendMessage}
                disabled={!inputMessage.trim()}
              >
                <SendIcon />
              </IconButton>
            </Box>
          </Box>
        </Paper>
      </Collapse>
    </>
  );
};
