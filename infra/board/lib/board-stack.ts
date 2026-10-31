import { fileURLToPath } from "node:url";
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps, Tags } from "aws-cdk-lib";
import { WebSocketApi, WebSocketStage } from "aws-cdk-lib/aws-apigatewayv2";
import { WebSocketLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import {
    AllowedMethods,
    CachePolicy,
    Distribution,
    Function as CloudFrontFunction,
    FunctionCode,
    FunctionEventType,
    FunctionRuntime,
    OriginProtocolPolicy,
    OriginRequestHeaderBehavior,
    OriginRequestPolicy,
    PriceClass,
    ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { HttpOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { AttributeType, Billing, TableV2 } from "aws-cdk-lib/aws-dynamodb";
import { Architecture, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";

export type BoardStage = "dev" | "prod";

// CloudFront が付ける確認用ヘッダー（x-origin-verify）の値
// - parameterName: SSM の SecureString の名前（手で作る。prod 用）
// - value: 値そのもの。テンプレートに平文で残るため、秘密にしなくてよい dev 用だけに使う
export type OriginSecret = { readonly parameterName: string } | { readonly value: string };

export interface BoardStackProps extends StackProps {
    readonly stage: BoardStage;
    // 未指定なら確かめない（API Gateway に直接つなげる）
    readonly originSecret?: OriginSecret;
    // 本番と同じ「CloudFront の /tools/board/ws → API Gateway」の経路を、確認用の CloudFront で再現する（dev 用）
    readonly testDistribution?: boolean;
}

// ブラウザがつなぐパス（本番はポートフォリオの CloudFront に、同じ設定のビヘイビアを手で追加する）
export const WEBSOCKET_PATH = "/tools/board/ws";
const STAGE_NAME = "ws";

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

        const originSecret = props.originSecret;
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
                ORIGIN_SECRET_PARAMETER: originSecret && "parameterName" in originSecret ? originSecret.parameterName : "",
                ORIGIN_SECRET_VALUE: originSecret && "value" in originSecret ? originSecret.value : "",
                DEBUG: isProd ? "0" : "1",
                NODE_OPTIONS: "--enable-source-maps",
            },
        });
        table.grantReadWriteData(handler);

        if (originSecret && "parameterName" in originSecret) {
            StringParameter.fromSecureStringParameterAttributes(this, "OriginSecret", {
                parameterName: originSecret.parameterName,
            }).grantRead(handler);
        }

        const integration = new WebSocketLambdaIntegration("HandlerIntegration", handler);
        const api = new WebSocketApi(this, "Api", {
            apiName: `tektektech-board-${props.stage}`,
            connectRouteOptions: { integration },
            disconnectRouteOptions: { integration },
            defaultRouteOptions: { integration },
        });
        // ブラウザが送る操作（shared/protocol.ts の action）ごとにルートを作る。それ以外は $default でエラーを返す
        for (const action of ["ping", "createRoom", "join"]) {
            api.addRoute(action, { integration });
        }

        const stage = new WebSocketStage(this, "Stage", {
            webSocketApi: api,
            stageName: STAGE_NAME,
            autoDeploy: true,
            // 大量の接続・メッセージで費用が膨らまないよう上限を決める（値は Issue #258 で見直す）
            throttle: { rateLimit: 20, burstLimit: 40 },
        });
        handler.addEnvironment("CALLBACK_URL", stage.callbackUrl);
        api.grantManageConnections(handler);

        new CfnOutput(this, "WebSocketUrl", { value: stage.url });
        new CfnOutput(this, "TableName", { value: table.tableName });

        if (props.testDistribution) {
            if (!originSecret || !("value" in originSecret)) {
                throw new Error("testDistribution には originSecret.value（dev 用の値）が必要です");
            }
            const distribution = this.createTestDistribution(api, originSecret.value);
            new CfnOutput(this, "TestWebSocketUrl", { value: `wss://${distribution.distributionDomainName}${WEBSOCKET_PATH}` });
        }
    }

    private createTestDistribution(api: WebSocketApi, originSecretValue: string): Distribution {
        const origin = new HttpOrigin(`${api.apiId}.execute-api.${this.region}.amazonaws.com`, {
            protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
            customHeaders: { "X-Origin-Verify": originSecretValue },
        });

        // API Gateway はパスの先頭をステージ名として読むため、/tools/board/ws をステージのパスに書き換える
        const rewrite = new CloudFrontFunction(this, "RewriteToStage", {
            runtime: FunctionRuntime.JS_2_0,
            code: FunctionCode.fromInline(`function handler(event) { event.request.uri = "/${STAGE_NAME}"; return event.request; }`),
        });

        // WebSocket の接続に必要なヘッダーと、閲覧者のアドレスを渡す。Host は渡さない（API Gateway のドメインのままにする）
        const originRequestPolicy = new OriginRequestPolicy(this, "WebSocketOriginRequest", {
            headerBehavior: OriginRequestHeaderBehavior.allowList(
                "Sec-WebSocket-Key",
                "Sec-WebSocket-Version",
                "Sec-WebSocket-Protocol",
                "Sec-WebSocket-Extensions",
                "CloudFront-Viewer-Address",
            ),
        });

        const behavior = {
            origin,
            viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
            allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
            cachePolicy: CachePolicy.CACHING_DISABLED,
            originRequestPolicy,
            functionAssociations: [{ function: rewrite, eventType: FunctionEventType.VIEWER_REQUEST }],
        };

        return new Distribution(this, "TestDistribution", {
            comment: "tektektech-board dev: /tools/board/ws の経路の確認用",
            priceClass: PriceClass.PRICE_CLASS_200,
            // 確認用のため、/tools/board/ws 以外にも同じ設定を当てる
            defaultBehavior: behavior,
            additionalBehaviors: { [WEBSOCKET_PATH]: behavior },
        });
    }
}
