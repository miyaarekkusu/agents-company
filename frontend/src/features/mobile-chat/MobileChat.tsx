import React, { useState } from "react";
import { type EmailThread } from "../../mocks/messages";

interface MobileChatProps {
  threads: EmailThread[];
  onReply: (threadId: number, optionText: string) => void;
  activeNotificationsCount: number;
}

export const MobileChat: React.FC<MobileChatProps> = ({ threads, onReply, activeNotificationsCount }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);

  const activeThread = threads.find((t) => t.id === activeThreadId);

  const handleSelectThread = (threadId: number) => {
    setActiveThreadId(threadId);
  };

  const handleBackToList = () => {
    setActiveThreadId(null);
  };

  const handleOptionClick = (option: string) => {
    if (activeThreadId) {
      onReply(activeThreadId, option);
    }
  };

  return (
    <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 900 }}>
      {/* Floating Button */}
      {!isOpen && (
        <button
          className="btn-primary"
          onClick={() => setIsOpen(true)}
          style={{
            width: "60px",
            height: "60px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.8rem",
            boxShadow: "0 8px 32px rgba(79, 70, 229, 0.4)",
            position: "relative",
            border: "none",
            cursor: "pointer"
          }}
        >
          📱
          {activeNotificationsCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: "-4px",
                right: "-4px",
                background: "var(--danger-color)",
                color: "#fff",
                borderRadius: "50%",
                padding: "4px 8px",
                fontSize: "0.75rem",
                fontWeight: "bold",
                boxShadow: "0 0 10px rgba(239, 68, 68, 0.8)",
                animation: "shake 0.8s infinite"
              }}
            >
              {activeNotificationsCount}
            </span>
          )}
        </button>
      )}

      {/* Smartphone Body */}
      {isOpen && (
        <div
          className="glass-panel"
          style={{
            width: "350px",
            height: "500px",
            borderRadius: "28px",
            border: "6px solid #1e293b",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
            background: "#0c101b"
          }}
        >
          {/* Phone Header Status Bar */}
          <div style={{ height: "24px", background: "#111827", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 16px", fontSize: "0.7rem", color: "var(--text-muted)" }}>
            <span>19:30</span>
            <div style={{ width: "60px", height: "12px", background: "#000", borderRadius: "0 0 8px 8px", position: "absolute", left: "50%", transform: "translateX(-50%)" }} />
            <span>📶 🔋 98%</span>
          </div>

          {/* App Custom Bar */}
          <div style={{ background: "rgba(17, 24, 39, 0.9)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {activeThread ? (
              <button onClick={handleBackToList} style={{ background: "none", border: "none", color: "var(--secondary-color)", cursor: "pointer", fontSize: "0.9rem", padding: 0 }}>
                ◀ 戻る
              </button>
            ) : (
              <span style={{ fontWeight: "bold", fontSize: "0.95rem" }}>AgentChat</span>
            )}
            <span style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
              {activeThread ? activeThread.agentName : "メッセージ一覧"}
            </span>
            <button onClick={() => setIsOpen(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.1rem" }}>
              &times;
            </button>
          </div>

          {/* Phone Screen Area */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "12px" }}>
            {activeThread ? (
              /* Conversation View */
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", paddingBottom: "10px" }}>
                  {activeThread.messages.map((msg) => {
                    const isMe = msg.direction === "inbound";
                    return (
                      <div
                        key={msg.id}
                        style={{
                          alignSelf: isMe ? "flex-end" : "flex-start",
                          maxWidth: "80%",
                          background: isMe ? "var(--primary-color)" : "rgba(255,255,255,0.08)",
                          color: "#fff",
                          padding: "8px 12px",
                          borderRadius: isMe ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                          fontSize: "0.85rem",
                          border: isMe ? "none" : "1px solid rgba(255,255,255,0.04)"
                        }}
                      >
                        <div style={{ fontWeight: "bold", fontSize: "0.7rem", opacity: 0.7, marginBottom: "2px" }}>
                          {isMe ? "社長" : msg.senderName}
                        </div>
                        <div>{msg.body}</div>
                        <div style={{ fontSize: "0.6rem", textAlign: "right", opacity: 0.5, marginTop: "4px" }}>
                          {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Options Input Picker */}
                {activeThread.status === "open" && activeThread.options && activeThread.options.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "10px" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontStyle: "italic", textAlign: "center" }}>
                      回答を選択してください:
                    </div>
                    {activeThread.options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => handleOptionClick(opt)}
                        className="btn-secondary"
                        style={{
                          fontSize: "0.75rem",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          textAlign: "left",
                          background: "rgba(79, 70, 229, 0.1)",
                          borderColor: "rgba(79, 70, 229, 0.3)"
                        }}
                      >
                        💬 {opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text-muted)", padding: "8px" }}>
                    このチャットは終了しました。
                  </div>
                )}
              </div>
            ) : (
              /* Threads List View */
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                {threads.length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "2rem", fontSize: "0.85rem" }}>
                    新着メッセージはありません。
                  </div>
                ) : (
                  threads.map((thread) => {
                    const lastMsg = thread.messages[thread.messages.length - 1];
                    const isUnread = thread.status === "open" && lastMsg.direction === "outbound";
                    return (
                      <div
                        key={thread.id}
                        onClick={() => handleSelectThread(thread.id)}
                        className="glass-panel"
                        style={{
                          padding: "10px",
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          borderLeft: isUnread ? "4px solid var(--secondary-color)" : "1px solid var(--panel-border)"
                        }}
                      >
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", marginRight: "8px" }}>
                          <div style={{ fontWeight: "bold", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}>
                            {thread.agentName}
                            {isUnread && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--secondary-color)" }} />}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "bold" }}>
                            {thread.subject}
                          </div>
                          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: "2px" }}>
                            {lastMsg ? lastMsg.body : "Sem mensagens"}
                          </div>
                        </div>
                        <span style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>
                          {lastMsg ? new Date(lastMsg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Bottom Home Indicator Bar */}
          <div style={{ height: "16px", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <div style={{ width: "120px", height: "4px", background: "rgba(255,255,255,0.3)", borderRadius: "2px" }} />
          </div>
        </div>
      )}
    </div>
  );
};
