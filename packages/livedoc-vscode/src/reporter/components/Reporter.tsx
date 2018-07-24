import * as React from "react";
import * as ReactDOM from "react-dom";
import { StyleSheet, css } from "aphrodite/no-important";
import { Filter } from "./Filter";
import { SummaryFilter } from "./SummaryFilter";
import { TestsSummary } from "./TestsSummary";

export class Reporter extends React.PureComponent {
    public constructor(props) {
        super(props);

        this.handleMessage = this.handleMessage.bind(this);
    }

    private handleMessage(event) {
        debugger;
        this.setState({
            model: JSON.parse(event.data)
        });
    }

    public componentDidMount() {
        const vscode = acquireVsCodeApi();
        window.addEventListener("message", this.handleMessage);

        if (vscode) {
            vscode.postMessage("listening");
        }
    }

    public componentWillUnmount() {
        window.removeEventListener("message", this.handleMessage);
    }

    public render() {
        return (
            <div className={css(Reporter.styles.flexible)}>
                <Filter />
                <SummaryFilter model={this.state && this.state.model || {}} />
                <TestsSummary model={this.state && this.state.model || {}} />
            </div>
        );
    }

    private static styles = StyleSheet.create({
        flexible: {
            display: "flex",
            flexDirection: "column",
            alignContent: "stretch",
            height: "100vh"
        }
    });
}