export interface Task {
  id: number;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed";
  createdAt: string;
}

export interface MeetingReport {
  meetingId: number;
  taskId: number;
  leaderName: string;
  content: string;
  createdAt: string;
}

export interface Artifact {
  id: number;
  taskId: number;
  type: "website" | "report" | "proposal";
  content: string; // HTML for website, markdown/text for report/proposal
  createdBy: string;
  createdAt: string;
}

export const MOCK_TASKS: Task[] = [
  {
    id: 1,
    title: "和菓子屋のコーポレートサイト制作",
    description: "老舗和菓子屋「桜庵」のモダンで魅力的な紹介ウェブサイト。四季折々の製品が際立つデザインを求める。",
    status: "completed",
    createdAt: "2026-07-25T11:00:00Z",
  },
  {
    id: 2,
    title: "社内備品・在庫管理ツール開発",
    description: "材料や社内機材の数を把握し、不足しそうな場合にアラートを送信するシンプルな管理システム。",
    status: "pending",
    createdAt: "2026-07-25T12:00:00Z",
  },
  {
    id: 3,
    title: "エージェントを活用したSNSマーケティング企画",
    description: "自社AIエージェントの個性を生かして、若年層に向けた魅力的なブランドプロモーション案を作成する。",
    status: "pending",
    createdAt: "2026-07-25T13:00:00Z",
  },
];

export const MOCK_MEETING_REPORTS: MeetingReport[] = [
  {
    meetingId: 1,
    taskId: 1,
    leaderName: "ひらめきポン太",
    content: `# 会議レポート: 和菓子屋サイト制作 🍡

## 参加メンバー
- **リーダー**: ひらめきポン太
- **サポート**: ドジ美 (フロントエンド), マッスル健太 (バックエンド)

## 決定事項・設計概要
- **ビジュアルテーマ**: 和モダンとグラスモーフィズムを融合させ、桜をモチーフにした淡いカラーパレットを使用する。
- **フロントエンド**: Reactを用いて、メニューカードのホバー時に滑らかなアニメーションを実行する。
- **バックエンド**: FastAPIで動作するシンプルな商品一覧APIを構築し、動的にデータを取得する。
- **キャラクター演出**: 店舗マスコットが自動で語りかける対話UIを設置し、各和菓子の物語を紹介する！

---
*署名: 会議主催リーダー ひらめきポン太 (アイデアエージェント)*`,
    createdAt: "2026-07-25T11:15:00Z",
  },
];

export const MOCK_ARTIFACTS: Artifact[] = [
  {
    id: 1,
    taskId: 1,
    type: "website",
    createdBy: "ドジ美 (フロントエンド)",
    content: `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>和菓子 桜庵 (Sakura-An)</title>
  <style>
    body {
      background: linear-gradient(135deg, #fff5f5 0%, #ffe3e3 100%);
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: #4a3737;
      margin: 0;
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
    }
    header {
      text-align: center;
      margin-bottom: 40px;
    }
    h1 {
      color: #d65a5a;
      font-size: 2.5rem;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      max-width: 900px;
      width: 100%;
    }
    .card {
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 20px;
      box-shadow: 0 8px 32px rgba(214, 90, 90, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.4);
      text-align: center;
      transition: transform 0.3s;
    }
    .card:hover {
      transform: translateY(-5px);
    }
    .price {
      font-weight: bold;
      color: #d65a5a;
      font-size: 1.2rem;
    }
    .btn {
      background: #d65a5a;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 20px;
      cursor: pointer;
      font-weight: bold;
      margin-top: 15px;
    }
    .btn:hover {
      background: #b54545;
    }
  </style>
</head>
<body>
  <header>
    <h1>🍡 和菓子 桜庵</h1>
    <p>四季折々の美しさを、一粒の和菓子に込めて。</p>
  </header>
  <div class="grid">
    <div class="card">
      <h3>特製 桜餅 (Sakura Mochi)</h3>
      <p>芳醇な桜の葉の香りと、上品なこしあんの甘み。</p>
      <div class="price">¥280</div>
      <button class="btn" onclick="alert('ご注文ありがとうございます！(ドジ美：リンク繋ぐの忘れなかったです！)')">注文する</button>
    </div>
    <div class="card">
      <h3>みたらし団子 (Mitarashi Dango)</h3>
      <p>焼き立ての香ばしいお団子に特製醤油ダレを絡めて。</p>
      <div class="price">¥150</div>
      <button class="btn" onclick="alert('ご注文ありがとうございます！')">注文する</button>
    </div>
  </div>
</body>
</html>`,
    createdAt: "2026-07-25T11:30:00Z",
  },
];
