import type { NameMode, PostKind, Retention, Role } from "../shared/protocol.ts";

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
    // 投稿の数（上限を確かめるため。取り消し・削除で減らす）
    postCount: number;
}

export interface TopicRecord {
    id: string;
    title: string;
    order: number;
}

export interface PostRecord {
    id: string;
    topicId: string;
    kind: PostKind;
    body: string;
    nickname: string | null;
    likes: number;
    pinned: boolean;
    // 取り消し用の鍵のハッシュ（SHA-256）
    deleteKeyHash: string;
    createdAt: number;
}

export interface ConnectionRecord {
    ip: string | null;
    // 参加しているルームと、いいねに使うブラウザ ID（join する前は未設定）
    roomId?: string;
    role?: Role;
    browserId?: string;
}

// 変更を送る相手
export interface MemberRecord {
    connectionId: string;
    role: Role;
}

// いいね・取り消しの結果
//   changed: いいねの数が変わった / unchanged: すでにいいね済み（いいねしていない） / not_found: 投稿がない
export type LikeResult = { status: "changed"; likes: number } | { status: "unchanged"; likes: number } | { status: "not_found" };

export interface BoardStore {
    // ルームと最初のトピックをまとめて作る
    createRoom(room: RoomRecord, topics: TopicRecord[]): Promise<void>;
    getRoom(roomId: string): Promise<RoomRecord | null>;
    listTopics(roomId: string, expiresAt: number): Promise<TopicRecord[]>;
    putTopic(roomId: string, topic: TopicRecord, expiresAt: number): Promise<void>;
    // トピックがあるときだけ名前を変える。変えられたら true
    renameTopic(roomId: string, topicId: string, title: string): Promise<boolean>;
    setCurrentTopic(roomId: string, topicId: string): Promise<void>;
    // 受付中か・鍵を変える
    updateRoom(roomId: string, fields: Partial<Pick<RoomRecord, "accepting" | "joinKey" | "adminKeyHash">>): Promise<void>;

    saveConnection(connectionId: string, connection: ConnectionRecord, expiresAt: number): Promise<void>;
    getConnection(connectionId: string): Promise<ConnectionRecord | null>;
    // 接続をルームに入れる（ほかのルームに入っていたら、そちらからは抜ける）
    joinRoom(connectionId: string, roomId: string, role: Role, browserId: string, expiresAt: number): Promise<void>;
    listMembers(roomId: string, now: number): Promise<MemberRecord[]>;
    // 主催者用 URL を作り直したとき、ほかの主催者を参加者にする
    setRole(connectionId: string, roomId: string, role: Role): Promise<void>;
    // 接続の情報と、ルームの接続一覧からの登録を消す
    deleteConnection(connectionId: string): Promise<void>;

    // 受付中で、投稿が上限より少ないときだけ追加する（ルームの投稿の数も増やす）
    addPost(roomId: string, post: PostRecord, expiresAt: number): Promise<"added" | "not_accepting" | "too_many_posts">;
    listPosts(roomId: string): Promise<PostRecord[]>;
    // 取り消し用の鍵のハッシュが合うときだけ消す（null なら確かめない＝主催者の削除）。ルームの投稿の数も減らす。消せたら true
    deletePost(roomId: string, postId: string, deleteKeyHash: string | null): Promise<boolean>;
    // 投稿があるときだけ変える。変えられたら true
    setPinned(roomId: string, postId: string, pinned: boolean): Promise<boolean>;
    like(roomId: string, postId: string, browserId: string, expiresAt: number): Promise<LikeResult>;
    unlike(roomId: string, postId: string, browserId: string): Promise<LikeResult>;
}
