import React, { useState } from "react";
import type { PendingReportOut, ArtifactOut } from "../../api/types";

interface ReportViewerProps {
  report?: PendingReportOut;
  artifact?: ArtifactOut;
}

export const ReportViewer: React.FC<ReportViewerProps> = ({ report, artifact }) => {
  const [activeTab, setActiveTab] = useState<"visual" | "code">("visual");

  if (!report && !artifact) {
    return <div style={{ color: "var(--text-muted)", padding: "2rem", textAlign: "center" }}>レポートまたは成果物が選択されていません。</div>;
  }

  // Displaying Meeting Report (Markdown text)
  if (report) {
    return (
      <div className="report-markdown" style={{ padding: "1rem", lineHeight: "1.6" }}>
        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "8px", marginBottom: "1rem" }}>
          <span>お題: <strong>{report.task_title}</strong></span>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{new Date(report.created_at).toLocaleString()}</span>
        </div>
        <div style={{ whiteSpace: "pre-wrap", background: "rgba(0,0,0,0.2)", padding: "1.5rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
          {report.report_content}
        </div>
      </div>
    );
  }

  // Displaying Artifact (Website, Report, or Proposal)
  if (artifact) {
    const isWebsite = artifact.type === "website";

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "8px" }}>
          <div>
            種類: <strong style={{ color: "var(--secondary-color)" }}>{artifact.type.toUpperCase()}</strong>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginLeft: "12px" }}>作成者: {artifact.agent_name ?? "不明"}</span>
          </div>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{new Date(artifact.created_at).toLocaleString()}</span>
        </div>

        {isWebsite && (
          <div style={{ display: "flex", gap: "6px", background: "rgba(0,0,0,0.3)", padding: "4px", borderRadius: "8px", width: "fit-content" }}>
            <button
              onClick={() => setActiveTab("visual")}
              className="btn-secondary"
              style={{
                padding: "4px 12px",
                fontSize: "0.8rem",
                borderRadius: "6px",
                background: activeTab === "visual" ? "var(--primary-color)" : "transparent",
                border: "none",
                color: "#fff"
              }}
            >
              プレビュー
            </button>
            <button
              onClick={() => setActiveTab("code")}
              className="btn-secondary"
              style={{
                padding: "4px 12px",
                fontSize: "0.8rem",
                borderRadius: "6px",
                background: activeTab === "code" ? "var(--primary-color)" : "transparent",
                border: "none",
                color: "#fff"
              }}
            >
              ソースコード
            </button>
          </div>
        )}

        {isWebsite && activeTab === "visual" ? (
          <div style={{ border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", overflow: "hidden", background: "#fff", height: "450px" }}>
            <iframe
              title="Website Preview"
              srcDoc={artifact.content}
              style={{ width: "100%", height: "100%", border: "none" }}
            />
          </div>
        ) : (
          <pre
            style={{
              margin: 0,
              background: "#080a10",
              color: "#34d399",
              padding: "1.5rem",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.05)",
              overflowX: "auto",
              fontFamily: "monospace",
              fontSize: "0.85rem",
              lineHeight: "1.5",
              maxHeight: "450px"
            }}
          >
            <code>{artifact.content}</code>
          </pre>
        )}
      </div>
    );
  }

  return null;
};
