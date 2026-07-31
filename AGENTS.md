# AGENTS.md

このファイルは、本リポジトリで開発を行うAIエージェント（Claude Code等）向けのガイドです。
ゲームの企画意図・システム構成・技術スタックをまとめています。実装の際は必ず参照してください。

## プロジェクト概要

**「プレイヤーは社長！マスコット風エージェントたちが奮闘するお仕事解決ゲーム」**

プレイヤー（社長）が、外部APIを使って生成した個性豊かなAIスタッフ（マスコット風エージェント）を雇用・運営するシミュレーションゲーム。社長は現場作業を行わず、スタッフへの指示と見守りに徹する。

## ゲームシステム

### 社長（プレイヤー）の役割
- **採用**: 外部LLM APIを使って新規スタッフ（エンジニア等のエージェント）を雇用する。
- **指示出し**: 雇用したスタッフに対して、今日の目標・お題を提示する。
- **見守り**: 実作業には介入せず、スタッフたちの会議・作業の様子を観察する立場に徹する。
- **回収**: 完了報告を受け取り、報酬を得る（報酬で新規採用や強化を行う）。

### スタッフ（AIエージェント）の役割
- 社長から出されたお題を受け取り、達成のための設計を行う。
- 必要に応じて、スタッフ間で**設計担当（リード役）を割り振る**ことができる。
- 役割分担した後、実際に手を動かし、**完成までスタッフ同士が協力**して進める。
- 社長への完了報告を行う。

### ゲームサイクル
1. 社長1人だけの秘密基地からスタート。
2. 簡単な仕事をこなし、報酬を獲得。
3. 報酬で新しいエージェントを雇用。
4. エージェントが増えることで、より複雑な仕事を会議で分担してこなせるようになる。

### 拠点構成（3部屋）
| 部屋 | 用途 |
|---|---|
| 社長室 | 社長の拠点。仕事の依頼、完了報告の受け取り、新規エージェントの採用を行う。 |
| 会議室 | エージェント達がタスクの解決方法を相談する場所。LLM APIによる自律的な問題解決プロセス（設計担当の割り振りを含む）を可視化する。 |
| 作業室 | 会議で決まった手順に従い、エージェント達が実際に作業する場所。 |

### キャラクター例（他にも追加予定）
- **バックエンドエージェント**: 熱血でマッチョなエンジニア。「重いデータ処理は俺の筋肉とサーバーで支える！」というパワー系。
- **フロントエンドエージェント**: ドジっ子。デザインセンスは抜群だが抜けている。「完璧なUIができました！あ、ボタンのリンク繋ぎ忘れた…」。
- **料理系エージェント**: 超真面目。几帳面で論理的。「必要なカロリーと栄養素の要件定義から入ります」と堅苦しく進める。
- **ひらめきポン太（アイデア出しエージェント）**: 発想力豊かで自由奔放、前向き。落ち着いた丁寧な話し方で、社長のお題に対して複数のアイデアを簡潔に提案する担当。実装済み（`agents/idea_agent.md`にペルソナ・システムプロンプト定義あり）。

## 技術スタック

| 領域 | 技術 |
|---|---|
| フロントエンド | React |
| バックエンド | FastAPI (Python) |
| インフラ | Docker / Docker Compose |
| データベース | PostgreSQL（FastAPIの定番構成として採用。SQLAlchemy + Alembicでのマイグレーション管理を想定） |
| 外部LLM API | Claude API / OpenAI API / DeepSeek API / Gemini API（雇用するエージェントごとにプロバイダを切替可能な設計とする） |

> 注: 企画書（README.md）ではフロントエンドを React Native としていましたが、本ファイルでは直近の方針に合わせて React（Web）を正としています。モバイル対応が必要になった場合はこの前提を見直してください。

## ディレクトリ構成

モノレポ構成。フロントエンドとバックエンドは別フォルダに分離する。

