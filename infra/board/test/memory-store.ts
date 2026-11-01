import type { Role } from "../shared/protocol.ts";
import { LIMITS } from "../shared/protocol.ts";
import type { BoardStore, ConnectionRecord, PostRecord, RoomRecord, TopicRecord } from "../lambda/store.ts";

// テスト用に、DynamoDB の代わりにメモリに置く
export function createMemoryStore() {
    const rooms = new Map<string, RoomRecord>();
    const topics = new Map<string, TopicRecord[]>();
    const connections = new Map<string, ConnectionRecord & { expiresAt: number }>();
    const members = new Map<string, Map<string, { role: Role; expiresAt: number }>>();
    const posts = new Map<string, Map<string, PostRecord & { expiresAt: number }>>();
    // 「ルーム ID 投稿 ID ブラウザ ID」
    const likes = new Set<string>();

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
        async joinRoom(connectionId, roomId, role, browserId, expiresAt) {
            const current = connections.get(connectionId);
            if (current?.roomId && current.roomId !== roomId) {
                members.get(current.roomId)?.delete(connectionId);
            }
            if (!members.has(roomId)) {
                members.set(roomId, new Map());
            }
            members.get(roomId)!.set(connectionId, { role, expiresAt });
            connections.set(connectionId, { ip: current?.ip ?? null, expiresAt: current?.expiresAt ?? 0, roomId, role, browserId });
        },
        async listMembers(roomId, now) {
            return [...(members.get(roomId) ?? [])].filter(([, m]) => m.expiresAt >= now).map(([connectionId, m]) => ({ connectionId, role: m.role }));
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
            if (!post || post.deleteKeyHash !== deleteKeyHash) {
                return false;
            }
            posts.get(roomId)!.delete(postId);
            rooms.get(roomId)!.postCount--;
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
