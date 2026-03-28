import { useState, useEffect, useRef } from 'react';
import './ChatSidebar.css';

export default function ChatSidebar({ socket, roomCode, profile }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const chatBottomRef = useRef(null);

  useEffect(() => {
    const handleNewMessage = (msgData) => {
      // Skip our own messages since we already added them optimistically
      if (msgData.sender === profile.username) return;

      setMessages((prev) => [...prev, msgData]);
      if (!isOpen) {
        setUnreadCount((prev) => prev + 1);
      }
    };

    socket.on('chat_message', handleNewMessage);

    return () => {
      socket.off('chat_message', handleNewMessage);
    };
  }, [socket, isOpen, profile.username]);

  useEffect(() => {
    if (isOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const msgData = {
        roomCode,
        message: inputText,
        sender: profile.username,
        avatar: profile.avatar
    };

    // Show immediately (optimistic)
    setMessages((prev) => [...prev, msgData]);

    // Also emit to server for other players
    socket.emit('send_chat', msgData);
    setInputText('');
  };

  const toggleChat = () => {
      if (!isOpen) setUnreadCount(0);
      setIsOpen(!isOpen);
  };

  return (
    <>
      <button className="chat-toggle-btn" onClick={toggleChat}>
          💬 
          {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
      </button>

      <div className={`chat-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="chat-header">
            <h3>Room Chat</h3>
            <button className="close-btn" onClick={toggleChat}>✖</button>
        </div>
        
        <div className="chat-messages">
            {messages.map((msg, idx) => {
                const isMe = msg.sender === profile.username;
                const isImg = msg.avatar && (msg.avatar.startsWith('data:') || msg.avatar.startsWith('http'));
                return (
                    <div key={idx} className={`chat-msg ${isMe ? 'msg-me' : 'msg-them'}`}>
                        {!isMe && (
                            isImg 
                                ? <img src={msg.avatar} alt="avatar" className="chat-avatar" />
                                : <div className="chat-avatar text-avatar-sm">{msg.avatar || msg.sender?.charAt(0)}</div>
                        )}
                        <div className="msg-bubble">
                            <div className="msg-sender">{isMe ? 'You' : msg.sender}</div>
                            <div className="msg-text">{msg.message}</div>
                        </div>
                    </div>
                )
            })}
            <div ref={chatBottomRef} />
        </div>

        <form className="chat-input-area" onSubmit={handleSend}>
            <input 
                type="text" 
                placeholder="Say something..." 
                value={inputText}
                onChange={e => setInputText(e.target.value)}
            />
            <button type="submit" disabled={!inputText.trim()}>Send</button>
        </form>
      </div>
    </>
  );
}
