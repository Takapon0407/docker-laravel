import assert from "node:assert/strict";
import { test } from "node:test";
import "@aws-sdk/signature-v4a";
import { CloudFrontKeyValueStoreClient, DescribeKeyValueStoreCommand } from "@aws-sdk/client-cloudfront-keyvaluestore";

// KeyValueStore の API は SigV4a の署名が要る。lambda/guard.ts と同じく @aws-sdk/signature-v4a を読み込めば署名できることを確かめる
// （AWS には送らず、署名した直後に止める）
test("KeyValueStore の API のリクエストを SigV4a で署名できる", async () => {
    const client = new CloudFrontKeyValueStoreClient({
        region: "us-east-1",
        credentials: { accessKeyId: "AKIDEXAMPLE", secretAccessKey: "secret" },
    });
    let authorization: string | undefined;
    client.middlewareStack.add(
        () => async (args) => {
            const headers = (args.request as { headers: Record<string, string> }).headers;
            authorization = headers.authorization;
            throw new Error("stop");
        },
        { step: "finalizeRequest", priority: "low", name: "captureSignature" },
    );

    await assert.rejects(
        client.send(new DescribeKeyValueStoreCommand({ KvsARN: "arn:aws:cloudfront::123456789012:key-value-store/00000000-0000-0000-0000-000000000000" })),
        /stop/,
    );
    assert.match(authorization ?? "", /^AWS4-ECDSA-P256-SHA256 /);
});
