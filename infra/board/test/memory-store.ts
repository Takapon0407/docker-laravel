import type { Role } from "../shared/protocol.ts";
import { LIMITS } from "../shared/protocol.ts";
import type { BoardStore, ConnectionRecord, PostRecord, RoomRecord, TopicRecord } from "../lambda/store.ts";

// テスト用に、DynamoDB の代わりにメモリに置く
export function createMemoryStore() {
    const rooms = new Map<string, RoomRecord>();
    const topics = new Map<string, TopicRecord[]>();
    const connections = new Map<string, ConnectionRecord & { expiresAt: number }>();
    const members = new Map<string, Map<string, { role: Role; adminKeyHash?: string; expiresAt: number }>>();
    const posts = new Map<string, Map<string, PostRecord & { expiresAt: number }>>();
    // 「ルーム ID 投稿 ID ブラウザ ID」
    const likes = new Set<string>();
    const rates = new Map<string, number>();

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
        async putTopic(roomId, topic) {
            topics.get(roomId)!.push({ ...topic });
        },
        async renameTopic(roomId, topicId, title) {
            const topic = topics.get(roomId)?.find((t) => t.id === topicId);
            if (!topic) {
                return false;
            }
            topic.title = title;
            return true;
        },
        async setCurrentTopic(roomId, topicId) {
            rooms.get(roomId)!.currentTopicId = topicId;
        },
        async updateRoom(roomId, fields) {
            Object.assign(rooms.get(roomId)!, fields);
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
        async joinRoom(connectionId, roomId, role, adminKeyHash, browserId, expiresAt) {
            const current = connections.get(connectionId);
            if (current?.roomId && current.roomId !== roomId) {
                members.get(current.roomId)?.delete(connectionId);
            }
            if (!members.has(roomId)) {
                members.set(roomId, new Map());
            }
            const keyHash = adminKeyHash === null ? {} : { adminKeyHash };
            members.get(roomId)!.set(connectionId, { role, ...keyHash, expiresAt });
            connections.set(connectionId, { ip: current?.ip ?? null, expiresAt: current?.expiresAt ?? 0, roomId, role, ...keyHash, browserId });
        },
        async listMembers(roomId, now) {
            return [...(members.get(roomId) ?? [])]
                .filter(([, m]) => m.expiresAt >= now)
                .map(([connectionId, { expiresAt: _expiresAt, ...m }]) => ({ connectionId, ...m }));
        },
        async rotateAdminKey(roomId, connectionId, adminKeyHash) {
            const member = members.get(roomId)?.get(connectionId);
            const connection = connections.get(connectionId);
            if (!member || connection?.roomId !== roomId) {
                throw new Error("conditional check failed");
            }
            rooms.get(roomId)!.adminKeyHash = adminKeyHash;
            member.adminKeyHash = adminKeyHash;
            connection.adminKeyHash = adminKeyHash;
        },
        async demote(connectionId, roomId) {
            const member = members.get(roomId)?.get(connectionId);
            const connection = connections.get(connectionId);
            if (member && connection?.roomId === roomId) {
                member.role = "participant";
                connection.role = "participant";
                delete member.adminKeyHash;
                delete connection.adminKeyHash;
            }
        },
        async deleteConnection(connectionId) {
            const current = connections.get(connectionId);
            if (current?.roomId) {
                members.get(current.roomId)?.delete(connectionId);
            }
            connections.delete(connectionId);
        },
        async addPost(roomId, post, expiresAt) {
            const room = rooms.get(roomId)!;
            if (!room.accepting) {
                return "not_accepting";
            }
            if (room.postCount >= LIMITS.posts) {
                return "too_many_posts";
            }
            room.postCount++;
            if (!posts.has(roomId)) {
                posts.set(roomId, new Map());
            }
            posts.get(roomId)!.set(post.id, { ...post, expiresAt });
            return "added";
        },
        async listPosts(roomId) {
            return [...(posts.get(roomId)?.values() ?? [])].map(({ expiresAt: _expiresAt, ...post }) => ({ ...post }));
        },
        async deletePost(roomId, postId, deleteKeyHash) {
            const post = posts.get(roomId)?.get(postId);
            if (!post || (deleteKeyHash !== null && post.deleteKeyHash !== deleteKeyHash)) {
                return false;
            }
            posts.get(roomId)!.delete(postId);
            rooms.get(roomId)!.postCount--;
            return true;
        },
        async setPinned(roomId, postId, pinned) {
            const post = posts.get(roomId)?.get(postId);
            if (!post) {
                return false;
            }
            post.pinned = pinned;
            return true;
        },
        async consume(key, windowStart, _windowSeconds, limit) {
            const name = `${key}#${windowStart}`;
            const count = rates.get(name) ?? 0;
            if (count >= limit) {
                return false;
            }
            rates.set(name, count + 1);
            return true;
        },
        async like(roomId, postId, browserId) {
            const post = posts.get(roomId)?.get(postId);
            if (!post) {
                return { status: "not_found" };
            }
            const key = `${roomId} ${postId} ${browserId}`;
            if (likes.has(key)) {
                return { status: "unchanged", likes: post.likes };
            }
            likes.add(key);
            post.likes++;
            return { status: "changed", likes: post.likes };
        },
        async unlike(roomId, postId, browserId) {
            const post = posts.get(roomId)?.get(postId);
            if (!post) {
                return { status: "not_found" };
            }
            if (!likes.delete(`${roomId} ${postId} ${browserId}`)) {
                return { status: "unchanged", likes: post.likes };
            }
            post.likes--;
            return { status: "changed", likes: post.likes };
        },
    };
    return { store, rooms, topics, connections, members, posts };
}
