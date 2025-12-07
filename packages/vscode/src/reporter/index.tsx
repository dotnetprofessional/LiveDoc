import * as React from "react";
import * as ReactDOM from "react-dom";
import { StyleSheet, css } from "aphrodite/no-important";
import { Reporter } from "./components";

document.addEventListener("DOMContentLoaded", Bootstrap);

function Bootstrap() {
    const reactRoot = document.querySelector("div");
    ReactDOM.render(<Reporter />, reactRoot);
}