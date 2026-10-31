import { BoardClient, BoardRequestError, type Status } from "@/lib/board-client";
import { browserStorage, buildRoomUrl, forgetAdminKey, loadAdminKey, parseRoomHash, saveAdminKey, websocketUrl } from "@/lib/board-link";
import type { RoomView, ServerMessage, TopicView } from "../../../../../../infra/board/shared/protocol.ts";
import { showPopupNotification } from "../../util/notification";

type Joined = Extract<ServerMessage, { type: "joined" }>;

const dateFormat = new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

function element<T extends HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
}

document.addEventListener("DOMContentLoaded", () => {
    const statusEl = element<HTMLParagraphElement>("board-status");
    const roomEl = element<HTMLDivElement>("board-room");
    const errorSection = element<HTMLElement>("board-room-error");
    const errorMessage = element<HTMLParagraphElement>("board-room-error-message");

    const link = parseRoomHash(window.location.hash);
    if (!link) {
        showError("URL が正しくありません。共有された URL をもう一度開いてください。");
        return;
    }

    const storage = browserStorage();
    const configured = document.querySelector<HTMLMetaElement>('meta[name="board-websocket-url"]')?.content;
    let joinedOnce = false;

    const client = new BoardClient({
        url: websocketUrl(configured, window.location),
        // 再接続したときも入り直して、最新の状態を取り直す
        onOpen: () => void join(),
        onStatus: showStatus,
    });
    client.connect();

    async function join(): Promise<void> {
        // このブラウザに主催者の鍵が残っていれば、共有用 URL から開いても主催者として入る
        const stored = loadAdminKey(storage, link!.roomId);
        try {
            let joined = await request(stored ?? link!.key);
            if (stored && joined === null) {
                // 主催者用の URL が作り直されて、残っていた鍵が使えなくなった
                forgetAdminKey(storage, link!.roomId);
                joined = await request(link!.key);
            }
            if (joined === null) {
                showError("ルームが見つかりません。URL が正しいか、保存期間が過ぎていないか確認してください。");
                client.close();
                return;
            }
            render(joined, joined.role === "admin" ? (stored ?? link!.key) : null);
        } catch (error) {
            // 接続が切れたなどの一時的なエラーは、再接続したときに入り直す
            if (!joinedOnce) {
                statusEl.textContent = error instanceof BoardRequestError ? error.message : "ルームに入れませんでした。";
            }
        }
    }

    // ルームが見つからない・鍵が違うときは null
    async function request(key: string): Promise<Joined | null> {
        try {
            const message = await client.request({ action: "join", roomId: link!.roomId, key });
            return message.type === "joined" ? message : null;
        } catch (error) {
            if (error instanceof BoardRequestError && error.code === "room_not_found") {
                return null;
            }
            throw error;
        }
    }

    function render(joined: Joined, usedAdminKey: string | null): void {
        joinedOnce = true;
        statusEl.hidden = true;
        errorSection.hidden = true;
        roomEl.hidden = false;
        renderRoom(joined.room);
        renderTopics(joined.topics, joined.room.currentTopicId);

        const isAdmin = joined.role === "admin" && usedAdminKey !== null && joined.joinKey !== undefined;
        element<HTMLElement>("board-role-badge").hidden = !isAdmin;
        element<HTMLElement>("board-admin").hidden = !isAdmin;
        if (isAdmin) {
            const adminKey = usedAdminKey;
            saveAdminKey(storage, joined.room.id, adminKey);
            const shareUrl = buildRoomUrl(window.location.origin, { roomId: joined.room.id, key: joined.joinKey! });
            element<HTMLInputElement>("board-share-url").value = shareUrl;
            element<HTMLInputElement>("board-admin-url").value = buildRoomUrl(window.location.origin, { roomId: joined.room.id, key: adminKey });
            // 主催者の鍵をこのブラウザに残せたら、アドレスバーは共有用 URL にする（そのまま共有しても安全なように）
            if (loadAdminKey(storage, joined.room.id) === adminKey) {
                history.replaceState(null, "", shareUrl);
            }
        }
    }

    function renderRoom(room: RoomView): void {
        document.title = `${room.title} | 匿名質問ボード`;
        element<HTMLElement>("board-room-title").textContent = room.title;
        element<HTMLElement>("board-room-expires").textContent = `${dateFormat.format(room.expiresAt)} まで（過ぎると自動で削除されます）`;
    }

    function renderTopics(topics: TopicView[], currentTopicId: string): void {
        element<HTMLUListElement>("board-topic-tabs").replaceChildren(
            ...topics.map((topic) => {
                const li = document.createElement("li");
                li.className = "nav-item";
                const button = document.createElement("button");
                button.type = "button";
                button.className = "nav-link";
                const isCurrent = topic.id === currentTopicId;
                button.classList.toggle("active", isCurrent);
                button.textContent = topic.title;
                if (isCurrent) {
                    button.setAttribute("aria-current", "true");
                }
                li.append(button);
                return li;
            }),
        );
    }

    function showStatus(status: Status): void {
        statusEl.hidden = status === "open" && joinedOnce;
        if (status === "connecting") {
            statusEl.textContent = joinedOnce ? "再接続しています…" : "接続しています…";
        } else if (status === "closed" && joinedOnce) {
            statusEl.textContent = "接続が切れました。再接続しています…";
        }
    }

    function showError(message: string): void {
        statusEl.hidden = true;
        roomEl.hidden = true;
        errorSection.hidden = false;
        errorMessage.textContent = message;
    }

    document.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((button) => {
        button.addEventListener("click", () => {
            const input = element<HTMLInputElement>(button.dataset.copy!);
            navigator.clipboard.writeText(input.value).then(
                () => showPopupNotification("コピーしました"),
                () => showPopupNotification("コピーできませんでした"),
            );
        });
    });
});
