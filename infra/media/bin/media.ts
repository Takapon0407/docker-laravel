import { App } from "aws-cdk-lib";
import { MediaStack } from "../lib/media-stack.ts";

// 別のアカウント・リージョンに誤ってデプロイしないよう固定する
const env = { account: "945611748417", region: "ap-northeast-1" };

const app = new App();

new MediaStack(app, "MediaStack", {
    env,
    // ポートフォリオ（tektektech-portfolio.com）の CloudFront。秘密ではない
    distributionId: "E1TTETLRJCSS3D",
    // CloudFront の無料枠（毎月 1TB）に余裕を残す。確認は 5 分おきで、CloudWatch の値も数分遅れるため
    limitGb: 700,
});
