import { useState, useEffect, useRef } from 'react';
import { gameClient } from '../GameClient';
import type { ChatMessage } from '../types';

export default function Chat({ username }: { username: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (msg: ChatMessage) => {
      setMessages(prev => [...prev.slice(-50), msg]);
      if (!open) setUnread(u => u + 1);
    };
    gameClient.on('chatMessage', handler);
    return () => { gameClient.off('chatMessage', handler); };
  }, [open]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    if (input.trim()) {
      gameClient.sendChat(input.trim());
      setInput('');
    }
  };

  return (
    <div className={`chat-panel ${open ? 'open' : 'closed'}`}>
      <div className="chat-header" onClick={() => { setOpen(!open); setUnread(0); }}>
        <span>💬 Chat</span>
        {unread > 0 && <span className="chat-unread">{unread}</span>}
        <span className="chat-toggle">{open ? '▼' : '▲'}</span>
      </div>
      {open && (
        <>
          <div className="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.username === username ? 'mine' : ''}`}>
                <span className="chat-user">{m.username}:</span>
                <span className="chat-text">{m.message}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="chat-input">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Type a message..."
              maxLength={200}
            />
            <button onClick={send}>Send</button>
          </div>
        </>
      )}
    </div>
  );
}
