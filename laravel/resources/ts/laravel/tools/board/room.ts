import { BoardClient, BoardRequestError, type Status } from "@/lib/board-client";
import { browserStorage, buildRoomUrl, forgetAdminKey, loadAdminKey, parseRoomHash, saveAdminKey, websocketUrl } from "@/lib/board-link";
import {
    loadBrowserId,
    loadDeleteKeys,
    loadLikes,
    loadNickname,
    saveDeleteKeys,
    saveLikes,
    saveNickname,
    sortPosts,
    type SortOrder,
} from "@/lib/board-posts";
import { length, LIMITS, type PostKind, type PostView, type RoomView, type ServerMessage, type TopicView } from "../../../../../../infra/board/shared/protocol.ts";
import { showPopupNotification } from "../../util/notification";

type Joined = Extract<ServerMessage, { type: "joined" }>;

const dateFormat = new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
const timeFormat = new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" });
const KIND_LABELS: Record<PostKind, string> = { question: "質問", comment: "コメント" };

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
    const browserId = loadBrowserId(storage);
    const deleteKeys = loadDeleteKeys(storage, link.roomId);
    const likes = loadLikes(storage, link.roomId);
    const configured = document.querySelector<HTMLMetaElement>('meta[name="board-websocket-url"]')?.content;
    let joinedOnce = false;
    // 入るときに使う URL の鍵（URL を作り直したら、アドレスバーと一緒に変える）
    let linkKey = link.key;

    // ルームの状態（join のたびに取り直し、ほかの人の操作の通知で更新する）
    let room: RoomView | null = null;
    let topics: TopicView[] = [];
    const posts = new Map<string, PostView>();
    // 見ているトピック（最初は今のトピック）
    let viewingTopicId: string | null = null;
    let sortOrder: SortOrder = "new";
    let isAdmin = false;
    // 主催者の画面に出す URL の鍵
    let joinKey: string | null = null;
    let adminKey: string | null = null;
    // いいね・取り消しの返事を待っている投稿（二重に押せないようにする）
    const busy = new Set<string>();

    const client = new BoardClient({
        url: websocketUrl(configured, window.location),
        // 再接続したときも入り直して、最新の状態を取り直す
        onOpen: () => void join(),
        onPush: receive,
        onStatus: showStatus,
    });
    client.connect();

    async function join(): Promise<void> {
        // このブラウザに主催者の鍵が残っていれば、共有用 URL から開いても主催者として入る
        const stored = loadAdminKey(storage, link!.roomId);
        try {
            // 入れた鍵（主催者のとき、ブラウザに残して主催者用 URL に使う）
            let key = stored ?? linkKey;
            let joined = await request(key);
            if (stored && joined === null) {
                // 主催者用の URL が作り直されて、残っていた鍵が使えなくなった
                forgetAdminKey(storage, link!.roomId);
                key = linkKey;
                joined = await request(key);
            }
            if (joined === null) {
                showError("ルームが見つかりません。URL が正しいか、保存期間が過ぎていないか確認してください。");
                client.close();
                return;
            }
            render(joined, joined.role === "admin" ? key : null);
        } catch (error) {
            if (error instanceof BoardRequestError && error.code === "room_full") {
                showError(error.message);
                client.close();
                return;
            }
            // 接続が切れたなどの一時的なエラーは、再接続したときに入り直す
            if (!joinedOnce) {
                statusEl.textContent = error instanceof BoardRequestError ? error.message : "ルームに入れませんでした。";
            }
        }
    }

    // ルームが見つからない・鍵が違うときは null
    async function request(key: string): Promise<Joined | null> {
        try {
            const message = await client.request({ action: "join", roomId: link!.roomId, key, browserId });
            return message.type === "joined" ? message : null;
        } catch (error) {
            if (error instanceof BoardRequestError && error.code === "room_not_found") {
                return null;
            }
            throw error;
        }
    }

    // ほかの人の操作の通知（投稿は join の返事のあとに分けて届く）
    function receive(message: ServerMessage): void {
        switch (message.type) {
            case "posts":
                message.posts.forEach((post) => posts.set(post.id, post));
                break;
            case "postAdded":
                posts.set(message.post.id, message.post);
                break;
            case "postDeleted":
                posts.delete(message.postId);
                forgetPost(message.postId);
                break;
            case "postLiked": {
                const post = posts.get(message.postId);
                if (post) {
                    posts.set(post.id, { ...post, likes: message.likes });
                }
                break;
            }
            case "topicsUpdated":
                updateTopics(message.topics, message.currentTopicId);
                break;
            case "postPinned": {
                const post = posts.get(message.postId);
                if (post) {
                    posts.set(post.id, { ...post, pinned: message.pinned });
                }
                break;
            }
            case "acceptingChanged":
                if (room) {
                    room = { ...room, accepting: message.accepting };
                    showPopupNotification(message.accepting ? "投稿の受付が再開されました" : "投稿の受付が締め切られました");
                    renderCompose();
                    renderAdminControls();
                }
                break;
            case "joinKeyChanged":
                joinKey = message.joinKey;
                showAdminUrls();
                showPopupNotification("ほかの主催者が共有用 URL を作り直しました");
                break;
            case "roleChanged":
                if (message.role === "participant") {
                    // ほかの主催者が主催者用 URL を作り直した。残っていた鍵はもう使えない
                    // （同じブラウザの別のタブで作り直したときは、新しい鍵が残っているので消さない）
                    if (loadAdminKey(storage, link!.roomId) === adminKey) {
                        forgetAdminKey(storage, link!.roomId);
                    }
                    // 再接続したときに古い主催者の鍵で入ろうとしないよう、アドレスバーは共有用 URL にする
                    if (joinKey !== null) {
                        linkKey = joinKey;
                        history.replaceState(null, "", buildRoomUrl(window.location.origin, { roomId: link!.roomId, key: joinKey }));
                    }
                    setAdmin(false);
                    showPopupNotification("主催者用 URL が作り直されたため、参加者として表示しています");
                }
                break;
            default:
                return;
        }
        scheduleRenderPosts();
    }

    // 主催者がトピックを足した・名前を変えた・切り替えた
    function updateTopics(next: TopicView[], currentTopicId: string): void {
        if (!room) {
            return;
        }
        const switched = currentTopicId !== room.currentTopicId;
        topics = next;
        room = { ...room, currentTopicId };
        if (switched) {
            // 全員の画面を今のトピックに移す
            viewingTopicId = currentTopicId;
            const title = topics.find((topic) => topic.id === currentTopicId)?.title;
            if (title !== undefined) {
                showPopupNotification(`トピックが「${title}」に切り替わりました`);
            }
        }
        renderCompose();
        renderTopicAdmin();
    }

    function render(joined: Joined, usedAdminKey: string | null): void {
        joinedOnce = true;
        statusEl.hidden = true;
        errorSection.hidden = true;
        roomEl.hidden = false;
        // 切断している間にトピックが切り替わっていたら、今のトピックに移す
        const switched = room !== null && room.currentTopicId !== joined.room.currentTopicId;
        room = joined.room;
        topics = joined.topics;
        // 入り直したときは、このあと届く投稿で置き換える
        posts.clear();
        if (switched || !topics.some((topic) => topic.id === viewingTopicId)) {
            viewingTopicId = room.currentTopicId;
        }
        renderRoom(joined.room);
        renderCompose();
        if (joined.role === "admin" && usedAdminKey !== null && joined.joinKey !== undefined) {
            joinKey = joined.joinKey;
            adminKey = usedAdminKey;
            saveAdminKey(storage, joined.room.id, adminKey);
            setAdmin(true);
        } else {
            setAdmin(false);
        }
        scheduleRenderPosts();
    }

    function setAdmin(value: boolean): void {
        isAdmin = value;
        element<HTMLElement>("board-role-badge").hidden = !isAdmin;
        element<HTMLElement>("board-admin").hidden = !isAdmin;
        element<HTMLElement>("board-topic-admin").hidden = !isAdmin;
        if (isAdmin) {
            showAdminUrls();
            renderAdminControls();
            renderTopicAdmin();
        }
        // 投稿ごとの主催者のボタンを出し入れする
        scheduleRenderPosts();
    }

    function showAdminUrls(): void {
        if (!isAdmin || joinKey === null || adminKey === null) {
            return;
        }
        const shareUrl = buildRoomUrl(window.location.origin, { roomId: link!.roomId, key: joinKey });
        element<HTMLInputElement>("board-share-url").value = shareUrl;
        element<HTMLInputElement>("board-admin-url").value = buildRoomUrl(window.location.origin, { roomId: link!.roomId, key: adminKey });
        // 主催者の鍵をこのブラウザに残せたら、アドレスバーは共有用 URL にする（そのまま共有しても安全なように）
        // 残せなければ、再接続したときも主催者として入れるよう、アドレスバーは主催者用 URL にする
        linkKey = loadAdminKey(storage, link!.roomId) === adminKey ? joinKey : adminKey;
        history.replaceState(null, "", buildRoomUrl(window.location.origin, { roomId: link!.roomId, key: linkKey }));
    }

    function renderRoom(room: RoomView): void {
        document.title = `${room.title} | 匿名質問ボード`;
        element<HTMLElement>("board-room-title").textContent = room.title;
        element<HTMLElement>("board-room-expires").textContent = `${dateFormat.format(room.expiresAt)} まで（過ぎると自動で削除されます）`;
    }

    // ----- 投稿フォーム -----

    const form = element<HTMLFormElement>("board-post-form");
    const nicknameInput = element<HTMLInputElement>("board-nickname");
    const bodyInput = element<HTMLTextAreaElement>("board-post-body");
    const countEl = element<HTMLElement>("board-post-count");
    const postError = element<HTMLParagraphElement>("board-post-error");
    const submit = element<HTMLButtonElement>("board-post-submit");
    nicknameInput.value = loadNickname(storage);

    function renderCompose(): void {
        if (!room) {
            return;
        }
        form.hidden = !room.accepting;
        element<HTMLElement>("board-closed").hidden = room.accepting;
        element<HTMLElement>("board-nickname-field").hidden = room.nameMode === "anonymous";
        const current = topics.find((topic) => topic.id === room!.currentTopicId);
        element<HTMLElement>("board-post-topic").textContent = current ? `「${current.title}」に投稿されます` : "";
        updateCount();
    }

    function updateCount(): void {
        const count = length(bodyInput.value.trim());
        countEl.textContent = `${count} / ${LIMITS.post}`;
        countEl.classList.toggle("is-over", count > LIMITS.post);
    }

    bodyInput.addEventListener("input", updateCount);

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        postError.textContent = "";
        const body = bodyInput.value.trim();
        if (body === "") {
            postError.textContent = "本文を入力してください";
            bodyInput.focus();
            return;
        }
        if (length(body) > LIMITS.post) {
            postError.textContent = `本文は ${LIMITS.post} 文字までです`;
            return;
        }
        const kind = (form.querySelector<HTMLInputElement>('input[name="kind"]:checked')?.value ?? "question") as PostKind;
        const nickname = room?.nameMode === "anonymous" ? null : nicknameInput.value.trim() || null;

        submit.disabled = true;
        client
            .request({ action: "post", kind, body, nickname })
            .then((message) => {
                if (message.type !== "posted") {
                    throw new Error(`unexpected message: ${message.type}`);
                }
                deleteKeys.set(message.postId, message.deleteKey);
                saveDeleteKeys(storage, link!.roomId, deleteKeys);
                saveNickname(storage, nickname ?? "");
                bodyInput.value = "";
                updateCount();
                // 投稿したトピックを表示する
                if (room && viewingTopicId !== room.currentTopicId) {
                    viewingTopicId = room.currentTopicId;
                }
                scheduleRenderPosts();
            })
            .catch((error: unknown) => {
                postError.textContent = error instanceof BoardRequestError ? error.message : "投稿できませんでした。もう一度お試しください";
            })
            .finally(() => {
                submit.disabled = false;
            });
    });

    // ----- 受付・URL の作り直し（主催者だけ） -----

    const acceptingToggle = element<HTMLButtonElement>("board-accepting-toggle");

    function renderAdminControls(): void {
        if (!room) {
            return;
        }
        element<HTMLElement>("board-accepting-status").textContent = room.accepting ? "投稿を受け付けています" : "投稿の受付を締め切っています";
        acceptingToggle.textContent = room.accepting ? "受付を締め切る" : "受付を再開する";
    }

    acceptingToggle.addEventListener("click", () => {
        if (!room) {
            return;
        }
        acceptingToggle.disabled = true;
        // 結果はほかの人と同じ acceptingChanged で届く
        client
            .request({ action: "setAccepting", accepting: !room.accepting })
            .catch((error: unknown) => showPopupNotification(error instanceof BoardRequestError ? error.message : "操作できませんでした"))
            .finally(() => {
                acceptingToggle.disabled = false;
            });
    });

    document.querySelectorAll<HTMLButtonElement>("[data-rotate]").forEach((button) => {
        button.addEventListener("click", () => {
            const target = button.dataset.rotate === "admin" ? "admin" : "join";
            const message =
                target === "join"
                    ? "共有用 URL を作り直しますか？古い URL では新しく入れなくなります。"
                    : "主催者用 URL を作り直しますか？ほかの主催者は参加者になります。";
            if (!window.confirm(message)) {
                return;
            }
            button.disabled = true;
            client
                .request({ action: "rotateKeys", target })
                .then((result) => {
                    if (result.type !== "keysRotated") {
                        throw new Error(`unexpected message: ${result.type}`);
                    }
                    joinKey = result.joinKey;
                    if (result.adminKey !== undefined) {
                        adminKey = result.adminKey;
                        saveAdminKey(storage, link!.roomId, adminKey);
                    }
                    showAdminUrls();
                    showPopupNotification(target === "join" ? "共有用 URL を作り直しました" : "主催者用 URL を作り直しました");
                })
                .catch((error: unknown) => showPopupNotification(error instanceof BoardRequestError ? error.message : "作り直せませんでした"))
                .finally(() => {
                    button.disabled = false;
                });
        });
    });

    // ----- トピックの管理（主催者だけ） -----

    const topicAdminList = element<HTMLUListElement>("board-topic-admin-list");
    const topicError = element<HTMLParagraphElement>("board-topic-error");

    // トピックが変わったときだけ描き直す（投稿のたびに描き直すと、名前を変えている途中の入力が消える）
    function renderTopicAdmin(): void {
        if (!isAdmin || !room) {
            return;
        }
        topicAdminList.replaceChildren(
            ...topics.map((topic) => {
                const li = document.createElement("li");
                li.dataset.topicId = topic.id;
                const input = document.createElement("input");
                input.type = "text";
                input.className = "form-control form-control-sm";
                input.value = topic.title;
                input.setAttribute("aria-label", `「${topic.title}」の名前`);
                const rename = document.createElement("button");
                rename.type = "button";
                rename.className = "btn btn-outline-success btn-sm";
                rename.dataset.action = "rename";
                rename.textContent = "名前を保存";
                // 名前を変えたときだけ押せる
                rename.disabled = true;
                input.addEventListener("input", () => {
                    rename.disabled = input.value.trim() === topic.title || input.value.trim() === "";
                });
                li.append(input, rename);
                if (topic.id === room!.currentTopicId) {
                    const current = document.createElement("span");
                    current.className = "board-topic-current";
                    current.textContent = "今のトピック";
                    li.append(current);
                } else {
                    const select = document.createElement("button");
                    select.type = "button";
                    select.className = "btn btn-success btn-sm";
                    select.dataset.action = "select";
                    select.textContent = "切り替える";
                    li.append(select);
                }
                return li;
            }),
        );
    }

    topicAdminList.addEventListener("click", (event) => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
        const topicId = button?.closest<HTMLLIElement>("li")?.dataset.topicId;
        if (!button || !topicId) {
            return;
        }
        if (button.dataset.action === "select") {
            topicRequest(button, { action: "setTopic", topicId });
        } else {
            const title = button.closest("li")!.querySelector("input")!.value.trim();
            topicRequest(button, { action: "renameTopic", topicId, title });
        }
    });

    const topicAddForm = element<HTMLFormElement>("board-topic-add-form");
    const topicAddTitle = element<HTMLInputElement>("board-topic-add-title");
    topicAddForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const title = topicAddTitle.value.trim();
        if (title === "") {
            topicError.textContent = "トピック名を入力してください";
            topicAddTitle.focus();
            return;
        }
        const select = element<HTMLInputElement>("board-topic-add-select").checked;
        topicRequest(topicAddForm.querySelector("button")!, { action: "addTopic", title, select }, () => {
            topicAddTitle.value = "";
        });
    });

    // 結果はほかの人と同じ topicsUpdated で届くので、ここではエラーだけ扱う
    function topicRequest(button: HTMLButtonElement, message: Parameters<BoardClient["request"]>[0], onSuccess?: () => void): void {
        topicError.textContent = "";
        button.disabled = true;
        client
            .request(message)
            .then(() => onSuccess?.())
            .catch((error: unknown) => {
                topicError.textContent = error instanceof BoardRequestError ? error.message : "操作できませんでした";
            })
            .finally(() => {
                // 一覧のボタンは topicsUpdated で描き直されるが、追加のボタンは残るため戻す
                button.disabled = false;
            });
    }

    // ----- 投稿の一覧 -----

    const list = element<HTMLUListElement>("board-post-list");
    const emptyEl = element<HTMLElement>("board-posts-empty");
    let renderScheduled = false;

    // 分けて届いた投稿をまとめて描くため、次の描画のタイミングまで待つ
    function scheduleRenderPosts(): void {
        if (renderScheduled) {
            return;
        }
        renderScheduled = true;
        requestAnimationFrame(() => {
            renderScheduled = false;
            renderTopics();
            renderPosts();
        });
    }

    function renderTopics(): void {
        const counts = new Map<string, number>();
        for (const post of posts.values()) {
            counts.set(post.topicId, (counts.get(post.topicId) ?? 0) + 1);
        }
        element<HTMLUListElement>("board-topic-tabs").replaceChildren(
            ...topics.map((topic) => {
                const li = document.createElement("li");
                li.className = "nav-item";
                const button = document.createElement("button");
                button.type = "button";
                button.className = "nav-link";
                button.dataset.topicId = topic.id;
                const isViewing = topic.id === viewingTopicId;
                button.classList.toggle("active", isViewing);
                button.setAttribute("aria-pressed", String(isViewing));
                button.textContent = topic.title;
                const count = document.createElement("span");
                count.className = "board-topic-count";
                count.textContent = String(counts.get(topic.id) ?? 0);
                button.append(count);
                if (topic.id === room?.currentTopicId) {
                    // 投稿が入るトピック
                    button.classList.add("is-current");
                    button.title = "今のトピック";
                }
                li.append(button);
                return li;
            }),
        );
    }

    function renderPosts(): void {
        const visible = sortPosts(
            [...posts.values()].filter((post) => post.topicId === viewingTopicId),
            sortOrder,
        );
        emptyEl.hidden = visible.length > 0;
        list.replaceChildren(...visible.map(renderPost));
    }

    function renderPost(post: PostView): HTMLLIElement {
        const li = document.createElement("li");
        li.className = "board-post";
        li.classList.toggle("is-pinned", post.pinned);

        const meta = document.createElement("div");
        meta.className = "board-post-meta";
        const kind = document.createElement("span");
        kind.className = `board-post-kind is-${post.kind}`;
        kind.textContent = KIND_LABELS[post.kind];
        meta.append(kind);
        if (room?.nameMode !== "anonymous") {
            const name = document.createElement("span");
            name.className = "board-post-name";
            name.textContent = post.nickname ?? "匿名";
            meta.append(name);
        }
        const time = document.createElement("time");
        time.dateTime = new Date(post.createdAt).toISOString();
        time.textContent = timeFormat.format(post.createdAt);
        meta.append(time);
        if (post.pinned) {
            const pinned = document.createElement("span");
            pinned.className = "board-post-pinned";
            pinned.textContent = "ピン留め";
            meta.append(pinned);
        }

        // 本文は textContent で入れる（HTML として解釈しない）
        const body = document.createElement("p");
        body.className = "board-post-body";
        body.textContent = post.body;

        const actions = document.createElement("div");
        actions.className = "board-post-actions";
        const liked = likes.has(post.id);
        const like = document.createElement("button");
        like.type = "button";
        like.className = "btn btn-sm board-like";
        like.classList.toggle("is-liked", liked);
        like.setAttribute("aria-pressed", String(liked));
        like.setAttribute("aria-label", liked ? "いいねを取り消す" : "いいね");
        like.dataset.action = liked ? "unlike" : "like";
        like.dataset.postId = post.id;
        like.disabled = busy.has(post.id);
        like.textContent = `${liked ? "♥" : "♡"} ${post.likes}`;
        actions.append(like);
        if (deleteKeys.has(post.id)) {
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "btn btn-link btn-sm board-post-delete";
            remove.dataset.action = "delete";
            remove.dataset.postId = post.id;
            remove.disabled = busy.has(post.id);
            remove.textContent = "取り消す";
            actions.append(remove);
        }
        if (isAdmin) {
            const pin = document.createElement("button");
            pin.type = "button";
            pin.className = "btn btn-link btn-sm board-post-admin";
            pin.dataset.action = post.pinned ? "unpin" : "pin";
            pin.dataset.postId = post.id;
            pin.disabled = busy.has(post.id);
            pin.textContent = post.pinned ? "ピン留めを外す" : "ピン留め";
            actions.append(pin);
            // 自分の投稿は「取り消す」で消せる
            if (!deleteKeys.has(post.id)) {
                const remove = document.createElement("button");
                remove.type = "button";
                remove.className = "btn btn-link btn-sm board-post-admin";
                remove.dataset.action = "admin-delete";
                remove.dataset.postId = post.id;
                remove.disabled = busy.has(post.id);
                remove.textContent = "削除";
                actions.append(remove);
            }
        }

        li.append(meta, body, actions);
        return li;
    }

    element<HTMLUListElement>("board-topic-tabs").addEventListener("click", (event) => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-topic-id]");
        if (button) {
            viewingTopicId = button.dataset.topicId!;
            scheduleRenderPosts();
        }
    });

    document.querySelectorAll<HTMLInputElement>('input[name="sort"]').forEach((input) => {
        input.addEventListener("change", () => {
            sortOrder = input.value as SortOrder;
            scheduleRenderPosts();
        });
    });

    list.addEventListener("click", (event) => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
        const postId = button?.dataset.postId;
        if (!button || !postId || busy.has(postId)) {
            return;
        }
        const { action } = button.dataset;
        if (action === "delete" || action === "admin-delete") {
            // 主催者の削除は鍵を送らない（サーバーが主催者か確かめる）
            const key = action === "delete" ? deleteKeys.get(postId)! : null;
            if (window.confirm(action === "delete" ? "この投稿を取り消しますか？" : "この投稿を削除しますか？（全員の画面から消えます）")) {
                act(postId, { action: "deletePost", postId, key }, () => {
                    posts.delete(postId);
                    forgetPost(postId);
                });
            }
            return;
        }
        if (action === "pin" || action === "unpin") {
            // ピン留めは、サーバーからの postPinned で表示を変える
            act(postId, { action, postId }, () => {});
            return;
        }
        const like = action === "unlike" ? "unlike" : "like";
        act(postId, { action: like, postId }, () => {
            // いいねの数は、サーバーからの postLiked で更新する
            if (like === "like") {
                likes.add(postId);
            } else {
                likes.delete(postId);
            }
            saveLikes(storage, link!.roomId, likes);
        });
    });

    // いいね・取り消しを送り、成功したら onSuccess で表示を変える
    function act(postId: string, message: Parameters<BoardClient["request"]>[0], onSuccess: () => void): void {
        busy.add(postId);
        scheduleRenderPosts();
        client
            .request(message)
            .then(onSuccess)
            .catch((error: unknown) => {
                if (error instanceof BoardRequestError && error.code === "post_not_found") {
                    posts.delete(postId);
                    forgetPost(postId);
                }
                showPopupNotification(error instanceof BoardRequestError ? error.message : "操作できませんでした");
            })
            .finally(() => {
                busy.delete(postId);
                scheduleRenderPosts();
            });
    }

    // 消えた投稿の取り消し用の鍵・いいねは、ブラウザからも消す
    function forgetPost(postId: string): void {
        if (deleteKeys.delete(postId)) {
            saveDeleteKeys(storage, link!.roomId, deleteKeys);
        }
        if (likes.delete(postId)) {
            saveLikes(storage, link!.roomId, likes);
        }
    }

    // ----- 接続の状態・エラー -----

    function showStatus(status: Status): void {
        // エラーを出したあと（切断したときなど）は、接続の状態を出さない
        if (!errorSection.hidden) {
            return;
        }
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
