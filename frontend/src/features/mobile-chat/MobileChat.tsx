import React, { useState } from "react";
import type { NotificationOut } from "../../api/types";

interface MobileChatProps {
  notifications: NotificationOut[];
  onMarkRead: (threadId: number) => Promise<void>;
}

export const MobileChat: React.FC<MobileChatProps> = ({ notifications, onMarkRead }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);

  const activeThread = notifications.find((n) => n.id === activeThreadId) ?? null;
  const unreadCount = notifications.filter((n) => n.status === "open").length;

  // 新しい通知が上に来るように表示する
  const sortedNotifications = [...notifications].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const handleSelectThread = (notification: NotificationOut) => {
    setActiveThreadId(notification.id);
    if (notification.status === "open") {
      onMarkRead(notification.id).catch(() => {
        // 親コンポーネント側でエラー通知される想定のため、ここでは無視する
      });
    }
  };

  const handleBackToList = () => {
    setActiveThreadId(null);
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
          {unreadCount > 0 && (
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
              {unreadCount}
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
            <span style={{ fontSize: "0.85rem", fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "180px" }}>
              {activeThread ? activeThread.subject : "メッセージ一覧"}
            </span>
            <button onClick={() => setIsOpen(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.1rem" }}>
              &times;
            </button>
          </div>

          {/* Phone Screen Area */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "12px" }}>
            {activeThread ? (
              /* Notification Detail View */
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div
                    style={{
                      maxWidth: "90%",
                      background: "rgba(255,255,255,0.08)",
                      color: "#fff",
                      padding: "10px 14px",
                      borderRadius: "14px 14px 14px 2px",
                      fontSize: "0.85rem",
                      border: "1px solid rgba(255,255,255,0.04)"
                    }}
                  >
                    <div style={{ fontWeight: "bold", fontSize: "0.75rem", opacity: 0.8, marginBottom: "4px" }}>
                      {activeThread.subject}
                    </div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{activeThread.body}</div>
                    <div style={{ fontSize: "0.6rem", textAlign: "right", opacity: 0.5, marginTop: "6px" }}>
                      {new Date(activeThread.created_at).toLocaleString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text-muted)", padding: "8px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  このメールは通知専用です（返信はできません）。
                </div>
              </div>
            ) : (
              /* Threads List View */
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                {sortedNotifications.length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "2rem", fontSize: "0.85rem" }}>
                    新着メッセージはありません。
                  </div>
                ) : (
                  sortedNotifications.map((notification) => {
                    const isUnread = notification.status === "open";
                    return (
                      <div
                        key={notification.id}
                        onClick={() => handleSelectThread(notification)}
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
                            {notification.subject}
                            {isUnread && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--secondary-color)" }} />}
                          </div>
                          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: "2px" }}>
                            {notification.body}
                          </div>
                        </div>
                        <span style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>
                          {new Date(notification.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
