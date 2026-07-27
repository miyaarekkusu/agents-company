# DB利用方法メモ（backend-core / PostgreSQL）

`DATABASE.md`の設計（全13テーブル）をもとに、SQLAlchemyモデル・Alembicマイグレーション・初期データ投入（seed）・エージェント登録情報のDB化までを実装しました。ここではその**セットアップ手順・動かし方・何ができるようになったか**をまとめます。

## 機能性（今回のDB実装で何が変わったか）

- `backend-core/app/models/`に、`DATABASE.md`の全13テーブル（`ai_models` / `roles` / `skills` / `agents` / `agent_skills` / `tasks` / `meetings` / `meeting_participants` / `meeting_proposals` / `meeting_reports` / `artifacts` / `email_threads` / `email_messages`）に対応するSQLAlchemyモデルを実装しました。
- Alembicの初期マイグレーション（`backend-core/alembic/versions/91ff22838ff5_初期スキーマ作成.py`）で、上記全テーブルをPostgreSQLに作成できます。
- `backend-core/scripts/seed_db.py`で、`roles`（7役職）・`ai_models`（3件。実際に呼べるのはdeepseek-v4-proのみ、claude-opus/haikuはマスタ登録のみ）・`skills`（3件、仮データ）・`agents`（ひらめきポン太1体）の初期データを投入できます。
- **`app/services/agents_registry.py`が、Pythonの静的な辞書ではなくDB（`agents`テーブル）を参照するようになりました。** これにともない、`POST /api/tasks`・`GET /api/agents`で使う`agent_id`の型が**文字列（例: `"idea_agent"`）から数値（DBの`agents.id`、例: `1`）に変わっています**。今後フロントエンド等からAPIを呼ぶ際はこの点に注意してください。
- `agents/idea_agent.md`のシステムプロンプトは、seed時に`agents`テーブルの`system_prompt`カラムへコピーされ、以降のリクエスト処理はDBの値を直接使います（`app/services/persona.py`によるMarkdownの読み込みは、初期データ投入・再シード用途のみで使う位置づけになりました）。

## セットアップ手順（新しい環境でDBを使えるようにする）

`memo/初期設定.md`のセットアップが完了している前提です。

### 1. PostgreSQLを起動する

```
docker compose up -d db
```

`docker compose ps`で`db`が`healthy`になるのを待ってください。

### 2. マイグレーションを適用する

```
cd backend-core
.venv\Scripts\Activate.ps1   # venv有効化（PowerShellの場合）
alembic upgrade head
```

`ai_models` / `roles` / `skills` / `agents` / `agent_skills` / `tasks` / `meetings` / `meeting_participants` / `meeting_proposals` / `meeting_reports` / `artifacts` / `email_threads` / `email_messages`の13テーブル（＋Alembic管理用の`alembic_version`）が作成されます。

確認方法（Docker経由でpsqlに入る場合）:

```
docker compose exec db psql -U postgres -d ai_company -c "\dt"
```

### 3. 初期データを投入する（seed）

```
python scripts/seed_db.py
```

`roles`・`ai_models`・`skills`・`agents`（ひらめきポン太）へ初期データが入ります。**再実行しても重複投入されない**ようになっているので、間違えて2回実行しても問題ありません。

### 4. Docker Composeでbackend-coreを使う場合は再ビルドを忘れない

`backend-core`のDockerイメージはコード一式を**ビルド時にCOPY**する構成（ソースをbind mountしていない）ため、コード変更後にDocker経由で動かす場合は再ビルドが必要です。

```
docker compose build backend-core
docker compose up -d backend-core
```

## 動かし方（動作確認）

### 方法A: `scripts/chat.py`（一番手軽）

```
cd backend-core
python scripts/chat.py
```

登録済みエージェント一覧（`ひらめきポン太（agent_id: 1）`など）が表示されるので、番号または`agent_id`（数値）で選択し、お題を入力して応答を確認します。

### 方法B: API経由（venvでもDockerでも可）

```
curl http://localhost:8000/api/agents
```

→ `[{"agent_id":1,"name":"ひらめきポン太"}]` のように**数値の`agent_id`**が返ればOKです。

```
printf '%s' '{"task": "新しいお菓子のアイデアを1つ考えて", "agent_id": 1}' > req.json
curl -X POST http://localhost:8000/api/tasks -H "Content-Type: application/json" --data-binary @req.json
```

→ `{"result": "..."}`にひらめきポン太らしい応答が入っていればOKです。存在しない`agent_id`（例: `9999`）を指定すると`404`が返ります。

## トラブルシューティング

- **`alembic upgrade head`が`DATABASE_URL`に接続できずエラーになる**: `docker compose up -d db`でDBが起動しているか、`backend-core/.env`の`DATABASE_URL`（またはデフォルト値）がDBのポート・認証情報と一致しているか確認してください。
- **`scripts/seed_db.py`実行時にログのエンコードエラーが大量に出る**: `backend-core/.env`の`DEBUG=True`だとSQLAlchemyのSQLログが出力され、Windowsのコンソール（cp1252等）が日本語を含むログをエンコードできず`Logging error`が表示されることがあります。処理自体は続行され、投入は正常に完了します（`scripts/chat.py`のUnicodeEncodeError対応と同種の、Windows環境固有の表示上の問題です）。気になる場合は`PYTHONIOENCODING=utf-8`を付けて実行してください。
- **Docker経由で動かしているのにコード変更が反映されない**: 上記「セットアップ手順 4.」の通り、`docker compose build backend-core`をしてから`docker compose up -d backend-core`してください。
- **`agent_id`を文字列で送って動かない**: 今回の変更で`agent_id`は数値になりました。`"idea_agent"`のような文字列ではなく、`GET /api/agents`で返る数値の`agent_id`（例: `1`）を使ってください。

## 関連ドキュメント

- `DATABASE.md`: DBスキーマ設計（ER図・全テーブルの説明・今後の実装ステップ）。
- `AGENTS.md`: プロジェクト全体のガイド・ロードマップ。
- `memo/初期設定.md`: 開発環境の初期セットアップ全般。
- `memo/バックエンド確認方法.md`: `/health`・`scripts/chat.py`等、DB以外も含めた基本的な動作確認方法。
