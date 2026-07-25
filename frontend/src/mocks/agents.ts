export interface AIModel {
  id: number;
  provider: "claude" | "openai" | "deepseek" | "gemini";
  model_name: string;
  display_name: string;
  description: string;
  capability_tags: string[];
}

export interface Role {
  id: number;
  name: string;
  requires_design_capable_model: boolean;
}

export interface Skill {
  id: number;
  name: string;
  description: string;
}

export interface Agent {
  id: number;
  agent_id: string; // LangGraph identification
  name: string;
  personality: string;
  role: Role;
  aiModel: AIModel;
  skills: Skill[];
  hiredAt: string;
}

export const MOCK_AI_MODELS: AIModel[] = [
  {
    id: 1,
    provider: "deepseek",
    model_name: "deepseek-r1",
    display_name: "DeepSeek R1",
    description: "高度な推論、数学、詳細なロジック設計に非常に優れています。",
    capability_tags: ["design", "reasoning", "coding"],
  },
  {
    id: 2,
    provider: "claude",
    model_name: "claude-3-5-sonnet",
    display_name: "Claude 3.5 Sonnet",
    description: "バランスが良く、システム設計、UI構築、汎用的なコーディングに最適です。",
    capability_tags: ["design", "coding", "creative"],
  },
  {
    id: 3,
    provider: "openai",
    model_name: "gpt-4o-mini",
    display_name: "GPT-4o Mini",
    description: "高速かつ軽量で、シンプルなタスクやカジュアルな会話に適しています。",
    capability_tags: ["coding", "casual"],
  },
  {
    id: 4,
    provider: "gemini",
    model_name: "gemini-1.5-flash",
    display_name: "Gemini 1.5 Flash",
    description: "広大なコンテキストウィンドウを持ち、ドキュメントの読み込みに優れています。",
    capability_tags: ["context", "coding"],
  },
];

export const MOCK_ROLES: Role[] = [
  { id: 1, name: "フロントエンドエージェント", requires_design_capable_model: false },
  { id: 2, name: "バックエンドエージェント", requires_design_capable_model: false },
  { id: 3, name: "フルスタックエンジニア", requires_design_capable_model: false },
  { id: 4, name: "テクニカルリード", requires_design_capable_model: true },
  { id: 5, name: "プロジェクトマネージャー", requires_design_capable_model: true },
  { id: 6, name: "アイデア出し担当 (ひらめきポン太)", requires_design_capable_model: false },
  { id: 7, name: "デザイナー", requires_design_capable_model: false },
];

export const MOCK_SKILLS: Skill[] = [
  { id: 1, name: "React / TS", description: "ReactとTypeScriptを用いた動的UIの構築能力。" },
  { id: 2, name: "FastAPI / Python", description: "高速で非同期なREST APIの開発能力。" },
  { id: 3, name: "PostgreSQL", description: "DBモデリングとクエリチューニングのスキル。" },
  { id: 4, name: "システムアーキテクチャ", description: "複雑なシステム間連携と全体の設計能力。" },
  { id: 5, name: "アイデア創出", description: "斬新なコンセプトを多数立案するひらめき力。" },
  { id: 6, name: "UI/UXデザイン", description: "ユーザーに寄り添った美しい画面設計スキル。" },
];

export const INITIAL_HIRED_AGENTS: Agent[] = [
  {
    id: 1,
    agent_id: "idea_ponta",
    name: "ひらめきポン太",
    personality: "発想力豊かで自由奔放、ノリが軽い。「〜っしょ！」「〜じゃん！」が口癖。",
    role: MOCK_ROLES[5],
    aiModel: MOCK_AI_MODELS[2],
    skills: [MOCK_SKILLS[4]],
    hiredAt: "2026-07-25T10:00:00Z",
  },
];

export const MOCK_CANDIDATES = [
  {
    name: "マッスル健太",
    personality: "「重いデータ処理は俺の筋肉とサーバーで支える！」というパワー系バックエンド。",
    roleId: 2, // Backend
    skillsIds: [2, 3],
  },
  {
    name: "ドジ美",
    personality: "デザインセンスは抜群だが抜けているドジっ子。「完璧なUIができました！あ、リンク忘れた…」",
    roleId: 1, // Frontend
    skillsIds: [1, 5],
  },
  {
    name: "レイナ (冷静)",
    personality: "超真面目。几帳面で論理的。「必要なカロリーと栄養素の要件定義から入ります」と堅苦しく進める。",
    roleId: 4, // Tech Lead
    skillsIds: [1, 2, 3, 4],
  },
  {
    name: "ポン太の弟 (ポン太Jr)",
    personality: "兄譲りのひらめきを持ちながら、より現代的なビジネス視点も備える新世代エージェント。",
    roleId: 6,
    skillsIds: [4],
  },
  {
    name: "アキラ (デザイナー)",
    personality: "ピクセル単位のズレも許さない完璧主義者。美しいビジュアルでゲームを彩ります。",
    roleId: 7,
    skillsIds: [5],
  },
];
