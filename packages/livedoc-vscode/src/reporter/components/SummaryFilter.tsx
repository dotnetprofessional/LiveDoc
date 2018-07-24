import * as React from "react";
import * as ReactDOM from "react-dom";
import { StyleSheet, css } from "aphrodite/no-important";

import { Collapsable } from "./Collapsable";
import { Checkbox } from "./Checkbox";

export class SummaryFilter extends React.PureComponent<
    {
    },
    {}> {

    public render() {
        return (
            <Collapsable title="Summary">
                <Checkbox
                    id="passed"
                    label="Passed"
                    groupingName="test-result" />
                <Checkbox
                    id="failed"
                    label="Failed"
                    groupingName="test-result" />
                <Checkbox
                    id="pending"
                    label="Pending"
                    groupingName="test-result" />
                <Checkbox
                    id="warning"
                    label="Warning"
                    groupingName="test-result" />
            </Collapsable>
        );
    }

    private static styles = StyleSheet.create({
        block: {
            display: "block"
        },
        flexible: {
            display: "flex"
        },
        flexibleRow: {
            display: "flex",
            flexFlow: "row",
            padding: "5px 10px"
        },
        flex: {
            flex: "1 1 auto"
        },
        inputLabel: {
            marginRight: 10
        },
        expandable: {
            overflow: "hidden"
        },
        collapsed: {
            height: 0
        }
    });
};