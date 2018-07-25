import * as React from "react";
import * as ReactDOM from "react-dom";
import { StyleSheet, css } from "aphrodite/no-important";

export const CollapsableWithTitle: React.StatelessComponent<{ title: string }> = (props) => {
    return (
        <Collapsable
            renderTitle={(renderCollapse) => {
                return (
                    <h2>{props.title} {renderCollapse()}</h2>
                );
            }}>
            {props.children}
        </Collapsable>
    );
};

export class Collapsable extends React.PureComponent<
    {
        renderTitle: (renderCollapse: () => JSX.Element) => JSX.Element;
    }, {
        expanded?: boolean;
    }> {

    public constructor(props) {
        super(props);

        this.state = {
            expanded: true
        };

        this.renderCollapse = this.renderCollapse.bind(this);
    }

    private renderCollapse() {
        return (
            <a href="#" onClick={() => { this.setState({ expanded: !this.state.expanded }) }}>+-</a>
        );
    }

    public render() {
        return (
            <div>
                {this.props.renderTitle(this.renderCollapse)}
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
            display: "flex",
            flexFlow: "column nowrap",
            alignContent: "stretch"
        },
        expandable: {
            overflow: "hidden"
        },
        collapsed: {
            height: 0
        }
    });
};