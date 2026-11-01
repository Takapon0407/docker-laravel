# 匿名質問ボードのバックエンド（CDK）

`/tools/board` の WebSocket API（API Gateway → Lambda → DynamoDB）。要件と設計は Issue #252 を参照。

```
bin/board.ts          スタックの定義（BoardStack-dev / BoardStack-prod、ap-northeast-1）
lib/board-stack.ts    DynamoDB・Lambda・WebSocket API
lambda/handler.ts     Lambda の入り口（AWS への通信を用意する）
lambda/router.ts      ルートごとの処理（テストではこちらを使う）
shared/protocol.ts    ブラウザと Lambda で共有するメッセージの型と検証
```

## 手元での確認

```bash
cd infra/board
npm ci
npm run typecheck
npm test
npm run synth        # cdk synth --strict（AWS の認証情報は不要）
```

## デプロイ（AWS の管理者の権限が必要）

閲覧専用のプロファイル（`tektektech-view`）ではデプロイできない。

```bash
# 初回だけ：CDK がデプロイに使う S3 バケットや IAM ロールを作る
npx cdk bootstrap aws://945611748417/ap-northeast-1 --profile <管理者のプロファイル>

# 変更の内容を確かめてからデプロイする
npx cdk diff BoardStack-dev --profile <管理者のプロファイル>
npx cdk deploy BoardStack-dev --profile <管理者のプロファイル>
```

- デプロイが終わると `WebSocketUrl`（`wss://…/ws`）が出力される
- `BoardStack-prod` は削除保護付き。CloudFront が付ける確認用ヘッダーの値を、SSM の SecureString `/tektektech/board/prod/origin-secret` に先に作っておく（Issue #253・#260）
- `--hotswap` / `--express` は dev だけで使う（本番では使わない）

## エラーのアラーム

Lambda のエラー（ログの `ERROR`・失敗・スロットリング）が 5 分間に 5 回以上あると、SNS のトピックに知らせる。
メールの宛先は公開リポジトリに書かないよう、スタックごとにデプロイ後に 1 回だけ手で購読する（CloudFormation の外で足した購読は、デプロイで消えない）。

```bash
# デプロイの出力の AlarmTopicArn を使う。届いた確認メールのリンクを開くと購読が始まる
aws sns subscribe --topic-arn <AlarmTopicArn> --protocol email --notification-endpoint <メールアドレス> --profile <管理者のプロファイル>
```

## 上限（Issue #258）

| 対象 | 上限 | 決めている場所 |
| --- | --- | --- |
| ルームの作成 | 同じ IP から 1 時間に 5 件 | `shared/protocol.ts` の `LIMITS` |
| 投稿 | 同じブラウザから 10 秒に 1 回、同じ IP から 1 分に 60 回 | `LIMITS`・`lambda/router.ts` |
| 1 ルームの参加者 | 30 人（主催者は数えずに入れる） | `LIMITS` |
| API Gateway | 1 秒に 20 件（瞬間的には 40 件） | `lib/board-stack.ts` |
