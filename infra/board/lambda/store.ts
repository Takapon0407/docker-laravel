import type { NameMode, Retention, Role } from "../shared/protocol.ts";

// DynamoDB に置くデータ（キーの形は dynamo-store.ts と Issue #252 を参照）
// 時刻は、expiresAt（TTL に使う）だけ UNIX 秒、ほかは UNIX ミリ秒

export interface RoomRecord {
    id: string;
    title: string;
    nameMode: NameMode;
    retention: Retention;
    accepting: boolean;
    currentTopicId: string;
    // 参加用の鍵は主催者に返すため平文で持つ（漏れても「URL を知っている人」と同じ権限）
    joinKey: string;
    // 管理用の鍵はハッシュ（SHA-256）だけを持つ
    adminKeyHash: string;
    createdAt: number;
    expiresAt: number;
}

export interface TopicRecord {
    id: string;
    title: string;
    order: number;
}

export interface ConnectionRecord {
    ip: string | null;
    // 参加しているルーム（join する前は未設定）
    roomId?: string;
    role?: Role;
}

export interface BoardStore {
    // ルームと最初のトピックをまとめて作る
    createRoom(room: RoomRecord, topics: TopicRecord[]): Promise<void>;
    getRoom(roomId: string): Promise<RoomRecord | null>;
    listTopics(roomId: string, expiresAt: number): Promise<TopicRecord[]>;

    saveConnection(connectionId: string, connection: ConnectionRecord, expiresAt: number): Promise<void>;
    getConnection(connectionId: string): Promise<ConnectionRecord | null>;
    // 接続をルームに入れる（ほかのルームに入っていたら、そちらからは抜ける）
    joinRoom(connectionId: string, roomId: string, role: Role, expiresAt: number): Promise<void>;
    // 接続の情報と、ルームの接続一覧からの登録を消す
    deleteConnection(connectionId: string): Promise<void>;
}
