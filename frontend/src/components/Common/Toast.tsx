import React, { useEffect } from "react";

export interface ToastMessage {
  id: string;
  text: string;
  type?: "info" | "success";
}

interface ToastProps {
  messages: ToastMessage[];
  onRemove: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ messages, onRemove }) => {
  return (
    <div className="toast-container">
      {messages.map((m) => (
        <ToastItem key={m.id} message={m} onRemove={onRemove} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ message: ToastMessage; onRemove: (id: string) => void }> = ({
  message,
  onRemove,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(message.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [message, onRemove]);

  return (
    <div className={`toast ${message.type || "info"}`} onClick={() => onRemove(message.id)}>
      <div>{message.type === "success" ? "✅" : "🔔"}</div>
      <div>{message.text}</div>
    </div>
  );
};
