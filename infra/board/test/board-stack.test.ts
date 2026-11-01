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
            originSecret: stage === "prod" ? { parameterName: "/test/origin-secret" } : { value: "dev-value" },
            testDistribution: stage === "dev",
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

    assert.deepEqual(keys, ["$connect", "$default", "$disconnect", "addTopic", "createRoom", "deletePost", "join", "like", "pin", "ping", "post", "renameTopic", "rotateKeys", "setAccepting", "setTopic", "unlike", "unpin"]);
});

test("prod はテーブルを残し、削除保護を付ける。dev は消せる", () => {
    template("prod").hasResource("AWS::DynamoDB::GlobalTable", { DeletionPolicy: "Retain" });
    template("prod").hasResourceProperties("AWS::DynamoDB::GlobalTable", {
        Replicas: [Match.objectLike({ DeletionProtectionEnabled: true })],
    });
    template("dev").hasResource("AWS::DynamoDB::GlobalTable", { DeletionPolicy: "Delete" });
});

test("確認用ヘッダーの値は、prod は SSM から読み、dev は値をそのまま渡す。debug は dev だけ", () => {
    template("prod").hasResourceProperties("AWS::Lambda::Function", {
        Environment: { Variables: Match.objectLike({ ORIGIN_SECRET_PARAMETER: "/test/origin-secret", ORIGIN_SECRET_VALUE: "", DEBUG: "0" }) },
    });
    template("dev").hasResourceProperties("AWS::Lambda::Function", {
        Environment: { Variables: Match.objectLike({ ORIGIN_SECRET_PARAMETER: "", ORIGIN_SECRET_VALUE: "dev-value", DEBUG: "1" }) },
    });
});

test("確認用の CloudFront は dev だけに作り、/tools/board/ws をステージに書き換えて確認用ヘッダーを付ける", () => {
    template("prod").resourceCountIs("AWS::CloudFront::Distribution", 0);
    template("dev").hasResourceProperties("AWS::CloudFront::Function", {
        FunctionCode: Match.stringLikeRegexp('event.request.uri = "/ws"'),
    });
    template("dev").hasResourceProperties("AWS::CloudFront::Distribution", {
        DistributionConfig: Match.objectLike({
            Origins: [Match.objectLike({ OriginCustomHeaders: [{ HeaderName: "X-Origin-Verify", HeaderValue: "dev-value" }] })],
            CacheBehaviors: [Match.objectLike({ PathPattern: "/tools/board/ws" })],
        }),
    });
    template("dev").hasResourceProperties("AWS::CloudFront::OriginRequestPolicy", {
        OriginRequestPolicyConfig: Match.objectLike({
            HeadersConfig: { HeaderBehavior: "whitelist", Headers: Match.arrayWith(["Sec-WebSocket-Key", "CloudFront-Viewer-Address"]) },
        }),
    });
});

test("prod も /tools/board/ws の書き換えの関数とヘッダーの設定を作り、手で設定するための値を出力する", () => {
    const t = template("prod");

    t.hasResourceProperties("AWS::CloudFront::Function", { Name: "tektektech-board-prod-rewrite", FunctionCode: Match.stringLikeRegexp('event.request.uri = "/ws"') });
    t.hasResourceProperties("AWS::CloudFront::OriginRequestPolicy", { OriginRequestPolicyConfig: Match.objectLike({ Name: "tektektech-board-prod-websocket" }) });
    for (const name of ["OriginDomain", "RewriteFunctionName", "OriginRequestPolicyName"]) {
        t.hasOutput(name, {});
    }
});

test("ステージにスロットリングを付ける", () => {
    template("dev").hasResourceProperties("AWS::ApiGatewayV2::Stage", {
        DefaultRouteSettings: { ThrottlingRateLimit: 20, ThrottlingBurstLimit: 40 },
    });
});

test("エラーのアラームを作り、SNS に知らせる（ログの ERROR も数える）", () => {
    const t = template("dev");

    t.hasResourceProperties("AWS::Logs::MetricFilter", { FilterPattern: '"ERROR"' });
    t.hasResourceProperties("AWS::CloudWatch::Alarm", {
        Threshold: 5,
        ComparisonOperator: "GreaterThanOrEqualToThreshold",
        TreatMissingData: "notBreaching",
        AlarmActions: [{ Ref: Match.stringLikeRegexp("AlarmTopic") }],
    });
    t.resourceCountIs("AWS::SNS::Subscription", 0);
});
