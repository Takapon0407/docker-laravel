import { BoardClient, BoardRequestError } from "@/lib/board-client";
import { browserStorage, buildRoomUrl, loadAdminKey, saveAdminKey, websocketUrl } from "@/lib/board-link";
import type { NameMode, Retention } from "../../../../../../infra/board/shared/protocol.ts";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("board-create-form") as HTMLFormElement;
    const titleInput = document.getElementById("board-title") as HTMLInputElement;
    const topicsInput = document.getElementById("board-topics") as HTMLTextAreaElement;
    const errorEl = document.getElementById("board-create-error") as HTMLParagraphElement;
    const submit = document.getElementById("board-create-submit") as HTMLButtonElement;
    const configured = document.querySelector<HTMLMetaElement>('meta[name="board-websocket-url"]')?.content;

    // 送信するときに待たなくて済むよう、ページを開いた時点でつないでおく
    const client = new BoardClient({ url: websocketUrl(configured, window.location) });
    client.connect();

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        errorEl.textContent = "";

        const title = titleInput.value.trim();
        if (title === "") {
            errorEl.textContent = "タイトルを入力してください";
            titleInput.focus();
            return;
        }
        const retention = (form.querySelector<HTMLInputElement>('input[name="retention"]:checked')?.value ?? "7d") as Retention;
        const nameMode = (form.querySelector<HTMLInputElement>('input[name="name-mode"]:checked')?.value ?? "nickname") as NameMode;
        // 空の行は無視する
        const topics = topicsInput.value
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line !== "");

        submit.disabled = true;
        client
            .request({ action: "createRoom", title, retention, nameMode, topics })
            .then((message) => {
                if (message.type !== "roomCreated") {
                    throw new Error(`unexpected message: ${message.type}`);
                }
                // 主催者の鍵をこのブラウザに残し、アドレスバーには共有用 URL を出す（そのまま共有しても安全なように）
                // 残せない環境（プライベートブラウズなど）では、主催者のまま入れるよう管理用 URL で開く
                const storage = browserStorage();
                saveAdminKey(storage, message.roomId, message.adminKey);
                const saved = loadAdminKey(storage, message.roomId) === message.adminKey;
                client.close();
                window.location.href = buildRoomUrl(window.location.origin, {
                    roomId: message.roomId,
                    key: saved ? message.joinKey : message.adminKey,
                });
            })
            .catch((error: unknown) => {
                errorEl.textContent = error instanceof BoardRequestError ? error.message : "ルームを作れませんでした。もう一度お試しください";
                submit.disabled = false;
            });
    });
});
