# 作品の音源の配信と転送量の上限（CDK）

`/works/*` で再生する音源などの大きいファイルを、S3 からポートフォリオの CloudFront の `/media/*` で配信する。
あわせて、**CloudFront の今月の転送量が上限（700GB）を超えたら、その月は `/media/*` を止める**。止まっている間、ページのプレーヤーは YouTube・配信サービスを案内する。

```
閲覧者 ─→ CloudFront の /media/* ─ viewer request: CloudFront Function（tektektech-media-gate）
                │                     KeyValueStore の media_enabled が "false" なら 403（キャッシュより前で止める）
                └─ OAC ─→ S3（tektektech-media-<アカウント>、公開しない。キーは media/...）

EventBridge（5 分おき）─→ Lambda（Guard）
    CloudWatch（us-east-1）から今月（UTC）の BytesDownloaded（ディストリビューション全体）の合計を取る
    前回の判定（Parameter Store の /tektektech/media/enabled）から変わったときだけ
    KeyValueStore の media_enabled を書き換え、SNS で知らせる（月が変わって下回れば再開）
```

```
bin/media.ts          スタックの定義（MediaStack、ap-northeast-1）。ディストリビューションの ID と上限（GB）
lib/media-stack.ts    S3・OAC・KeyValueStore・CloudFront Function・Lambda・アラーム
lambda/guard.ts       Lambda の入り口（AWS への通信）
lambda/usage.ts       上限の判定（テストではこちらを使う）
edge/media-gate.js    CloudFront Function のコード
```

- 転送量はディストリビューション全体（ページ・画像も含む）で数える。CloudFront の無料枠（毎月 1TB）もアカウント全体で、UTC の暦月で数えるため、それにあわせている
- 確認は 5 分おきで、CloudWatch の値も数分遅れて届く。その間に配信される分があるので、上限は 1TB より低くしている
- KeyValueStore の API は 1,000 回で 1 ドルかかるため、毎回は読まない。前回の判定は Parameter Store（無料）に残し、変わったときだけ書く
- KeyValueStore の API は SigV4a の署名が要る。`@aws-sdk/signature-v4a` を読み込むと SDK に登録される（`test/sigv4a.test.ts`）。同じ SDK に登録するため、Lambda は SDK ごとまとめる（`externalModules: []`）

## 手元での確認

```bash
cd infra/media
npm ci
npm run typecheck
npm test
npm run synth        # cdk synth --strict（AWS の認証情報は不要）
```

## 公開の手順（AWS の管理者の権限が必要）

ポートフォリオの CloudFront は CDK の外で管理しているため、`/media/*` のビヘイビアは手で足す。上から順に行う。
閲覧専用のプロファイル（`tektektech-view`）ではデプロイできない。CDK のブートストラップは `infra/board` で済んでいる。

1. スタックをデプロイする（削除保護付き）。出力の `BucketName`・`BucketRegionalDomainName`・`OriginAccessControlId`・`GateFunctionName`・`ResponseHeadersPolicyName`・`TopicArn` を控える

   ```bash
   cd infra/media
   npx cdk diff MediaStack --profile <管理者のプロファイル>
   npx cdk deploy MediaStack --profile <管理者のプロファイル>
   ```

2. 止めたとき・再開したとき・確認の処理が失敗し続けたときの通知を、メールで購読する（宛先は公開リポジトリに書かない。届いた確認メールのリンクを開くと購読が始まる）

   ```bash
   aws sns subscribe --topic-arn <TopicArn> --protocol email --notification-endpoint <メールアドレス> --profile <管理者のプロファイル>
   ```

