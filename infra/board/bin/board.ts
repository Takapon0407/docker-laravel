import { App } from "aws-cdk-lib";
import { BoardStack } from "../lib/board-stack.ts";

// 別のアカウント・リージョンに誤ってデプロイしないよう固定する
const env = { account: "945611748417", region: "ap-northeast-1" };

const app = new App();

new BoardStack(app, "BoardStack-dev", {
    env,
    stage: "dev",
    // dev 用の値（秘密ではない）。確認用の CloudFront を通らない接続を弾けるかを確かめる
    originSecret: { value: "dev-origin-check" },
    testDistribution: true,
});

new BoardStack(app, "BoardStack-prod", {
    env,
    stage: "prod",
    originSecret: { parameterName: "/tektektech/board/prod/origin-secret" },
});
