# 匿名質問ボードのバックエンド（CDK）

`/tools/board` の WebSocket API（API Gateway → Lambda → DynamoDB）。要件と設計は Issue #252 を参照。

```
bin/board.ts          スタックの定義（BoardStack-dev / BoardStack-prod、ap-northeast-1）
lib/board-stack.ts    DynamoDB・Lambda・WebSocket API
lib/ci-stack.ts       GitHub Actions 用の IAM ロール（BoardCiStack）
lib/ci-stack.ts       GitHub Actions 用の IAM ロール（BoardCiStack）
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
- `BoardStack-prod` は削除保護付き。CloudFront が付ける確認用ヘッダーの値を、SSM の SecureString `/tektektech/board/prod/origin-secret` に先に作っておく（「本番の公開」）
- `--hotswap` / `--express` は dev だけで使う（本番では使わない）

## CI/CD（Issue #259）

`.github/workflows/board.yml`。`infra/board/**` かワークフローが変わったときだけ動く。

| きっかけ | すること | AWS のロール |
| --- | --- | --- |
| PR | テスト・`cdk synth`、dev / prod との diff を PR にコメント | `github-actions-board-diff`（読み取りだけ） |
| `develop` への push | `BoardStack-dev` にデプロイ（Environment「board-dev」） | `github-actions-board-deploy` |
| `main` への push | 承認のあと `BoardStack-prod` にデプロイ（Environment「production」） | `github-actions-board-deploy` |

- ロールは `BoardCiStack` で作る。CI が自分の権限を広げられないよう、**このスタックは CI からはデプロイせず、管理者が手でデプロイする**
- diff 用のロールは、CDK のブートストラップの lookup ロール（読み取りだけ。KMS の復号は拒否されるので SecureString は読めない）だけを引き受けられる。フォーク・Dependabot の PR には OIDC のトークンが渡らないため、diff は動かない
- デプロイ用のロールは、Environment の `board-dev` / `production` のジョブからだけ引き受けられる。どのブランチから動かせるか・承認が要るかは Environment の設定で決める
  - CloudFormation の実行ロール（ブートストラップの `cfn-exec-role`）は管理者の権限を持つため、デプロイ用のロールは実質的に何でも作れる。Environment の設定（ブランチの制限・承認）で守る

### 初回の準備（管理者が 1 回だけ）

```bash
# 1. ロールを作る
npx cdk deploy BoardCiStack --profile <管理者のプロファイル>
```

2. GitHub の Settings → Environments で設定する
   - `board-dev` を作り、Deployment branches を `develop` だけにする
   - `production` に Required reviewers（自分）を付け、Deployment branches を `main` だけにする

## 本番の公開（Issue #260）

ポートフォリオの CloudFront は CDK の外で管理しているため、`/tools/board/ws` のビヘイビアは手で足す。上から順に行う。

1. CloudFront が付ける確認用ヘッダーの値を作る（値は表示しない）

   ```bash
   aws ssm put-parameter --name /tektektech/board/prod/origin-secret --type SecureString \
     --value "$(openssl rand -hex 32)" --profile <管理者のプロファイル>
   ```

2. `develop` → `main` をマージし、Actions の「Board (CDK)」の `deploy-prod` を承認する（`BoardStack-prod` ができる）。出力の `OriginDomain`・`RewriteFunctionName`・`OriginRequestPolicyName`・`AlarmTopicArn` を控える
3. アラームのメールを購読する（「エラーのアラーム」の手順。prod の `AlarmTopicArn` で）
4. CloudFront（ポートフォリオのディストリビューション）にオリジンを足す
   - Origin domain：`OriginDomain`（`xxxx.execute-api.ap-northeast-1.amazonaws.com`）
   - Protocol：HTTPS only（最小の TLS は TLSv1.2）。Origin path は空
   - Add custom header：名前 `X-Origin-Verify`、値は 1. の値（`aws ssm get-parameter --name /tektektech/board/prod/origin-secret --with-decryption --query Parameter.Value --output text --profile <管理者のプロファイル>` で表示し、コンソールに貼る）
5. ビヘイビアを足す
   - Path pattern：`/tools/board/ws`、Origin：4. のオリジン
   - Viewer protocol policy：HTTPS only、Allowed HTTP methods：GET, HEAD
   - Cache policy：`CachingDisabled`、Origin request policy：`OriginRequestPolicyName`（`tektektech-board-prod-websocket`）
   - Function associations：Viewer request に CloudFront Functions の `RewriteFunctionName`（`tektektech-board-prod-rewrite`）
6. Parameter Store の `/tektektech/prod/env` で `BOARD_ENABLED=true` にする（`BOARD_WEBSOCKET_URL` は空のまま：ページと同じドメインの `/tools/board/ws` につなぐ）。EC2 のデプロイ（`deploy.yml`）をもう一度実行すると反映される
7. https://tektektech-portfolio.com/tools/board でルームを作り、別の端末から参加して確かめる

`X-Origin-Verify` の値を変えるときは、SSM の値と CloudFront のヘッダーの両方を変える（Lambda は起動したときに読んだ値を使い続けるため、変えたあとは Lambda の環境変数を変えるなどして入れ替えないと、新しい値の接続が断られることがある）。

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
| 1 ルームの主催者の接続 | 10 件（タブごとに 1 件） | `lambda/router.ts` |
| 新しい接続 | 同じ IP から 1 分に 60 回（超えたら `$connect` を 429 で断る） | `lambda/router.ts` |
| 1 つの接続から送るメッセージ | 10 秒に 20 件（超えたら断って接続を切る。ブラウザは入り直す） | `lambda/router.ts` |
| API Gateway | 1 秒に 20 件（瞬間的には 40 件）。全ルーム・全接続で 1 つ | `lib/board-stack.ts` |

- IP は CloudFront が付ける `CloudFront-Viewer-Address` から取る（閲覧者が同じ名前のヘッダーを送っても CloudFront が上書きすることを dev で確かめた）。IP の形でない値は使わず、IPv6 は /64 ごとにまとめて数える
- API Gateway の流量制限は IP ごとではないため、多くの IP から一斉に送られると全ルームが止まりうる。本番のディストリビューションには WAF（コア保護）が付いているが、WAF が見るのは WebSocket を始めるときの HTTP リクエストだけで、つないだあとのメッセージは数えない。WAF のレートベースのルールで抑えられるのは接続の回数だけ（Lambda の「同じ IP から 1 分に 60 回」と同じ役割）
