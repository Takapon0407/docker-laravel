import "bootstrap";
import moment from "moment";

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
