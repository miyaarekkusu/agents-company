import { useState } from "react";

type RoomId = "president" | "meeting" | "work";

interface Room {
  id: RoomId;
  title: string;
  description: string;
}

const ROOMS: Room[] = [
  {
    id: "president",
    title: "社長室",
    description: "仕事の依頼、完了報告の受け取り、新規エージェントの採用を行う。",
  },
  {
    id: "meeting",
    title: "会議室",
    description: "エージェント達がタスクの解決方法を相談する場所。",
  },
  {
    id: "work",
    title: "作業室",
    description: "会議で決まった手順に従い、エージェント達が実際に作業する場所。",
  },
];

function App() {
  const [activeRoom, setActiveRoom] = useState<RoomId>("president");
  const room = ROOMS.find((r) => r.id === activeRoom)!;

  return (
    <div className="app">
      <header>
        <h1>AIエージェントお仕事ゲーム</h1>
        <p className="subtitle">プレイヤーは社長！マスコット風エージェントたちが奮闘するお仕事解決ゲーム</p>
      </header>

      <nav className="room-nav">
        {ROOMS.map((r) => (
          <button
            key={r.id}
            className={r.id === activeRoom ? "room-button active" : "room-button"}
            onClick={() => setActiveRoom(r.id)}
          >
            {r.title}
          </button>
        ))}
      </nav>

      <main className="room-view">
        <h2>{room.title}</h2>
        <p>{room.description}</p>
      </main>
    </div>
  );
}

export default App;
