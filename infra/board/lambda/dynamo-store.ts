import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DeleteCommand, GetCommand, PutCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import type { Role } from "../shared/protocol.ts";
import type { BoardStore, ConnectionRecord, RoomRecord, TopicRecord } from "./store.ts";

// テーブル 1 つに、PK / SK で種類を分けて置く
//   ROOM#<id>        META             ルーム
//   ROOM#<id>        TOPIC#<id>       トピック
//   ROOM#<id>        CONN#<接続 ID>   ルームに入っている接続（変更を送る相手）
//   CONN#<接続 ID>   META             接続（IP・入っているルーム）
const roomKey = (roomId: string) => ({ PK: `ROOM#${roomId}`, SK: "META" });
const topicKey = (roomId: string, topicId: string) => ({ PK: `ROOM#${roomId}`, SK: `TOPIC#${topicId}` });
const memberKey = (roomId: string, connectionId: string) => ({ PK: `ROOM#${roomId}`, SK: `CONN#${connectionId}` });
const connectionKey = (connectionId: string) => ({ PK: `CONN#${connectionId}`, SK: "META" });

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
        };
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
            return { id: roomId, ...attributes } as RoomRecord;
        },

        async listTopics(roomId, expiresAt) {
            const topics: TopicRecord[] = [];
            let startKey: Record<string, unknown> | undefined;
            do {
                const result = await db.send(
                    new QueryCommand({
                        TableName: tableName,
                        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
                        ExpressionAttributeValues: { ":pk": `ROOM#${roomId}`, ":prefix": "TOPIC#" },
                        ExclusiveStartKey: startKey,
                    }),
                );
                for (const item of result.Items ?? []) {
                    // TTL の削除は遅れることがあるため、期限切れは読むときにも除く
                    if (typeof item.expiresAt === "number" && item.expiresAt < expiresAt) {
                        continue;
                    }
                    topics.push({ id: String(item.SK).slice("TOPIC#".length), title: String(item.title), order: Number(item.order) });
                }
                startKey = result.LastEvaluatedKey;
            } while (startKey);
            return topics.sort((a, b) => a.order - b.order);
        },

        async saveConnection(connectionId, connection, expiresAt) {
            await db.send(new PutCommand({ TableName: tableName, Item: { ...connectionKey(connectionId), ...connection, expiresAt } }));
        },

        getConnection,

        async joinRoom(connectionId, roomId, role, expiresAt) {
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
                                UpdateExpression: "SET roomId = :roomId, #role = :role",
                                ExpressionAttributeNames: { "#role": "role" },
                                ExpressionAttributeValues: { ":roomId": roomId, ":role": role },
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
    };
}
