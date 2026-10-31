// Lambda の入り口。AWS への通信を用意して router に渡す
import { ApiGatewayManagementApiClient, GoneException, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { createRouter } from "./router.ts";

const callbackUrl = requiredEnv("CALLBACK_URL");
const tableName = requiredEnv("TABLE_NAME");
// 確認用ヘッダーの値は、prod では SSM の SecureString の名前、dev では値そのもの（秘密ではない）を受け取る
// どちらも空なら確かめない
const originSecretParameter = process.env.ORIGIN_SECRET_PARAMETER ?? "";
const originSecretValue = process.env.ORIGIN_SECRET_VALUE ?? "";
const debug = process.env.DEBUG === "1";

// API Gateway の WebSocket の接続は最長 2 時間。切断の通知が来なかったときのために、それより長めに残す
const CONNECTION_TTL_SECONDS = 3 * 60 * 60;

const api = new ApiGatewayManagementApiClient({ endpoint: callbackUrl });
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ssm = new SSMClient({});

// SecureString は CloudFormation から Lambda の環境変数に渡せないため、起動時に 1 回だけ読む
let originSecret: Promise<string | null> | undefined;

const connectionKey = (connectionId: string) => ({ PK: `CONN#${connectionId}`, SK: "META" });

export const handler = createRouter({
    debug,
    async send(connectionId, message) {
        try {
            await api.send(new PostToConnectionCommand({ ConnectionId: connectionId, Data: JSON.stringify(message) }));
        } catch (error) {
            // 送る前に切断された接続は無視する（ルームの接続一覧からの削除はルームの実装で行う）
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
    async saveConnection(connectionId, connection) {
        await db.send(
            new PutCommand({
                TableName: tableName,
                Item: { ...connectionKey(connectionId), ip: connection.ip, expiresAt: Math.floor(Date.now() / 1000) + CONNECTION_TTL_SECONDS },
            }),
        );
    },
    async getConnection(connectionId) {
        const { Item } = await db.send(new GetCommand({ TableName: tableName, Key: connectionKey(connectionId) }));
        return Item ? { ip: typeof Item.ip === "string" ? Item.ip : null } : null;
    },
    async deleteConnection(connectionId) {
        await db.send(new DeleteCommand({ TableName: tableName, Key: connectionKey(connectionId) }));
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
