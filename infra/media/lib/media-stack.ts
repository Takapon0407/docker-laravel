import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps, Tags } from "aws-cdk-lib";
import {
    Function as CloudFrontFunction,
    FunctionCode,
    FunctionRuntime,
    HeadersFrameOption,
    HeadersReferrerPolicy,
    ImportSource,
    KeyValueStore,
    ResponseHeadersPolicy,
    S3OriginAccessControl,
    Signing,
} from "aws-cdk-lib/aws-cloudfront";
import { Alarm, ComparisonOperator, TreatMissingData } from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { Rule, Schedule } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { PolicyStatement, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Architecture, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { BlockPublicAccess, Bucket, BucketEncryption, ObjectOwnership } from "aws-cdk-lib/aws-s3";
import { Topic } from "aws-cdk-lib/aws-sns";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";

export interface MediaStackProps extends StackProps {
    // ポートフォリオの CloudFront（CDK の外で手で管理している）の ID。S3 をこのディストリビューションからだけ読めるようにし、転送量もこれで数える
    readonly distributionId: string;
    // 今月の転送量（ディストリビューション全体）がこれを超えたら /media/* を止める（GB = 2^30 バイト）
    readonly limitGb: number;
}

// 作品の音源などの大きいファイルの配信（S3 → ポートフォリオの CloudFront の /media/*）と、転送量の上限
export class MediaStack extends Stack {
    constructor(scope: Construct, id: string, props: MediaStackProps) {
        super(scope, id, { ...props, terminationProtection: true });
        Tags.of(this).add("Project", "tektektech-media");

        // 公開しないバケット。CloudFront（OAC）からだけ読める。キーは /media/... のパスと同じ（media/rain-and-realms/...）
        const bucket = new Bucket(this, "Bucket", {
            bucketName: `tektektech-media-${this.account}`,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
            encryption: BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            removalPolicy: RemovalPolicy.RETAIN,
        });
        const distributionArn = `arn:aws:cloudfront::${this.account}:distribution/${props.distributionId}`;
        bucket.addToResourcePolicy(
            new PolicyStatement({
                sid: "AllowPortfolioCloudFront",
                principals: [new ServicePrincipal("cloudfront.amazonaws.com")],
                actions: ["s3:GetObject"],
                resources: [bucket.arnForObjects("media/*")],
                conditions: { StringEquals: { "AWS:SourceArn": distributionArn } },
            }),
        );
        const originAccessControl = new S3OriginAccessControl(this, "OriginAccessControl", {
            originAccessControlName: "tektektech-media",
            description: "ポートフォリオの CloudFront から tektektech-media バケットを読む",
            signing: Signing.SIGV4_ALWAYS,
        });

        // 配信してよいか（media_enabled）。Lambda が書き、CloudFront Function が読む
        const store = new KeyValueStore(this, "Switch", {
            keyValueStoreName: "tektektech-media-switch",
            comment: "media_enabled が false のとき /media/* に 403 を返す",
            source: ImportSource.fromInline(JSON.stringify({ data: [{ key: "media_enabled", value: "true" }] })),
        });
        const gate = new CloudFrontFunction(this, "Gate", {
            functionName: "tektektech-media-gate",
            comment: "media_enabled が false なら 403（/media/* の viewer request）",
            runtime: FunctionRuntime.JS_2_0,
            keyValueStore: store,
            code: FunctionCode.fromInline(readFileSync(fileURLToPath(new URL("../edge/media-gate.js", import.meta.url)), "utf8").replace('cf.kvs("__KVS_ID__")', `cf.kvs("${store.keyValueStoreId}")`)),
        });

        // ページと同じセキュリティヘッダー（docker/nginx/security-headers.conf）。音源は長くキャッシュさせる（Cache-Control はアップロード時に付ける）
        const responseHeaders = new ResponseHeadersPolicy(this, "ResponseHeaders", {
            responseHeadersPolicyName: "tektektech-media-headers",
            securityHeadersBehavior: {
                contentTypeOptions: { override: true },
                frameOptions: { frameOption: HeadersFrameOption.SAMEORIGIN, override: true },
                referrerPolicy: { referrerPolicy: HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN, override: true },
                strictTransportSecurity: { accessControlMaxAge: Duration.days(365), includeSubdomains: false, override: true },
            },
        });

        // 前回の判定（"true" / "false"）。KeyValueStore を毎回読むと費用がかかるため、変わったかどうかはこちらで見る
        const state = new StringParameter(this, "State", {
            parameterName: "/tektektech/media/enabled",
            description: "前回の判定（/media/* を配信しているか）。Lambda が書き換える",
            stringValue: "true",
        });

        const topic = new Topic(this, "Topic", { displayName: "tektektech-media" });

        const logGroup = new LogGroup(this, "GuardLogs", {
            retention: RetentionDays.ONE_MONTH,
            removalPolicy: RemovalPolicy.DESTROY,
        });
        const guard = new NodejsFunction(this, "Guard", {
            entry: fileURLToPath(new URL("../lambda/guard.ts", import.meta.url)),
            runtime: Runtime.NODEJS_24_X,
            architecture: Architecture.ARM_64,
            memorySize: 256,
            timeout: Duration.seconds(30),
            logGroup,
            // 同時実行の予約はしない（アカウントの上限が低いとデプロイできないため。重なって動いても同じ値を書くだけ）
            bundling: {
                minify: true,
                sourceMap: true,
                // SigV4a の署名（@aws-sdk/signature-v4a）は SDK と同じものに登録する必要があるため、SDK ごとまとめる
                externalModules: [],
            },
            environment: {
                DISTRIBUTION_ID: props.distributionId,
                LIMIT_GB: String(props.limitGb),
                KVS_ARN: store.keyValueStoreArn,
                STATE_PARAMETER: state.parameterName,
                TOPIC_ARN: topic.topicArn,
                NODE_OPTIONS: "--enable-source-maps",
            },
        });
        guard.addToRolePolicy(new PolicyStatement({ actions: ["cloudwatch:GetMetricData"], resources: ["*"] }));
        guard.addToRolePolicy(
            new PolicyStatement({
                actions: ["cloudfront-keyvaluestore:DescribeKeyValueStore", "cloudfront-keyvaluestore:PutKey"],
                resources: [store.keyValueStoreArn],
            }),
        );
        state.grantRead(guard);
        state.grantWrite(guard);
        topic.grantPublish(guard);

        new Rule(this, "Every5Minutes", {
            description: "CloudFront の今月の転送量を確かめ、上限を超えたら /media/* を止める",
            schedule: Schedule.rate(Duration.minutes(5)),
            targets: [new LambdaFunction(guard, { retryAttempts: 0 })],
        });

        // 確かめる処理が失敗し続けると上限が効かないため、知らせる
        const alarm = new Alarm(this, "GuardErrors", {
            alarmDescription: "/media/* の転送量の確認（Lambda）が 30 分間に 3 回以上失敗した",
            metric: guard.metricErrors({ period: Duration.minutes(30) }),
            threshold: 3,
            evaluationPeriods: 1,
            comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            treatMissingData: TreatMissingData.NOT_BREACHING,
        });
        alarm.addAlarmAction(new SnsAction(topic));

        // CloudFront の /media/* のビヘイビアを手で作るときに使う（README）
        new CfnOutput(this, "BucketName", { value: bucket.bucketName });
        new CfnOutput(this, "BucketRegionalDomainName", { value: bucket.bucketRegionalDomainName });
        new CfnOutput(this, "OriginAccessControlId", { value: originAccessControl.originAccessControlId });
        new CfnOutput(this, "GateFunctionName", { value: gate.functionName });
        new CfnOutput(this, "ResponseHeadersPolicyName", { value: "tektektech-media-headers" });
        new CfnOutput(this, "KeyValueStoreArn", { value: store.keyValueStoreArn });
        new CfnOutput(this, "TopicArn", { value: topic.topicArn });
    }
}
