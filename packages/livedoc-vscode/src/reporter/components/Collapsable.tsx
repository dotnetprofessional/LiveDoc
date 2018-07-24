import * as React from "react";
import * as ReactDOM from "react-dom";
import { StyleSheet, css } from "aphrodite/no-important";

export class Collapsable extends React.PureComponent<
    {
        title: string;
    }, {
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
            <div>
                <h2>{this.props.title} <a href="#" onClick={() => { this.setState({ expanded: !this.state.expanded }) }}>+-</a></h2>
                <div
                    className={css(
                        Collapsable.styles.flexible,
                        Collapsable.styles.expandable,
                        !this.state.expanded && Collapsable.styles.collapsed
                    )}>
                    {this.props.children}
                </div>
            </div>
        );
    }

    private static styles = StyleSheet.create({
        flexible: {
            display: "flex"
        },
        expandable: {
            overflow: "hidden"
        },
        collapsed: {
            height: 0
        }
    });
};