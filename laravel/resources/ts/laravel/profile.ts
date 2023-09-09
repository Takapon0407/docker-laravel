import moment from "moment";
import { showpopupNotification } from "./util/notification";

const currentDate = moment();
const birthDate = moment("1994-04-07");
const ageYears = currentDate.diff(birthDate, "years");
birthDate.add(ageYears, "years");

const ageMonths = currentDate.diff(birthDate, "months");
birthDate.add(ageMonths, "months");

const ageDays = currentDate.diff(birthDate, "days");

const ageElement = document.getElementById("age");
if (ageElement) {
    ageElement.innerText = `年齢: ${ageYears}歳 ${ageMonths}ヶ月 ${ageDays}日`;
}

// metamaskのaddressをクリップボードへコピー
const copyButton = document.getElementById("metamask-logo");

if (copyButton) {
    copyButton.addEventListener("click", function () {
        // TODO : https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_APIに置き換える
        const textToCopy = "0x83C989e4Af7ACa81066f4F7E3a29f190d88fB14a";
        const textarea = document.createElement("textarea");
        textarea.value = textToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);

        showpopupNotification("アドレスをクリップボードへコピーしました！");
    });
}