3. 音源をアップロードする。ブラウザに長くキャッシュさせるため、**中身を差し替えるときはファイル名かフォルダを変える**（`config/rain-and-realms.php` の `media_path`）

   ```bash
   aws s3 sync ~/Desktop/RainAndRealms/albums/01_kominka-rain/release/web/audio/ \
     s3://<BucketName>/media/rain-and-realms/kominka-rain/ \
     --exclude "*" --include "*.m4a" \
     --content-type audio/mp4 --cache-control "public, max-age=31536000, immutable" \
     --profile <管理者のプロファイル>
   ```

   ダウンロード用の MP3・WAV も、再生用と同じ名前（拡張子だけ違う）で同じフォルダに置く。開かずに保存させるため `Content-Disposition: attachment` を付ける（保存するときの名前は、ページの `download` 属性で曲名にしている）。
   WAV は DistroKid に出した元のファイルにタグを付けたもの、MP3 はそこから作った 320kbps（ジャケット付き）。手元では `laravel/public/media/`（Git には入れない）に作ってある

   ```bash
   for ext in mp3:audio/mpeg wav:audio/wav; do
     aws s3 sync laravel/public/media/rain-and-realms/kominka-rain/ \
       s3://<BucketName>/media/rain-and-realms/kominka-rain/ \
       --exclude "*" --include "*.${ext%%:*}" \
       --content-type "${ext#*:}" --content-disposition attachment \
       --cache-control "public, max-age=31536000, immutable" \
       --profile <管理者のプロファイル>
   done
   ```

4. CloudFront（ポートフォリオのディストリビューション）にオリジンを足す
   - Origin domain：`BucketRegionalDomainName`（`tektektech-media-….s3.ap-northeast-1.amazonaws.com`）。Origin path は空
   - Origin access：Origin access control settings で `tektektech-media`（`OriginAccessControlId`）を選ぶ
   - バケットポリシーはスタックで付けてあるので、コンソールが出す「ポリシーをコピー」は使わなくてよい
5. ビヘイビアを足す
   - Path pattern：`/media/*`、Origin：4. のオリジン
   - Viewer protocol policy：Redirect HTTP to HTTPS、Allowed HTTP methods：GET, HEAD
   - Cache policy：`CachingOptimized`、Origin request policy：なし
   - Response headers policy：`ResponseHeadersPolicyName`（`tektektech-media-headers`）
   - Function associations：Viewer request に CloudFront Functions の `GateFunctionName`（`tektektech-media-gate`）
6. 確かめる

   ```bash
   # 200・Content-Type: audio/mp4・Cache-Control が付くこと
   curl -sI https://tektektech-portfolio.com/media/rain-and-realms/kominka-rain/01-first-drops-on-the-engawa.m4a
   # 置いていないファイル・media/ 以外は 403（S3 は一覧を見せない）
   curl -sI https://tektektech-portfolio.com/media/nothing.m4a
   ```

   Lambda のログ（CloudWatch Logs の `GuardLogs`）に、5 分おきに今月の転送量が出ていることも確かめる。

7. （任意）WAF のレートベースのルールを足す。上の上限は 5 分おきなので、1 台から一気に取られる分は WAF で先に止める。
   ディストリビューションには WAF（`CreatedByCloudFront-…`）が付いている。ルールの中身は閲覧専用のプロファイルでは見られないので、コンソールで確かめ、`/media/` へのレートベースのルールがなければ足す
   - Rate-based rule：同じ IP から 5 分間に 300 リクエストを超えたら Block（音源は分割して取りに行くため、1 曲で数回〜十数回。普通に聴く分には届かない）
   - Scope-down statement：URI path が `/media/` で始まる
   - 費用：ルール 1 つで月 1 ドルほど（リクエストの料金は WAF 全体で共通）

8. `develop` → `main` をマージし（ページの公開）、https://tektektech-portfolio.com/works/rain-and-realms で再生できることを確かめる

## 手で止める・止まったときの表示を試す

CloudFront のコンソール → Functions → KeyValueStores → `tektektech-media-switch` で、`media_enabled` を `false` にすると止まり、`true` に戻すと再開する（数秒〜数十秒で反映される）。
Lambda は前回の判定から変わったときだけ書き換えるため、手で変えた値は、次に上限をまたぐまで（月が変わるか、上限を超えるまで）そのまま残る。

## 費用の目安

- S3（再生用 73MB・ダウンロード用 約 840MB）：月 3 円ほど
- Lambda・EventBridge：無料枠の中
- CloudWatch の GetMetricData：5 分おき（月 約 8,600 回）で月 0.1 ドルほど
- KeyValueStore：CloudFront Function からの読み取りは 100 万回で 0.03 ドル。API での書き込みは、切り替えたときだけ
- CloudFront Function：`/media/*` へのリクエスト 100 万回で 0.1 ドル（音源は分割して取りに行くため、1 曲で数回〜十数回）

## 上限を変える

`bin/media.ts` の `limitGb` を変えてデプロイする。次の確認（5 分以内）から新しい上限で判定する。
