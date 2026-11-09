import assert from "node:assert/strict";
import { test } from "node:test";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { MediaStack } from "../lib/media-stack.ts";

const env = { account: "123456789012", region: "ap-northeast-1" };

// NodejsFunction の esbuild での bundle は時間がかかるため、テンプレートは 1 回だけ作る
const template = (() => {
    let t: Template | undefined;
    return (): Template => {
        t ??= Template.fromStack(new MediaStack(new App(), "Test", { env, distributionId: "E123EXAMPLE", limitGb: 700 }));
        return t;
    };
})();

test("バケットは公開せず、ポートフォリオの CloudFront からだけ media/ 以下を読める", () => {
    template().hasResourceProperties("AWS::S3::Bucket", {
        BucketName: "tektektech-media-123456789012",
        PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true },
    });
    template().hasResourceProperties("AWS::S3::BucketPolicy", {
        PolicyDocument: {
            Statement: Match.arrayWith([
                Match.objectLike({
                    Effect: "Allow",
                    Principal: { Service: "cloudfront.amazonaws.com" },
                    Action: "s3:GetObject",
                    Condition: { StringEquals: { "AWS:SourceArn": "arn:aws:cloudfront::123456789012:distribution/E123EXAMPLE" } },
                }),
            ]),
        },
    });
    // スタックを消してもバケット（音源）は残す
    template().hasResource("AWS::S3::Bucket", { DeletionPolicy: "Retain" });
});

test("CloudFront Function は KeyValueStore を読み、その ID を埋め込む", () => {
    const functions = Object.values(template().findResources("AWS::CloudFront::Function")) as { Properties: { FunctionCode: unknown; FunctionConfig: { Runtime: string; KeyValueStoreAssociations: unknown[] } } }[];
    assert.equal(functions.length, 1);
    const fn = functions[0]!;
    assert.equal(fn.Properties.FunctionConfig.Runtime, "cloudfront-js-2.0");
    assert.equal(fn.Properties.FunctionConfig.KeyValueStoreAssociations.length, 1);
    const code = JSON.stringify(fn.Properties.FunctionCode);
    assert.ok(!code.includes("__KVS_ID__"));
    assert.ok(code.includes('cf.kvs(\\"",{"Fn::GetAtt":["Switch'));
    template().hasResourceProperties("AWS::CloudFront::KeyValueStore", { Name: "tektektech-media-switch" });
});

test("Lambda は 5 分おきに動き、上限・ディストリビューションを環境変数で受け取る", () => {
    template().hasResourceProperties("AWS::Events::Rule", { ScheduleExpression: "rate(5 minutes)" });
    template().hasResourceProperties("AWS::Lambda::Function", {
        Environment: { Variables: Match.objectLike({ DISTRIBUTION_ID: "E123EXAMPLE", LIMIT_GB: "700" }) },
    });
    template().hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
            Statement: Match.arrayWith([
                Match.objectLike({ Action: "cloudwatch:GetMetricData", Resource: "*" }),
                Match.objectLike({ Action: ["cloudfront-keyvaluestore:DescribeKeyValueStore", "cloudfront-keyvaluestore:PutKey"] }),
            ]),
        },
    });
});

test("確かめる処理が失敗し続けたら SNS に知らせる", () => {
    template().hasResourceProperties("AWS::CloudWatch::Alarm", {
        MetricName: "Errors",
        Threshold: 3,
        AlarmActions: [Match.objectLike({ Ref: Match.stringLikeRegexp("Topic") })],
    });
});
