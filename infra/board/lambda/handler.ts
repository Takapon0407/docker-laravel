// Lambda の入り口。AWS への通信を用意して router に渡す
import { randomBytes } from "node:crypto";
import { ApiGatewayManagementApiClient, GoneException, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { createDynamoStore } from "./dynamo-store.ts";
import { createRouter } from "./router.ts";

const callbackUrl = requiredEnv("CALLBACK_URL");
const tableName = requiredEnv("TABLE_NAME");
// 確認用ヘッダーの値は、prod では SSM の SecureString の名前、dev では値そのもの（秘密ではない）を受け取る
// どちらも空なら確かめない
const originSecretParameter = process.env.ORIGIN_SECRET_PARAMETER ?? "";
const originSecretValue = process.env.ORIGIN_SECRET_VALUE ?? "";
const debug = process.env.DEBUG === "1";

const api = new ApiGatewayManagementApiClient({ endpoint: callbackUrl });
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    // 未設定のプロパティ（undefined）は保存しない
    marshallOptions: { removeUndefinedValues: true },
});
const ssm = new SSMClient({});

// SecureString は CloudFormation から Lambda の環境変数に渡せないため、起動時に 1 回だけ読む
let originSecret: Promise<string | null> | undefined;

export const handler = createRouter({
    debug,
    store: createDynamoStore(db, tableName),
    now: () => Date.now(),
    randomToken: () => randomBytes(16).toString("base64url"),
    async send(connectionId, message) {
        try {
            await api.send(new PostToConnectionCommand({ ConnectionId: connectionId, Data: JSON.stringify(message) }));
        } catch (error) {
            // 送る前に切断された接続は無視する（接続の情報は $disconnect で消える）
            if (!(error instanceof GoneException)) {
                throw error;
            }
        }
    },
    originSecret() {
        originSecret ??= loadOriginSecret().catch((error: unknown) => {
            // 読めなかったときは次の呼び出しで読み直す
            originSecret = undefined;
            throw error;
        });
        return originSecret;
    },
});

async function loadOriginSecret(): Promise<string | null> {
    if (originSecretValue !== "") {
        return originSecretValue;
    }
    if (originSecretParameter === "") {
        return null;
    }
    const result = await ssm.send(new GetParameterCommand({ Name: originSecretParameter, WithDecryption: true }));
    const value = result.Parameter?.Value;
    if (!value) {
        throw new Error(`${originSecretParameter} has no value`);
    }
    return value;
}

function requiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is not set`);
    }
    return value;
}
