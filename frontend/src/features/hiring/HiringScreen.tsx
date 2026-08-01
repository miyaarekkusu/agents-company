import React, { useEffect, useState } from "react";
import type { RoleOut, SkillOut, AIModelOut } from "../../api/types";
import * as api from "../../api/client";

interface HiringScreenProps {
  addToast: (text: string, type?: "info" | "success") => void;
  onHired: () => void;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export const HiringScreen: React.FC<HiringScreenProps> = ({ addToast, onHired }) => {
  const [roles, setRoles] = useState<RoleOut[]>([]);
  const [skills, setSkills] = useState<SkillOut[]>([]);
  const [models, setModels] = useState<AIModelOut[]>([]);

  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [selectedSkillIds, setSelectedSkillIds] = useState<number[]>([]);

  const [agentName, setAgentName] = useState("");
  const [personality, setPersonality] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 役割・スキルのカタログを初回に一度だけ取得
  useEffect(() => {
    let active = true;
    Promise.all([api.listRoles(), api.listSkills()])
      .then(([roleList, skillList]) => {
        if (!active) return;
        setRoles(roleList);
        setSkills(skillList);
        if (roleList.length > 0) setSelectedRoleId(roleList[0].id);
      })
      .catch((e) => {
        if (active) setLoadError(errMsg(e));
      });
    return () => {
      active = false;
    };
  }, []);

  // 選択中の役割に応じたAIモデル一覧をサーバーから取得（design-capable制限はサーバー側で適用済み）
  useEffect(() => {
    if (selectedRoleId === null) return;
    let active = true;
    api
      .listAiModels(selectedRoleId)
      .then((list) => {
        if (!active) return;
        setModels(list);
        setSelectedModelId((prev) => {
          if (prev !== null && list.some((m) => m.id === prev)) return prev;
          return list.length > 0 ? list[0].id : null;
        });
      })
      .catch((e) => {
        if (active) setLoadError(errMsg(e));
      });
    return () => {
      active = false;
    };
  }, [selectedRoleId]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId) || null;

  const toggleSkill = (id: number) => {
    setSelectedSkillIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleHireSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRoleId === null || selectedModelId === null || !agentName.trim()) return;

    setSubmitting(true);
    try {
      await api.hireAgent({
        name: agentName.trim(),
        personality: personality.trim(),
        role_id: selectedRoleId,
        ai_model_id: selectedModelId,
        skill_ids: selectedSkillIds,
      });
      addToast(`${agentName} を雇用しました！`, "success");
      onHired();
    } catch (err) {
      addToast(`⚠️ 雇用に失敗しました: ${errMsg(err)}`, "info");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--danger-color)" }}>
        雇用データの取得に失敗しました: {loadError}
      </div>
    );
  }

  return (
    <div className="hiring-container" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ maxWidth: "480px", margin: "0 auto", width: "100%" }}>
        {/* すでにModal自体がglass-panelなので、ここでは二重に枠を付けずプレーンなフォームにする */}
        <form onSubmit={handleHireSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "4px" }}>
              名前
            </label>
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              required
              placeholder="例: マッスル健太"
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "rgba(0,0,0,0.3)",
                border: "1px solid var(--panel-border)",
                borderRadius: "6px",
                color: "#fff",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "4px" }}>
              性格
            </label>
            <textarea
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              rows={2}
              placeholder="例: パワー系だが優しいバックエンド担当"
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "rgba(0,0,0,0.3)",
                border: "1px solid var(--panel-border)",
                borderRadius: "6px",
                color: "#fff",
                resize: "vertical",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "4px" }}>
              役割
            </label>
            <select
              value={selectedRoleId ?? ""}
              onChange={(e) => setSelectedRoleId(Number(e.target.value))}
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "rgba(0,0,0,0.3)",
                border: "1px solid var(--panel-border)",
                borderRadius: "6px",
                color: "#fff",
              }}
            >
              {roles.map((r) => (
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
              {models.length === 0 && (
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  {selectedRole?.requires_design_capable_model
                    ? "この役割に対応する設計可能なモデルを読み込み中..."
                    : "モデルを読み込み中..."}
                </div>
              )}
              {models.map((model) => (
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
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="aiModel"
                    value={model.id}
                    checked={selectedModelId === model.id}
                    onChange={() => setSelectedModelId(model.id)}
                    style={{ marginTop: "3px" }}
                  />
                  <div>
                    <strong style={{ fontSize: "0.9rem" }}>{model.display_name}</strong>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "8px" }}>[{model.provider}]</span>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                      {model.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "4px" }}>
              スキル (任意・複数選択可)
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {skills.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => toggleSkill(s.id)}
                  className="btn-secondary"
                  style={{
                    fontSize: "0.75rem",
                    padding: "4px 10px",
                    background: selectedSkillIds.includes(s.id) ? "var(--primary-color)" : undefined,
                  }}
                  title={s.description}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: "100%", padding: "0.75rem" }}
            disabled={submitting || !agentName.trim() || selectedRoleId === null || selectedModelId === null}
          >
            {submitting ? "雇用手続き中..." : `${agentName || "候補者"} を雇用する`}
          </button>
        </form>
      </div>
    </div>
  );
};
