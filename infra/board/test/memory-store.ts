import type { Role } from "../shared/protocol.ts";
import type { BoardStore, ConnectionRecord, RoomRecord, TopicRecord } from "../lambda/store.ts";

// テスト用に、DynamoDB の代わりにメモリに置く
export function createMemoryStore() {
    const rooms = new Map<string, RoomRecord>();
    const topics = new Map<string, TopicRecord[]>();
    const connections = new Map<string, ConnectionRecord & { expiresAt: number }>();
    const members = new Map<string, Map<string, { role: Role; expiresAt: number }>>();

    const store: BoardStore = {
        async createRoom(room, roomTopics) {
            if (rooms.has(room.id)) {
                throw new Error("conditional check failed");
            }
            rooms.set(room.id, { ...room });
            topics.set(room.id, roomTopics.map((t) => ({ ...t })));
        },
        async getRoom(roomId) {
            const room = rooms.get(roomId);
            return room ? { ...room } : null;
        },
        async listTopics(roomId) {
            return [...(topics.get(roomId) ?? [])].sort((a, b) => a.order - b.order);
        },
        async saveConnection(connectionId, connection, expiresAt) {
            connections.set(connectionId, { ...connection, expiresAt });
        },
        async getConnection(connectionId) {
            const c = connections.get(connectionId);
            if (!c) {
                return null;
            }
            const { expiresAt: _expiresAt, ...record } = c;
            return record;
        },
        async joinRoom(connectionId, roomId, role, expiresAt) {
            const current = connections.get(connectionId);
            if (current?.roomId && current.roomId !== roomId) {
                members.get(current.roomId)?.delete(connectionId);
            }
            if (!members.has(roomId)) {
                members.set(roomId, new Map());
            }
            members.get(roomId)!.set(connectionId, { role, expiresAt });
            connections.set(connectionId, { ip: current?.ip ?? null, expiresAt: current?.expiresAt ?? 0, roomId, role });
        },
        async deleteConnection(connectionId) {
            const current = connections.get(connectionId);
            if (current?.roomId) {
                members.get(current.roomId)?.delete(connectionId);
            }
            connections.delete(connectionId);
        },
    };
    return { store, rooms, topics, connections, members };
}
