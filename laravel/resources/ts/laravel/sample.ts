import "bootstrap";
import moment from "moment";

const currentDate = moment();

// 年齢を計算して表示
const age = currentDate.diff(moment("1994-04-07"), "years");
const ageElement = document.getElementById("age");
if (ageElement) {
    ageElement.innerText = "年齢: " + age;
}
