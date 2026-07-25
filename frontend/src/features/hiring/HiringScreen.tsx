import React, { useState } from "react";
import {
  type Agent,
  MOCK_AI_MODELS,
  MOCK_ROLES,
  MOCK_SKILLS,
  MOCK_CANDIDATES,
} from "../../mocks/agents";

interface HiringScreenProps {
  onHire: (newAgent: Agent) => void;
  hiredAgents: Agent[];
}

export const HiringScreen: React.FC<HiringScreenProps> = ({ onHire, hiredAgents }) => {
  const [selectedCandidate, setSelectedCandidate] = useState(MOCK_CANDIDATES[0]);
  const [selectedRoleId, setSelectedRoleId] = useState<number>(MOCK_ROLES[0].id);
  const [selectedModelId, setSelectedModelId] = useState<number>(MOCK_AI_MODELS[2].id); // default GPT-4o Mini
  const [agentName, setAgentName] = useState(MOCK_CANDIDATES[0].name);

  const selectedRole = MOCK_ROLES.find((r) => r.id === selectedRoleId)!;
  const isDesignModelRequired = selectedRole.requires_design_capable_model;

  // Filter models based on capability rules
  const availableModels = MOCK_AI_MODELS.map((model) => {
    const isCapable = !isDesignModelRequired || model.capability_tags.includes("design");
    return { ...model, isCapable };
  });

  // Handle candidate template selection
  const handleSelectCandidate = (candidate: typeof MOCK_CANDIDATES[0]) => {
    setSelectedCandidate(candidate);
    setAgentName(candidate.name);
    setSelectedRoleId(candidate.roleId);

    // Auto-adjust model if current selection is not capable for new role
    const newRole = MOCK_ROLES.find((r) => r.id === candidate.roleId)!;
    if (newRole.requires_design_capable_model) {
      const capableModel = MOCK_AI_MODELS.find((m) => m.capability_tags.includes("design"));
      if (capableModel) setSelectedModelId(capableModel.id);
    }
  };

  const handleHireSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const model = MOCK_AI_MODELS.find((m) => m.id === selectedModelId)!;
    const role = MOCK_ROLES.find((r) => r.id === selectedRoleId)!;
    const skills = selectedCandidate.skillsIds.map((id) => MOCK_SKILLS.find((s) => s.id === id)!);

    const newAgent: Agent = {
      id: Date.now(),
      agent_id: `agent_${Date.now()}`,
      name: agentName,
      personality: selectedCandidate.personality,
      role,
      aiModel: model,
      skills,
      hiredAt: new Date().toISOString(),
    };

    onHire(newAgent);
  };

  return (
    <div className="hiring-container" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.5rem" }}>
        {/* Candidates Selection Panel */}
        <div className="candidates-list" style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
          <h4 style={{ margin: 0, color: "var(--secondary-color)" }}>1. 候補者を選択</h4>
          {MOCK_CANDIDATES.map((c) => {
            const isAlreadyHired = hiredAgents.some((h) => h.name === c.name);
            return (
              <button
                key={c.name}
                type="button"
                className="btn-secondary"
                disabled={isAlreadyHired}
                style={{
                  textAlign: "left",
                  borderLeft: selectedCandidate.name === c.name ? "4px solid var(--secondary-color)" : "1px solid rgba(255,255,255,0.1)",
                  background: selectedCandidate.name === c.name ? "rgba(255,255,255,0.08)" : "transparent",
                  opacity: isAlreadyHired ? 0.5 : 1,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
                onClick={() => handleSelectCandidate(c)}
              >
                <span>{c.name}</span>
                {isAlreadyHired && <span style={{ fontSize: "0.75rem", color: "var(--success-color)" }}>雇用中</span>}
              </button>
            );
          })}
        </div>

        {/* Customization & Model Config Form */}
        <form onSubmit={handleHireSubmit} className="glass-panel" style={{ padding: "1.2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h4 style={{ margin: 0, color: "var(--primary-color)" }}>2. 雇用設定</h4>
          
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "4px" }}>
              名前 (変更可能)
            </label>
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "rgba(0,0,0,0.3)",
                border: "1px solid var(--panel-border)",
                borderRadius: "6px",
                color: "#fff"
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "4px" }}>
              役割
            </label>
            <select
              value={selectedRoleId}
              onChange={(e) => {
                const id = Number(e.target.value);
                setSelectedRoleId(id);
                const newRole = MOCK_ROLES.find((r) => r.id === id)!;
                if (newRole.requires_design_capable_model) {
                  const capableModel = MOCK_AI_MODELS.find((m) => m.capability_tags.includes("design"));
                  if (capableModel) setSelectedModelId(capableModel.id);
                }
              }}
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "rgba(0,0,0,0.3)",
                border: "1px solid var(--panel-border)",
                borderRadius: "6px",
                color: "#fff"
              }}
            >
              {MOCK_ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.requires_design_capable_model ? "(上流モデル必須)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "4px" }}>
              AIモデルの割り当て
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {availableModels.map((model) => (
                <label
                  key={model.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    padding: "8px",
                    borderRadius: "6px",
                    background: "rgba(0,0,0,0.2)",
                    border: selectedModelId === model.id ? "1px solid var(--primary-color)" : "1px solid transparent",
                    opacity: model.isCapable ? 1 : 0.4,
                    cursor: model.isCapable ? "pointer" : "not-allowed"
                  }}
                >
                  <input
                    type="radio"
                    name="aiModel"
                    value={model.id}
                    checked={selectedModelId === model.id}
                    disabled={!model.isCapable}
                    onChange={() => setSelectedModelId(model.id)}
                    style={{ marginTop: "3px" }}
                  />
                  <div>
                    <strong style={{ fontSize: "0.9rem" }}>{model.display_name}</strong>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "8px" }}>[{model.provider}]</span>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                      {model.description}
                    </div>
                    {!model.isCapable && (
                      <div style={{ fontSize: "0.7rem", color: "var(--danger-color)", fontWeight: "bold", marginTop: "2px" }}>
                        ⚠️ 上流役職に必要なモデル（要設計能力タグ）
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <button type="submit" className="btn-primary" style={{ width: "100%" }}>
              {agentName} を雇用する (報酬から差し引き)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
