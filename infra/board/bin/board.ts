import { App } from "aws-cdk-lib";
import { BoardStack } from "../lib/board-stack.ts";

// 別のアカウント・リージョンに誤ってデプロイしないよう固定する
const env = { account: "945611748417", region: "ap-northeast-1" };

const app = new App();

new BoardStack(app, "BoardStack-dev", { env, stage: "dev" });

new BoardStack(app, "BoardStack-prod", {
    env,
    stage: "prod",
    originSecretParameterName: "/tektektech/board/prod/origin-secret",
});
