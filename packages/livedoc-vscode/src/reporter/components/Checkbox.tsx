import * as React from "react";
import * as ReactDOM from "react-dom";
import { StyleSheet, css } from "aphrodite/no-important";

export interface ICheckboxProps {
    id: string;
    label: string;
    groupingName: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}

export class Checkbox extends React.PureComponent<
    ICheckboxProps,
    {}> {

    private _refs: { [key: string]: HTMLElement } = {};

    public constructor(props) {
        super(props);

        this.onChange = this.onChange.bind(this);
        this.setRef = this.setRef.bind(this);
    }

    public render() {
        return (
            <div className={css(Checkbox.styles.flexibleRow)}>
                <input
                    ref={this.setRef.bind(null, "checkbox")}
                    checked={this.props.checked}
                    onChange={this.onChange}
                    type="checkbox" name={this.props.groupingName} className={css(Checkbox.styles.flex)} />
                <label htmlFor={this.props.id} className={css(Checkbox.styles.block)}>{this.props.label}</label>
            </div>
        );
    }

    private setRef(key: string, ref: HTMLElement) {
        this._refs[key] = ref;
    }

    private onChange(event: React.SyntheticEvent) {
        if (this.props.onChange) {
            const checkbox = this._refs.checkbox as any;
            this.props.onChange(checkbox.checked);
        }
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