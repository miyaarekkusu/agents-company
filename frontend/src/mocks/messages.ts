export interface EmailMessage {
  id: number;
  threadId: number;
  direction: "outbound" | "inbound"; // outbound: Agent -> President, inbound: President -> Agent
  senderName: string;
  body: string;
  sentAt: string;
}

export interface EmailThread {
  id: number;
  taskId: number;
  agentId: string;
  agentName: string;
  subject: string;
  status: "open" | "closed";
  messages: EmailMessage[];
  options?: string[]; // Interactive choices
}

export const MOCK_EMAIL_THREADS: EmailThread[] = [
  {
    id: 1,
    taskId: 1,
    agentId: "idea_ponta",
    agentName: "ひらめきポン太",
    subject: "デザインの方向性について相談っしょ！",
    status: "open",
    messages: [
      {
        id: 101,
        threadId: 1,
        direction: "outbound",
        senderName: "ひらめきポン太",
        body: "社長！桜庵のサイトなんだけど、和風モダンな感じと、超ポップでアニメーション満載の感じ、どっちがイケてると思う？意見欲しいっしょ！✨",
        sentAt: "2026-07-25T11:05:00Z",
      },
    ],
    options: [
      "老舗の良さを活かした、上品な「和風モダン」で行こう！",
      "若者に受けるように、とことん「ポップで賑やか」にしよう！",
      "君のセンスに任せるよ。面白いものを作ってくれ！"
    ],
  },
];
