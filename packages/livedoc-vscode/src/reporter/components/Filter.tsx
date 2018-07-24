import * as React from "react";
import * as ReactDOM from "react-dom";
import { StyleSheet, css } from "aphrodite/no-important";

import { Collapsable } from "./Collapsable";

export class Filter extends React.PureComponent<{},
    {
        expanded?: boolean;
    }> {

    public constructor(props) {
        super(props);

        this.state = {
            expanded: true
        };
    }

    public render() {
        return (
            <Collapsable title="Filter">
                <div className={css(Filter.styles.flexibleRow, Filter.styles.flex)}>
                    <label htmlFor="search-text" className={css(Filter.styles.inputLabel, Filter.styles.block)}>Search</label>
                    <input id="search-text" type="text" className={css(Filter.styles.flex)} />
                    <button>Add</button>
                </div>
                <div className={css(Filter.styles.flexibleRow, Filter.styles.flex)}>
                    <label htmlFor="search-tag" className={css(Filter.styles.inputLabel, Filter.styles.block)}>Tags</label>
                    <input id="search-tag" type="text" className={css(Filter.styles.flex)} />
                    <button>Add</button>
                </div>
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