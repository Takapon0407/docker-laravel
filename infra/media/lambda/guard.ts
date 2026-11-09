// 5 分おきに動き、今月の CloudFront の転送量が上限を超えたら /media/* の配信を止める（月が変わって下回ったら再開する）
// 止める・再開するは KeyValueStore の media_enabled を書き換え、CloudFront Function（edge/media-gate.js）が読む
import "@aws-sdk/signature-v4a"; // KeyValueStore の API は SigV4a の署名が要る（読み込むだけで SDK に登録される）
import { CloudFrontKeyValueStoreClient, DescribeKeyValueStoreCommand, PutKeyCommand } from "@aws-sdk/client-cloudfront-keyvaluestore";
import { CloudWatchClient, GetMetricDataCommand } from "@aws-sdk/client-cloudwatch";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { GetParameterCommand, PutParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { BYTES_PER_GB, formatGb, monthStart, notificationOf, parseState, shouldEnable, transitionOf } from "./usage.ts";

const env = (name: string): string => {
    const value = process.env[name];
    if (!value) {
        throw new Error(`環境変数 ${name} がありません`);
    }
    return value;
};

// CloudFront のメトリクスは us-east-1 にある
const cloudWatch = new CloudWatchClient({ region: "us-east-1" });
const kvs = new CloudFrontKeyValueStoreClient({ region: "us-east-1" });
const ssm = new SSMClient({});
const sns = new SNSClient({});

export const ENABLED_KEY = "media_enabled";

// 今月の初めから今までの BytesDownloaded（ディストリビューション全体）の合計
async function usedBytesThisMonth(distributionId: string, now: Date): Promise<number> {
    let total = 0;
    let nextToken: string | undefined;
    do {
        const result = await cloudWatch.send(
            new GetMetricDataCommand({
                StartTime: monthStart(now),
                EndTime: now,
                NextToken: nextToken,
                MetricDataQueries: [
                    {
                        Id: "bytes",
                        MetricStat: {
                            Metric: {
                                Namespace: "AWS/CloudFront",
                                MetricName: "BytesDownloaded",
                                Dimensions: [
                                    { Name: "DistributionId", Value: distributionId },
                                    { Name: "Region", Value: "Global" },
                                ],
                            },
                            // 1 日ごとの合計を足す（月の途中の今日の分も、今までの合計が返る）
                            Period: 86400,
                            Stat: "Sum",
                        },
                    },
                ],
            }),
        );
        for (const series of result.MetricDataResults ?? []) {
            for (const value of series.Values ?? []) {
                total += value;
            }
        }
        nextToken = result.NextToken;
    } while (nextToken);
    return total;
}

async function putEnabled(kvsArn: string, enabled: boolean): Promise<void> {
    const { ETag } = await kvs.send(new DescribeKeyValueStoreCommand({ KvsARN: kvsArn }));
    await kvs.send(new PutKeyCommand({ KvsARN: kvsArn, IfMatch: ETag, Key: ENABLED_KEY, Value: String(enabled) }));
}

export async function handler(): Promise<void> {
    const now = new Date();
    const limitBytes = Number(env("LIMIT_GB")) * BYTES_PER_GB;
    const stateParameter = env("STATE_PARAMETER");

    const usedBytes = await usedBytesThisMonth(env("DISTRIBUTION_ID"), now);
    const enabled = shouldEnable(usedBytes, limitBytes);
    const stored = await ssm.send(new GetParameterCommand({ Name: stateParameter }));
    const transition = transitionOf(parseState(stored.Parameter?.Value), enabled);

    console.log(JSON.stringify({ used: formatGb(usedBytes), limit: formatGb(limitBytes), enabled, transition }));
    if (transition === null) {
        return;
    }

    // 先に KeyValueStore を書く（Parameter Store の書き込みに失敗しても、次の回にもう一度同じ値を書くだけで済む）
    await putEnabled(env("KVS_ARN"), enabled);
    await ssm.send(new PutParameterCommand({ Name: stateParameter, Value: String(enabled), Overwrite: true, Type: "String" }));

    const notification = notificationOf(transition, usedBytes, limitBytes, now);
    await sns.send(new PublishCommand({ TopicArn: env("TOPIC_ARN"), Subject: notification.subject, Message: notification.message }));
}
