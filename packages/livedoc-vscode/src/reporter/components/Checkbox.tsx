import * as React from "react";
import * as ReactDOM from "react-dom";
import { StyleSheet, css } from "aphrodite/no-important";

export class Checkbox extends React.PureComponent<
    {
        id: string;
        label: string;
        groupingName: string;
    },
    {}> {

    public render() {
        return (
            <div className={css(Checkbox.styles.flexibleRow)}>
                <label htmlFor={this.props.id} className={css(Checkbox.styles.block)}>{this.props.label}</label>
                <input type="checkbox" name={this.props.groupingName} className={css(Checkbox.styles.flex)} />
            </div>
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
        }
    });
};