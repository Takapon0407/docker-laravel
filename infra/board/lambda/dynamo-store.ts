import { ConditionalCheckFailedException, TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DeleteCommand, GetCommand, PutCommand, QueryCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { LIMITS, type PostKind, type Role } from "../shared/protocol.ts";
import type { BoardStore, ConnectionRecord, LikeResult, PostRecord, RoomRecord, TopicRecord } from "./store.ts";

// テーブル 1 つに、PK / SK で種類を分けて置く
//   ROOM#<id>        META             ルーム
//   ROOM#<id>        TOPIC#<id>       トピック
//   ROOM#<id>        POST#<id>        投稿（トピックは属性に持つ。#252 の設計から変えた：どの操作も投稿 ID だけで引けるように）
//   ROOM#<id>        LIKE#<投稿>#<ブラウザ ID>  いいね（二重のいいねを防ぐ）
//   ROOM#<id>        CONN#<接続 ID>   ルームに入っている接続（変更を送る相手）
//   CONN#<接続 ID>   META             接続（IP・入っているルーム・ブラウザ ID）
//   RATE#<対象>#<時間枠の始まり>  -    レート制限のカウンター
const roomKey = (roomId: string) => ({ PK: `ROOM#${roomId}`, SK: "META" });
const topicKey = (roomId: string, topicId: string) => ({ PK: `ROOM#${roomId}`, SK: `TOPIC#${topicId}` });
const memberKey = (roomId: string, connectionId: string) => ({ PK: `ROOM#${roomId}`, SK: `CONN#${connectionId}` });
const connectionKey = (connectionId: string) => ({ PK: `CONN#${connectionId}`, SK: "META" });
const postKey = (roomId: string, postId: string) => ({ PK: `ROOM#${roomId}`, SK: `POST#${postId}` });
const likeKey = (roomId: string, postId: string, browserId: string) => ({ PK: `ROOM#${roomId}`, SK: `LIKE#${postId}#${browserId}` });

// トランザクションの何番目の条件で失敗したか（条件で失敗したものがなければ -1）
function failedCondition(error: unknown): number {
    if (!(error instanceof TransactionCanceledException)) {
        throw error;
    }
    const index = (error.CancellationReasons ?? []).findIndex((reason) => reason.Code === "ConditionalCheckFailed");
    if (index === -1) {
        throw error;
    }
    return index;
}

export function createDynamoStore(db: DynamoDBDocumentClient, tableName: string): BoardStore {
    async function getConnection(connectionId: string): Promise<ConnectionRecord | null> {
        const { Item } = await db.send(new GetCommand({ TableName: tableName, Key: connectionKey(connectionId) }));
        if (!Item) {
            return null;
        }
        return {
            ip: typeof Item.ip === "string" ? Item.ip : null,
            ...(typeof Item.roomId === "string" && { roomId: Item.roomId }),
            ...((Item.role === "participant" || Item.role === "admin") && { role: Item.role as Role }),
            ...(typeof Item.browserId === "string" && { browserId: Item.browserId }),
        };
    }

    // PK が同じで SK が prefix で始まる項目を、ページを分けてすべて読む
    async function queryAll(pk: string, prefix: string, consistent = false): Promise<Record<string, unknown>[]> {
        const items: Record<string, unknown>[] = [];
        let startKey: Record<string, unknown> | undefined;
        do {
            const result = await db.send(
                new QueryCommand({
                    TableName: tableName,
                    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
                    ExpressionAttributeValues: { ":pk": pk, ":prefix": prefix },
                    ExclusiveStartKey: startKey,
                    ConsistentRead: consistent,
                }),
            );
            items.push(...(result.Items ?? []));
            startKey = result.LastEvaluatedKey;
        } while (startKey);
        return items;
    }

    async function likesOf(roomId: string, postId: string): Promise<number | null> {
        const { Item } = await db.send(new GetCommand({ TableName: tableName, Key: postKey(roomId, postId), ConsistentRead: true }));
        return Item ? Number(Item.likes) : null;
    }

    // いいねの登録・削除と、投稿のいいねの数の増減を 1 つのトランザクションで行う
    async function changeLike(roomId: string, postId: string, browserId: string, delta: 1 | -1, expiresAt: number): Promise<LikeResult> {
        const like = likeKey(roomId, postId, browserId);
        try {
            await db.send(
                new TransactWriteCommand({
                    TransactItems: [
                        delta === 1
                            ? { Put: { TableName: tableName, Item: { ...like, expiresAt }, ConditionExpression: "attribute_not_exists(PK)" } }
                            : { Delete: { TableName: tableName, Key: like, ConditionExpression: "attribute_exists(PK)" } },
                        {
                            Update: {
                                TableName: tableName,
                                Key: postKey(roomId, postId),
                                UpdateExpression: "ADD likes :delta",
                                ConditionExpression: "attribute_exists(PK)",
                                ExpressionAttributeValues: { ":delta": delta },
                            },
                        },
                    ],
                }),
            );
        } catch (error) {
            // 1 番目（いいね）の条件で失敗：すでにいいね済み（いいねしていない）。2 番目：投稿がない
            const likes = failedCondition(error) === 0 ? await likesOf(roomId, postId) : null;
            return likes === null ? { status: "not_found" } : { status: "unchanged", likes };
        }
        const likes = await likesOf(roomId, postId);
        return likes === null ? { status: "not_found" } : { status: "changed", likes };
    }

    return {
        async createRoom(room, topics) {
            const { id, ...attributes } = room;
            await db.send(
                new TransactWriteCommand({
                    TransactItems: [
                        // 同じ ID のルームがあれば失敗させる（乱数なので起きないはずだが、上書きは避ける）
                        { Put: { TableName: tableName, Item: { ...roomKey(id), ...attributes }, ConditionExpression: "attribute_not_exists(PK)" } },
                        ...topics.map((topic) => ({
                            Put: {
                                TableName: tableName,
                                Item: { ...topicKey(id, topic.id), title: topic.title, order: topic.order, expiresAt: room.expiresAt },
                            },
                        })),
                    ],
                }),
            );
        },

        async getRoom(roomId) {
            const { Item } = await db.send(new GetCommand({ TableName: tableName, Key: roomKey(roomId) }));
            if (!Item) {
                return null;
            }
            const { PK: _pk, SK: _sk, ...attributes } = Item;
            // 投稿の数を持つ前に作ったルームは 0 として扱う
            return { id: roomId, postCount: 0, ...attributes } as RoomRecord;
        },

        async listTopics(roomId, expiresAt) {
            const topics: TopicRecord[] = [];
            for (const item of await queryAll(`ROOM#${roomId}`, "TOPIC#")) {
                // TTL の削除は遅れることがあるため、期限切れは読むときにも除く
                if (typeof item.expiresAt === "number" && item.expiresAt < expiresAt) {
                    continue;
                }
                topics.push({ id: String(item.SK).slice("TOPIC#".length), title: String(item.title), order: Number(item.order) });
            }
            return topics.sort((a, b) => a.order - b.order);
        },

        async putTopic(roomId, topic, expiresAt) {
            await db.send(
                new PutCommand({ TableName: tableName, Item: { ...topicKey(roomId, topic.id), title: topic.title, order: topic.order, expiresAt } }),
            );
        },

        async renameTopic(roomId, topicId, title) {
            try {
                await db.send(
                    new UpdateCommand({
                        TableName: tableName,
                        Key: topicKey(roomId, topicId),
                        UpdateExpression: "SET title = :title",
                        ConditionExpression: "attribute_exists(PK)",
                        ExpressionAttributeValues: { ":title": title },
                    }),
                );
            } catch (error) {
                if (error instanceof ConditionalCheckFailedException) {
                    return false;
                }
                throw error;
            }
            return true;
        },

        async setCurrentTopic(roomId, topicId) {
            await db.send(
                new UpdateCommand({
                    TableName: tableName,
                    Key: roomKey(roomId),
                    UpdateExpression: "SET currentTopicId = :topicId",
                    ConditionExpression: "attribute_exists(PK)",
                    ExpressionAttributeValues: { ":topicId": topicId },
                }),
            );
        },

        async updateRoom(roomId, fields) {
            const names = Object.keys(fields);
            if (names.length === 0) {
                return;
            }
            await db.send(
                new UpdateCommand({
                    TableName: tableName,
                    Key: roomKey(roomId),
                    UpdateExpression: `SET ${names.map((name) => `#${name} = :${name}`).join(", ")}`,
                    ConditionExpression: "attribute_exists(PK)",
                    ExpressionAttributeNames: Object.fromEntries(names.map((name) => [`#${name}`, name])),
                    ExpressionAttributeValues: Object.fromEntries(Object.entries(fields).map(([name, value]) => [`:${name}`, value])),
                }),
            );
        },

        async saveConnection(connectionId, connection, expiresAt) {
            await db.send(new PutCommand({ TableName: tableName, Item: { ...connectionKey(connectionId), ...connection, expiresAt } }));
        },

        getConnection,

        async joinRoom(connectionId, roomId, role, browserId, expiresAt) {
            const current = await getConnection(connectionId);
            await db.send(
                new TransactWriteCommand({
                    TransactItems: [
                        // 別のルームに入っていたら、そちらの接続一覧から抜ける
                        ...(current?.roomId && current.roomId !== roomId
                            ? [{ Delete: { TableName: tableName, Key: memberKey(current.roomId, connectionId) } }]
                            : []),
                        { Put: { TableName: tableName, Item: { ...memberKey(roomId, connectionId), role, expiresAt } } },
                        {
                            Update: {
                                TableName: tableName,
                                Key: connectionKey(connectionId),
                                UpdateExpression: "SET roomId = :roomId, #role = :role, browserId = :browserId",
                                ExpressionAttributeNames: { "#role": "role" },
                                ExpressionAttributeValues: { ":roomId": roomId, ":role": role, ":browserId": browserId },
                            },
                        },
                    ],
                }),
            );
        },

        async listMembers(roomId, now) {
            return (await queryAll(`ROOM#${roomId}`, "CONN#"))
                .filter((item) => !(typeof item.expiresAt === "number" && item.expiresAt < now))
                .map((item) => ({ connectionId: String(item.SK).slice("CONN#".length), role: item.role as Role }));
        },

        async setRole(connectionId, roomId, role) {
            await db.send(
                new TransactWriteCommand({
                    TransactItems: [
                        {
                            Update: {
                                TableName: tableName,
                                Key: memberKey(roomId, connectionId),
                                UpdateExpression: "SET #role = :role",
                                ConditionExpression: "attribute_exists(PK)",
                                ExpressionAttributeNames: { "#role": "role" },
                                ExpressionAttributeValues: { ":role": role },
                            },
                        },
                        {
                            Update: {
                                TableName: tableName,
                                Key: connectionKey(connectionId),
                                UpdateExpression: "SET #role = :role",
                                // 同じルームに入っている間だけ（別のルームに入り直していたら変えない）
                                ConditionExpression: "roomId = :roomId",
                                ExpressionAttributeNames: { "#role": "role" },
                                ExpressionAttributeValues: { ":role": role, ":roomId": roomId },
                            },
                        },
                    ],
                }),
            );
        },

        async deleteConnection(connectionId) {
            const current = await getConnection(connectionId);
            if (current?.roomId) {
                await db.send(new DeleteCommand({ TableName: tableName, Key: memberKey(current.roomId, connectionId) }));
            }
            await db.send(new DeleteCommand({ TableName: tableName, Key: connectionKey(connectionId) }));
        },

        async addPost(roomId, post, expiresAt) {
            const { id, ...attributes } = post;
            try {
                await db.send(
                    new TransactWriteCommand({
                        TransactItems: [
                            {
                                Update: {
                                    TableName: tableName,
                                    Key: roomKey(roomId),
                                    UpdateExpression: "ADD postCount :one",
                                    // 投稿の数を持つ前に作ったルームは、まだ postCount がない
                                    ConditionExpression: "accepting = :true AND (attribute_not_exists(postCount) OR postCount < :max)",
                                    ExpressionAttributeValues: { ":one": 1, ":true": true, ":max": LIMITS.posts },
                                },
                            },
                            { Put: { TableName: tableName, Item: { ...postKey(roomId, id), ...attributes, expiresAt } } },
                        ],
                    }),
                );
            } catch (error) {
                failedCondition(error);
                // どちらの条件で断られたかは、ルームを読み直して確かめる
                const { Item } = await db.send(new GetCommand({ TableName: tableName, Key: roomKey(roomId), ConsistentRead: true }));
                return Item?.accepting === true ? "too_many_posts" : "not_accepting";
            }
            return "added";
        },

        async listPosts(roomId) {
            return (await queryAll(`ROOM#${roomId}`, "POST#")).map((item) => ({
                id: String(item.SK).slice("POST#".length),
                topicId: String(item.topicId),
                kind: item.kind as PostKind,
                body: String(item.body),
                nickname: typeof item.nickname === "string" ? item.nickname : null,
                likes: Number(item.likes ?? 0),
                pinned: item.pinned === true,
                deleteKeyHash: String(item.deleteKeyHash),
                createdAt: Number(item.createdAt),
            }));
        },

        async deletePost(roomId, postId, deleteKeyHash) {
            try {
                await db.send(
                    new TransactWriteCommand({
                        TransactItems: [
                            {
                                Delete: {
                                    TableName: tableName,
                                    Key: postKey(roomId, postId),
                                    ...(deleteKeyHash === null
                                        ? { ConditionExpression: "attribute_exists(PK)" }
                                        : { ConditionExpression: "deleteKeyHash = :hash", ExpressionAttributeValues: { ":hash": deleteKeyHash } }),
                                },
                            },
                            {
                                Update: {
                                    TableName: tableName,
                                    Key: roomKey(roomId),
                                    UpdateExpression: "ADD postCount :minusOne",
                                    ConditionExpression: "attribute_exists(PK)",
                                    ExpressionAttributeValues: { ":minusOne": -1 },
                                },
                            },
                        ],
                    }),
                );
            } catch (error) {
                failedCondition(error);
                return false;
            }
            return true;
        },

        async setPinned(roomId, postId, pinned) {
            try {
                await db.send(
                    new UpdateCommand({
                        TableName: tableName,
                        Key: postKey(roomId, postId),
                        UpdateExpression: "SET pinned = :pinned",
                        ConditionExpression: "attribute_exists(PK)",
                        ExpressionAttributeValues: { ":pinned": pinned },
                    }),
                );
            } catch (error) {
                if (error instanceof ConditionalCheckFailedException) {
                    return false;
                }
                throw error;
            }
            return true;
        },

        like(roomId, postId, browserId, expiresAt) {
            return changeLike(roomId, postId, browserId, 1, expiresAt);
        },

        unlike(roomId, postId, browserId) {
            return changeLike(roomId, postId, browserId, -1, 0);
        },

        async consume(key, windowStart, windowSeconds, limit) {
            try {
                await db.send(
                    new UpdateCommand({
                        TableName: tableName,
                        Key: { PK: `RATE#${key}#${windowStart}`, SK: "-" },
                        UpdateExpression: "ADD #count :one SET expiresAt = :expiresAt",
                        ConditionExpression: "attribute_not_exists(#count) OR #count < :limit",
                        ExpressionAttributeNames: { "#count": "count" },
                        ExpressionAttributeValues: { ":one": 1, ":limit": limit, ":expiresAt": windowStart + windowSeconds + 60 },
                    }),
                );
            } catch (error) {
                if (error instanceof ConditionalCheckFailedException) {
                    return false;
                }
                throw error;
            }
            return true;
        },
    };
}