```
ai-company/
├── AGENTS.md
├── DATABASE.md                  # DBスキーマ設計のリファレンス（ER図・テーブル定義・説明）
├── FRONTEND.md                  # フロントエンドの画面実装タスク一覧
├── README.md
├── docker-compose.yml
├── agents/                      # ゲーム内AIエージェントのペルソナ定義・システムプロンプト等
│   └── idea_agent.md            # アイデア出しエージェント（ひらめきポン太）のキャラクター設定・システムプロンプト
├── skills/                      # ゲーム内エージェントが使用する「スキル」の定義
├── memo/                        # 開発メモ等
├── frontend/                   # React（Vite + TypeScript）
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── .env.example
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       └── ...
└── backend-core/                # FastAPI（Python）
    ├── Dockerfile
    ├── pyproject.toml
    ├── .env.example
    ├── alembic/                # DBマイグレーション（versions/に初期スキーマ作成マイグレーションあり）
    ├── alembic.ini
    ├── scripts/
    │   ├── chat.py              # サーバー起動不要、ターミナルで単発のお題投げだけを素早く確認するCLI
    │   ├── game_cli.py          # 社長室・会議室・作業室を選んで一連の流れ（雇用/お題/会議/確認）を試せる統合CLI
    │   └── seed_db.py           # roles/ai_models/skills/agentsへの初期データ投入（再実行安全。既存agentsはUPDATE）
    └── app/
        ├── main.py
        ├── core/                # 設定（config.py）・DB接続（database.py）
        ├── api/                 # ルーター（tasks.py, agents.py など）
        ├── models/              # SQLAlchemyモデル（DATABASE.mdの全13テーブルに対応。実装済み）
        ├── schemas/             # Pydanticスキーマ（task.py, agent.py など）
        └── services/            # エージェント・オーケストレーション層
            ├── llm.py            # 外部LLM API呼び出しの薄いラッパー（DeepSeekのみ実装。call_llm/stream_llmでproviderに応じ振り分け、未実装providerはNotImplementedError）
            ├── persona.py        # agents/配下のMarkdownからシステムプロンプト本文を抽出するローダー（現在はscripts/seed_db.py等の初期データ投入専用）
            ├── agents_registry.py # 登録済みエージェント一覧をDBの`agents`テーブルから取得する（DB化済み。agent_idはint）
            ├── hiring.py         # 社長室: エージェント雇用ロジック（役職・AIモデル・スキル選択、agents/agent_skills作成）
            ├── work.py           # 社長室/作業室: お題CRUD・作業の予約(start_work)/バックグラウンド実行(finish_work)
            ├── graph.py          # LangGraphのState/Node/Edge定義とcompile済みグラフ（1エージェントへのお題実行）
            ├── meeting_graph.py  # 会議室: 複数エージェントの提案生成→リーダー集約のLangGraphフロー
            ├── meetings.py       # 会議室: 会議の予約(start_meeting)/バックグラウンド実行(finish_meeting)・同時進行1件制約の担保
            ├── work_progress.py  # 作業室: バックグラウンド実行中の生成途中の内容をプロセス内メモリで保持（進行状況ストア）
            ├── availability.py   # 会議中・作業中（busy）のエージェント判定（会議・作業の重複割り当て防止）
            └── notifications.py # 完了/失敗をemail_threads/email_messagesで通知する（メール部屋用）
```

