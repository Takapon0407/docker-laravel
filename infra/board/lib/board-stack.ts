import { fileURLToPath } from "node:url";
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps, Tags } from "aws-cdk-lib";
import { WebSocketApi, WebSocketStage } from "aws-cdk-lib/aws-apigatewayv2";
import { WebSocketLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { AttributeType, Billing, TableV2 } from "aws-cdk-lib/aws-dynamodb";
import { Architecture, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";

export type BoardStage = "dev" | "prod";

export interface BoardStackProps extends StackProps {
    readonly stage: BoardStage;
    // CloudFront が付ける確認用ヘッダーの値を入れた SSM の SecureString の名前（手で作る）。未指定なら確かめない
    readonly originSecretParameterName?: string;
}

// 匿名質問ボード（Issue #252）のバックエンド：API Gateway（WebSocket）→ Lambda → DynamoDB
export class BoardStack extends Stack {
    constructor(scope: Construct, id: string, props: BoardStackProps) {
        super(scope, id, { ...props, terminationProtection: props.stage === "prod" });
        const isProd = props.stage === "prod";

        Tags.of(this).add("Project", "tektektech-board");
        Tags.of(this).add("Stage", props.stage);

        // ルーム・投稿・接続などを 1 つのテーブルに置く（PK / SK の形は Issue #252 の設計を参照）
        // 期限切れの項目は expiresAt（UNIX 秒）で DynamoDB が自動で消す
        const table = new TableV2(this, "Table", {
            partitionKey: { name: "PK", type: AttributeType.STRING },
            sortKey: { name: "SK", type: AttributeType.STRING },
            billing: Billing.onDemand(),
            timeToLiveAttribute: "expiresAt",
            deletionProtection: isProd,
            removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
        });

        const logGroup = new LogGroup(this, "HandlerLogs", {
            retention: RetentionDays.TWO_WEEKS,
            removalPolicy: RemovalPolicy.DESTROY,
        });

        const handler = new NodejsFunction(this, "Handler", {
            entry: fileURLToPath(new URL("../lambda/handler.ts", import.meta.url)),
            runtime: Runtime.NODEJS_24_X,
            architecture: Architecture.ARM_64,
            memorySize: 256,
            timeout: Duration.seconds(10),
            logGroup,
            bundling: {
                minify: true,
                sourceMap: true,
            },
            environment: {
                TABLE_NAME: table.tableName,
                ORIGIN_SECRET_PARAMETER: props.originSecretParameterName ?? "",
                NODE_OPTIONS: "--enable-source-maps",
            },
        });
        table.grantReadWriteData(handler);

        if (props.originSecretParameterName) {
            StringParameter.fromSecureStringParameterAttributes(this, "OriginSecret", {
                parameterName: props.originSecretParameterName,
            }).grantRead(handler);
        }

        const integration = new WebSocketLambdaIntegration("HandlerIntegration", handler);
        const api = new WebSocketApi(this, "Api", {
            apiName: `tektektech-board-${props.stage}`,
            connectRouteOptions: { integration },
            disconnectRouteOptions: { integration },
            defaultRouteOptions: { integration },
        });
        api.addRoute("ping", { integration });

        const stage = new WebSocketStage(this, "Stage", {
            webSocketApi: api,
            stageName: "ws",
            autoDeploy: true,
            // 大量の接続・メッセージで費用が膨らまないよう上限を決める（値は Issue #258 で見直す）
            throttle: { rateLimit: 20, burstLimit: 40 },
        });
        handler.addEnvironment("CALLBACK_URL", stage.callbackUrl);
        api.grantManageConnections(handler);

        new CfnOutput(this, "WebSocketUrl", { value: stage.url });
        new CfnOutput(this, "TableName", { value: table.tableName });
    }
}
