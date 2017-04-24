import * as React from "react";
import * as ReactDOM from "react-dom";
import * as model from "./model/feature";
import { HomeScreen } from "./HomeScreen";

declare var document: any;

const data: model.Feature[] = require("./livedoc.json");
console.log(data);
ReactDOM.render(
    <HomeScreen features={data} />,
    document.getElementById("app")
);