- **frontend/**: React (Vite + TypeScript) 一式。バックエンドのコードは置かない。
- **backend-core/**: FastAPI 一式。DBモデル・API・LLMエージェントのオーケストレーション層をここに置く。
- **agents/**: ゲーム内AIエージェント（キャラクター）のペルソナ定義・システムプロンプト・設定を格納する。実装が具体化した際に更新すること。
- **skills/**: ゲーム内エージェントが使用する「スキル」（役割分担・コード生成・レビュー等の能力単位）の定義を格納する。実装が具体化した際に更新すること。
- 環境構築・実装を行うAIエージェントは、作業開始前に必ずこのAGENTS.mdを読み込み、上記構成に従うこと。フォルダ名・役割分担を変更しない。

## アーキテクチャ方針（実装時の指針）

- モノレポ構成を想定: `frontend/`（React）, `backend-core/`（FastAPI）, `docker-compose.yml` をルートに配置。
- バックエンドには「エージェント・オーケストレーション層」を設け、以下の流れを扱う:
  1. 社長からのお題受付
  2. 会議（複数エージェントでの相談・設計担当の割り振り）
  3. 作業（役割分担に基づく実行）
  4. 完了報告・報酬計算
- オーケストレーション基盤には **LangGraph** を採用する（CrewAI・自前実装と比較検討の上で決定。ストリーミング・永続化・human-in-the-loopが標準機能として揃っており、LangChain本体なしでノード内から外部LLM APIを直接呼べるため）。`backend-core/app/services/graph.py` に1エージェント向けのState/Node/Edgeを定義する。社長が指定した`agent_id`（`TaskState`に含まれる）に応じて、`app/services/agents_registry.py`経由でDBの`agents`テーブルから該当エージェントを取得し、`app/services/llm.py`の`call_llm`でLLMを呼ぶ。
- **会議室（複数エージェントでの話し合い）**: `app/services/meeting_graph.py`に、参加者それぞれが提案を出し→リーダーが全提案を集約してレポートを作成する、というLangGraphフロー（`MeetingState`/`run_meeting_node`）を実装済み（2026-07-27）。現状は1ノード内で参加者を順番にLLM呼び出しするシンプルな実装で、LangGraphの条件付きEdgeによる分岐はまだ使っていない。DBへの永続化は`app/services/meetings.py`が担当し、**「予約（`start_meeting`）→バックグラウンド実行（`finish_meeting`）」の2段階**に分かれている（2026-07-29）。`start_meeting`は「会議室は1つのみ・同時進行1件まで」の制約チェックと参加者のbusy判定（`app/services/availability.py`）を行った上で`Meeting`/`MeetingParticipant`を作成し`Task.status`を`meeting_in_progress`にしてすぐ返る。実際のLLM呼び出しは`finish_meeting`が`asyncio.create_task`でバックグラウンド実行し、社長は完了を待たず他の部屋の操作を続けられる（`scripts/game_cli.py`が全`input()`を別スレッド実行に変えている理由もこれ）。会議の対象になるのは、社長室で`requires_meeting=True`として登録済みかつ未実施（`status == "awaiting_meeting"`）のお題のみ。会議完了後、お題は`"awaiting_approval"`になり、**社長がレポートを承認するまで作業は始まらない**（`meetings.approve_report`）。完了・失敗は`app/services/notifications.py`経由でメールに通知される。checkpointerによる状態のDB永続化・WebSocket/SSEでのストリーミング配信は未実装（次のイテレーションで対応）。
- **作業（単一成果物への協力）**: `app/services/work_graph.py`に、複数のworkerがそれぞれ担当パートを作成し→リーダーが1つの成果物に統合する、というLangGraphフロー（`WorkState`/`run_work_node`。会議室と同型のパターン）を実装済み（2026-07-27）。**1つのお題につき成果物(`Artifact`)は1件だけ**。会議と同じく「予約（`work.start_work`）→バックグラウンド実行（`work.finish_work`）」の2段階になっている（2026-07-29。予約時に`work_sessions`/`work_session_participants`を作成し`Task.status`を`work_in_progress`にする）。お題に会議レポートが紐づいていれば、その内容も作業のコンテキストとして各workerに渡す。作業を割り当てられるのは、お題の状態が`"ready_for_work"`（会議不要で作成された直後、または会議レポートが承認された後）のときのみ。
- **作業内容のリアルタイム表示（2026-07-29実装）**: `run_work_node`は`app/services/llm.py`の`stream_llm`でLLM応答をトークン単位に受け取り、LangGraphの`get_stream_writer`（`from langgraph.config import get_stream_writer`）で`agent_start`/`token`/`agent_end`のcustomイベントを流す。`work.finish_work`は`work_graph.ainvoke(...)`ではなく`work_graph.astream(state, stream_mode=["custom", "values"])`でこれを受け取り、`app/services/work_progress.py`（プロセス内メモリの進行状況ストア。CLIは単一プロセス・単一asyncioイベントループで完結するためDB永続化やHTTP通信は不要という判断）に反映する。`scripts/game_cli.py`の作業室「作業内容を確認する」（`view_work_flow`）は、完了済みの成果物一覧に加えて進行中の作業（`work.list_in_progress_work`）も新しい順に一覧表示し、進行中のものを選ぶとその時点までの生成内容のスナップショットを表示する（自動更新はしない一発表示。最新を見たければ選び直す）。フロントエンド・SSE HTTPエンドポイントは今回のスコープ外（`graph.py`はgame_cli.pyから使われておらず、今回の目的に対しては意味が薄いため対象外にした。ロードマップ参照）。
- **エージェントの稼働状況（busy判定）**: `app/services/availability.py`の`list_busy_agent_ids`が、進行中（`in_progress`）の会議・作業に参加しているagent_idを返す。`start_meeting`/`start_work`はここでbusyな参加者・担当者を弾き、`scripts/game_cli.py`側でも選択肢の一覧から事前に除外している（会議中・作業中のエージェントは、別のお題の会議・作業に二重に割り当てられない）。
- **メール通知（`app/services/notifications.py`）**: `DATABASE.md`に定義済みだった`email_threads`/`email_messages`テーブルを、会議・作業の完了/失敗を社長に一方向で知らせる通知として実装（2026-07-29。返信機能は未実装）。`scripts/game_cli.py`のメール部屋（`mail_room`）から確認・既読化できる。
- **エージェントの登録管理（`app/services/agents_registry.py`）**: DBの`agents`テーブルを参照する（2026-07-27にDB化済み）。`get_agent(session, agent_id)`/`list_agents(session)`はいずれも非同期でDBを問い合わせる。**`agent_id`はDBの`agents.id`に対応する数値（int）**（DB化前は文字列だったため、API呼び出し側は注意すること）。`GET /api/agents`でこの一覧を返し、`POST /api/tasks`は`agent_id`（int）を必須項目として受け取って該当エージェントに処理を委譲する。未登録の`agent_id`が指定された場合は`app/api/tasks.py`が404を返す。エージェントのペルソナ（`system_prompt`）は`agents`テーブルのカラムに直接保存されており、`app/services/persona.py`によるMarkdown読み込みは`scripts/seed_db.py`等の初期データ投入時のみ使う。
- **ストリーミング配信（会議・作業内容のリアルタイム表示）**: 当初はSSE（Server-Sent Events）でフロントエンドに配信する方針だったが、**2026-07-29時点ではフロントエンド・HTTP APIはまだ着手しておらず、`scripts/game_cli.py`（作業室）向けにプロセス内メモリでの進行状況共有として実装済み**（詳細は上記「作業内容のリアルタイム表示」参照）。配信するイベントは決定通り3種（①エージェント開始/終了 ②LLMのトークン単位のストリーミング ③発言・担当パートの確定）。フロントエンド向けのSSE HTTP API化は、REST API化そのものとセットで行うのが自然なため今回は見送っている（ロードマップ参照。将来「社長が生成中に割り込む・中断する」等の双方向操作が必要になったらWebSocketへの移行を検討する、という方針自体は変更なし）。
- 各エージェントのキャラクター設定（口調・性格）はバックエンド側でプロンプト/システムメッセージとして管理し、フロントエンドは表示に専念する。**systemプロンプトには「あなたは◯◯という名前の、DeepSeekベースのエージェントです」のように自己認識を明示的に含めること。** 実際にDeepSeekへ自己紹介させたところ、自己認識が学習データの影響で混乱し「Anthropicが開発したClaudeです」のように別のAIを名乗った事例があるため（`memo/バックエンド確認方法.md`参照）。
- LLM呼び出しはプロバイダ抽象化レイヤーを設け、エージェントごとに Claude / OpenAI / DeepSeek / Gemini を切り替えられるようにする。現状 `app/services/llm.py` にはDeepSeek呼び出し（`call_deepseek`）のみ実装済み（OpenAI互換APIのため `openai` SDKで `base_url` を差し替えて利用）。`call_llm(agent, prompt)`が`agent.ai_model.provider`を見て振り分ける入口で、`"deepseek"`以外（`ai_models`テーブルにマスタ登録済みの`claude`等）は`NotImplementedError`を送出する。他プロバイダを追加する際は`call_xxx`関数をこのファイルに並べて実装し、`call_llm`の振り分け先に加える。
- **社長室（雇用・お題・作業割り当て）**: `app/services/hiring.py`でエージェント雇用（役職・スキル・AIモデル選択。上流工程系の役職は`ai_models.capability_tags`による選択肢のハード制限あり）・編集・削除を実装済み。`app/services/work.py`の`create_task`でお題（`Task`）を登録する際、`requires_meeting`（会議室での話し合いが必要か）を社長が指定する。お題の状態は`awaiting_meeting`→`meeting_in_progress`→`awaiting_approval`→`ready_for_work`→`work_in_progress`→`completed`の順に遷移する（会議不要なら`ready_for_work`から開始）。`work.update_task`/`work.delete_task`でお題の編集・削除もできる（完了済み・進行中のお題は編集・削除不可）。作業の割り当ては`work.start_work`/`work.finish_work`（予約→バックグラウンド実行）が担当し、`ready_for_work`のお題に対して担当者（worker、1体以上）とリーダーを選び、単一の成果物を作成する。`backend-core/scripts/game_cli.py`から、部屋を選ぶ形式のCLIでこれら（雇用・編集・削除・お題作成・会議・レポート承認・作業割り当て・作業室での成果物確認・メールでの通知確認）を一通り試せる。API化・フロントエンド結合はまだ行っていない（`FRONTEND.md`のフェーズB、ロードマップ参照）。
- `app/core/config.py` の `.env` 読み込みは、実行時のカレントディレクトリに依存しないよう `backend-core/.env` への絶対パスを明示的に指定している（`scripts/`配下のツールなどをどこから実行しても動くようにするため）。新しく設定値を読み込む処理を追加する際もこの方式を踏襲すること。

## DB設計

DBスキーマ（ER図・テーブル定義・各テーブルの説明・決定事項・実装ステップ）は `DATABASE.md` にまとめている。エージェントが複数体に増えることを見据えた設計で、2026-07-25時点でER図・テーブル構成をレビュー済み（確定）。**2026-07-27にSQLAlchemyモデル・Alembicマイグレーション・初期データ投入（seed）・エージェント登録情報のDB化・お題の状態遷移（会議要否・レポート承認ゲート）・1お題1成果物の協力作業フローまで実装済み**（手順・動かし方は`memo/DB利用方法.md`・`memo/game_cli使い方.md`参照）。REST API化・メールAPI等は未実装（ロードマップ参照）。DBに関する変更・追記を行う際は、AGENTS.mdではなく`DATABASE.md`を更新すること。

## フロントエンド実装

`frontend/`の画面実装タスク一覧（現状の実装状況・フェーズ分けしたタスク・ディレクトリ構成方針）は `FRONTEND.md` にまとめている。チームメンバーはこれを見ながら担当タスクを実装する。フロントエンドのタスクに関する変更・追記を行う際は、AGENTS.mdではなく`FRONTEND.md`を更新すること。

## 開発ワークフロー（タスクとエージェントの分割）

- 機能実装は機能・領域ごとの単位に分割し、タスクごとに別のAIエージェントを割り当てて作業を行うこと。
  （例: フロントエンドとバックエンドは別エージェント、ドキュメント整備と実装は別エージェント、というように担当を分ける。）
- 各エージェントは、自分に割り当てられたタスクの担当範囲（フォルダ・ファイル）を明確にし、その範囲外には触れないこと。

## 依頼範囲を超えて変更しない

- **依頼されていない変更を勝手に行わない。** 担当外のファイル・フォルダ・設定を、良かれと思って推測で修正・削除・追加しないこと。
- 追加で必要と思われる変更に気づいた場合は、先に報告し、実施前に確認を取ってから対応すること。

## 今後の実装予定（ロードマップ）

今後着手する機能をここで管理する。着手・完了したら該当項目にチェックを入れる（または削除し、`memo/変更履歴.md`に実施内容を記録する）。新しくやりたいことが決まったら、都度この一覧に追記すること。

### バックエンド（エージェント・オーケストレーション）
- [x] お題を出す際に依頼先エージェントを選択できるようにする（`GET /api/agents`で一覧取得、`POST /api/tasks`に`agent_id`を指定）。2026-07-27にDB化済み（`agent_id`はint）。
- [x] 会議室での複数エージェント・役割分担（2026-07-27、`meeting_graph.py`/`meetings.py`で実装済み。現状は1ノード内で参加者を順番に呼ぶ実装で、LangGraphの条件付きEdgeによる分岐は未使用。`scripts/game_cli.py`の会議室メニューから試せる）
- [x] リアルタイムストリーミング配信 — ただし対象・実現方法はスコープ調整の上で変更（2026-07-29）。フロントエンドはまだ実装しないため、`scripts/game_cli.py`の作業室でのリアルタイム表示として実装した。
  - [x] `app/services/llm.py`に`stream_deepseek`/`stream_llm`（AsyncIterator版）を追加
  - [x] `app/services/work_graph.py`の`run_work_node`を`get_stream_writer`によるcustomイベント配信に対応（`graph.py`単体ではなく、game_cli.pyが実際に使う`work_graph.py`を対象にした）
  - [x] `app/services/work.py`の`finish_work`を`work_graph.astream(..., stream_mode=["custom","values"])`化し、新規`app/services/work_progress.py`（プロセス内メモリの進行状況ストア）に反映
  - [x] `scripts/game_cli.py`の作業室「作業内容を確認する」で、進行中の作業もその場のスナップショットとして見られるようにした（フロントエンドUI・SSE HTTPエンドポイントは未着手。REST API化とセットで次のイテレーションへ）
- [ ] LangGraph checkpointerによる状態のDB永続化（PostgreSQLとの共存設計）
- [x] エージェント登録情報のDB化（`agents_registry.py`の静的辞書から`agents`テーブル参照へ移行済み。2026-07-27）
- [x] 会議室のDB永続化・オーケストレーション実装（`meetings.py`。CLI経由での実行のみで、REST API化はまだ）
- [x] 成果物のDB永続化（`work.py`。`artifacts`テーブルへの保存・一覧取得。CLI経由での実行のみで、REST API化・簡易プレビュー表示はまだ）
- [x] お題の状態遷移（会議要否の選択・レポート承認ゲート）と、1お題1成果物への協力作業フローを実装（2026-07-27。`tasks.requires_meeting`/`meeting_reports.approved_at`追加、`work_graph.py`新規、`work.py`/`meetings.py`更新。`scripts/game_cli.py`から一通り試せる）
- [x] 社長室でのお題編集・削除、会議室での会議対象お題一覧表示を追加（2026-07-29。`work.update_task`/`work.delete_task`新規）
- [x] 会議・作業の並行処理化（予約→バックグラウンド実行の2段階化）、完了/失敗のメール通知、エージェントの稼働状況（busy）管理を実装（2026-07-29。`work_sessions`/`work_session_participants`テーブル追加、`Task.status`に`meeting_in_progress`/`work_in_progress`追加、`app/services/availability.py`・`app/services/notifications.py`新規、`scripts/game_cli.py`を全面的に非ブロッキングI/O化。既存の`email_threads`/`email_messages`テーブルを通知用途で実装に使い始めた）
- [ ] 上記各点のREST API化（`app/api/`配下。フロントエンド結合用。詳細は`DATABASE.md`参照。作業室のストリーミング表示をSSEでフロントエンドに配信するAPIも、ここで一緒に行う）
- [ ] メールへの返信機能・外部メール送受信連携の設計・実装（現状は完了/失敗の一方向通知のみ。`DATABASE.md`の`email_threads`/`email_messages`参照）
- [ ] 完了報告・報酬計算ロジック

### エージェント・スキル定義
- [x] `agents/`フォルダの実データ化 第一弾: アイデア出しエージェント（ひらめきポン太）を実装済み（`agents/idea_agent.md`。system_promptはDBの`agents`テーブルにも投入済み）。他のキャラクター（バックエンド・フロントエンド・料理系など）は未実装。
- [x] 2体目以降のエージェント追加手段: `scripts/game_cli.py`の社長室「エージェントを作成する」から、名前・性格・役職・AIモデル・スキルを選んでDBに直接雇用できる（2026-07-27）。`agents/`にペルソナファイル＋`seed_db.py`追記という方法も引き続き利用可能。
- [ ] `skills/`フォルダの実データ化（現状`ai_models`/`skills`テーブルには仮データのみ投入済み。実データ化はこれから）
- [ ] DeepSeek以外のプロバイダ対応（Claude / OpenAI / Gemini、`app/services/llm.py`に追加。`ai_models`テーブルにはclaude-opus/haikuのマスタデータのみ先行登録済み）

### フロントエンド
- [ ] 詳細なタスク一覧は `FRONTEND.md` を参照（フェーズA: 画面・操作の実装／フェーズB: バックエンド結合。着手・完了の管理もそちらで行う）

### 運用・その他
- [ ] コミット・ブランチ運用ルールの明文化
- [x] DBスキーマ・ER図をレビューし、`DATABASE.md`として確定済み（2026-07-25）
- [x] `DATABASE.md`の内容をSQLAlchemyモデル・Alembicマイグレーションとして実装済み（2026-07-27。`backend-core/app/models/`・`alembic/versions/`）
- [x] `ai_models`・`roles`・`skills`の初期データ投入（seed）を実装・実行済み（2026-07-27。`backend-core/scripts/seed_db.py`）

## 開発時の注意

- 本ファイルはプロジェクト初期段階のまとめであり、詳細なDBスキーマ・API設計・ディレクトリ構成は未確定。実装を始める際はこのAGENTS.mdを更新しながら進めること。
