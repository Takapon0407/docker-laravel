import assert from "node:assert/strict";
import { test } from "node:test";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { BoardStack, type BoardStage } from "../lib/board-stack.ts";

const env = { account: "123456789012", region: "ap-northeast-1" };

// NodejsFunction の esbuild での bundle は時間がかかるため、テンプレートはステージごとに 1 回だけ作る
const templates = new Map<BoardStage, Template>();
function template(stage: BoardStage): Template {
    let t = templates.get(stage);
    if (!t) {
        const app = new App();
        const stack = new BoardStack(app, `Test-${stage}`, {
            env,
            stage,
            originSecretParameterName: stage === "prod" ? "/test/origin-secret" : undefined,
        });
        t = Template.fromStack(stack);
        templates.set(stage, t);
    }
    return t;
}

test("テーブルは PK / SK・オンデマンド・expiresAt で TTL", () => {
    template("dev").hasResourceProperties("AWS::DynamoDB::GlobalTable", {
        KeySchema: [
            { AttributeName: "PK", KeyType: "HASH" },
            { AttributeName: "SK", KeyType: "RANGE" },
        ],
        BillingMode: "PAY_PER_REQUEST",
        TimeToLiveSpecification: { AttributeName: "expiresAt", Enabled: true },
    });
});

test("WebSocket の各ルートを作る", () => {
    const routes = template("dev").findResources("AWS::ApiGatewayV2::Route");
    const keys = Object.values(routes).map((r) => (r as { Properties: { RouteKey: string } }).Properties.RouteKey).sort();

    assert.deepEqual(keys, ["$connect", "$default", "$disconnect", "ping"]);
});

test("prod はテーブルを残し、削除保護を付ける。dev は消せる", () => {
    template("prod").hasResource("AWS::DynamoDB::GlobalTable", { DeletionPolicy: "Retain" });
    template("prod").hasResourceProperties("AWS::DynamoDB::GlobalTable", {
        Replicas: [Match.objectLike({ DeletionProtectionEnabled: true })],
    });
    template("dev").hasResource("AWS::DynamoDB::GlobalTable", { DeletionPolicy: "Delete" });
});

test("prod だけ確認用ヘッダーの値を SSM から読む", () => {
    template("prod").hasResourceProperties("AWS::Lambda::Function", {
        Environment: { Variables: Match.objectLike({ ORIGIN_SECRET_PARAMETER: "/test/origin-secret" }) },
    });
    template("dev").hasResourceProperties("AWS::Lambda::Function", {
        Environment: { Variables: Match.objectLike({ ORIGIN_SECRET_PARAMETER: "" }) },
    });
});

test("ステージにスロットリングを付ける", () => {
    template("dev").hasResourceProperties("AWS::ApiGatewayV2::Stage", {
        DefaultRouteSettings: { ThrottlingRateLimit: 20, ThrottlingBurstLimit: 40 },
    });
});
