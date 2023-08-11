import * as bootstrap from "bootstrap";

document.addEventListener("DOMContentLoaded", function () {
    var dropdownToggles = document.querySelectorAll(".dropdown-toggle");
    dropdownToggles.forEach(function (toggle) {
        new bootstrap.Dropdown(toggle);
    });
});

console.log("Hoge");
