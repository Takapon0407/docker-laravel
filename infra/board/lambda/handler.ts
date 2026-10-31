// Lambda の入り口。AWS への通信を用意して router に渡す
import { ApiGatewayManagementApiClient, GoneException, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { createRouter } from "./router.ts";

const callbackUrl = requiredEnv("CALLBACK_URL");
// 未設定なら CloudFront からの確認用ヘッダーを確かめない（dev で API Gateway に直接つなぐとき）
const originSecretParameter = process.env.ORIGIN_SECRET_PARAMETER ?? "";

const api = new ApiGatewayManagementApiClient({ endpoint: callbackUrl });
const ssm = new SSMClient({});

// SecureString は CloudFormation から Lambda の環境変数に渡せないため、起動時に 1 回だけ読む
let originSecret: Promise<string | null> | undefined;

export const handler = createRouter({
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
        originSecret ??= originSecretParameter === ""
            ? Promise.resolve(null)
            : ssm
                  .send(new GetParameterCommand({ Name: originSecretParameter, WithDecryption: true }))
                  .then((result) => result.Parameter?.Value ?? Promise.reject(new Error(`${originSecretParameter} has no value`)))
                  .catch((error: unknown) => {
                      // 読めなかったときは次の呼び出しで読み直す
                      originSecret = undefined;
                      throw error;
                  });
        return originSecret;
    },
});

function requiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is not set`);
    }
    return value;
}
