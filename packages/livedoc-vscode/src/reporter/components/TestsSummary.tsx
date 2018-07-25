import * as React from "react";
import * as ReactDOM from "react-dom";
import { StyleSheet, css } from "aphrodite/no-important";
import * as model from "livedoc-mocha/model";

import { Collapsable } from "./Collapsable";
import { Checkbox } from "./Checkbox";

export class TestsSummary extends React.PureComponent<
    {
        model: model.ExecutionResults;
    },
    {
        collapsedKeys?: string[]
    }> {

    public constructor(props) {
        super(props);

        this.state = {
            collapsedKeys: []
        };

        this.toggleNodeCollapsed = this.toggleNodeCollapsed.bind(this);
        this.toggleAllNodesCollapsed = this.toggleAllNodesCollapsed.bind(this);
    }

    private toggleNodeCollapsed(key: string) {
        const foundIndex = this.state.collapsedKeys.indexOf(key);
        if (foundIndex > -1) {
            const newCollapsedKeys = this.state.collapsedKeys.slice(0, foundIndex).concat(this.state.collapsedKeys.slice(foundIndex + 1));
            this.setState({
                collapsedKeys: newCollapsedKeys
            });
        } else {
            this.setState({
                collapsedKeys: this.state.collapsedKeys.concat([key])
            })
        }
    }

    private toggleAllNodesCollapsed() {
        if (this.props.model && this.props.model.features) {
            let collapsedKeys = [];
            if (this.state.collapsedKeys.length === 0) {
                collapsedKeys = this.props.model.features.map(f => f.id);
            }

            this.setState({
                collapsedKeys
            });
        }
    }

    private renderScenario(scenario: model.Scenario) {
        return (
            <tr key={scenario.id}>
                <td colSpan={5} className={css(TestsSummary.styles.scenario)}>
                    {scenario.title}
                </td>
            </tr>
        );
    }

    private renderFeatures() {
        const { collapsedKeys } = this.state;
        const features = (this.props.model && this.props.model.features || []).map(feature => {
            let scenarios;
            if (collapsedKeys.indexOf(feature.id) === -1) {
                scenarios = (feature.scenarios || [])
                    .map(this.renderScenario);
            }

            return (
                <React.Fragment>
                    <tr key={feature.id}>
                        <td>
                            <a href="javascript:void(0)" onClick={this.toggleNodeCollapsed.bind(null, feature.id)}>+-</a>{"  "}
                            {feature.title}
                        </td>
                        <td className={css(TestsSummary.styles.alignCenter)}>
                            {feature.scenarios.length}
                        </td>
                        <td className={css(TestsSummary.styles.alignCenter)}>
                            {feature.statistics.passCount}
                        </td>
                        <td className={css(TestsSummary.styles.alignCenter)}>
                            {feature.statistics.failedCount}
                        </td>
                        <td className={css(TestsSummary.styles.alignCenter)}>
                            {feature.statistics.pendingCount}
                        </td>
                        <td className={css(TestsSummary.styles.alignCenter)}>
                            {feature.statistics.totalRuleViolations}
                        </td>
                    </tr>
                    {scenarios}
                </React.Fragment>
            );
        });

        return (
            <tbody>
                {features}
            </tbody>
        );
    }

    public render() {
        return (
            <div className={css(TestsSummary.styles.flex, TestsSummary.styles.stretchChildren)}>
                <h2>Tests</h2>
                <table className={css(TestsSummary.styles.flex, TestsSummary.styles.table)}>
                    <thead>
                        <th className={css(TestsSummary.styles.alignLeft)}>
                            <a href="javascript:void(0)" onClick={this.toggleAllNodesCollapsed}>+-</a>{"  "}
                            Feature
                        </th>
                        <th>
                            Scenarios
                        </th>
                        <th>
                            Passed
                        </th>
                        <th>
                            Failed
                        </th>
                        <th>
                            Pending
                        </th>
                        <th>
                            Warning
                        </th>
                    </thead>
                    {this.renderFeatures()}
                </table>
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
            flex: "1 1 auto",
            overflow: "auto"
        },
        stretchChildren: {
            alignContent: "stretch"
        },
        table: {
            width: "100%"
        },
        alignCenter: {
            textAlign: "center"
        },
        alignLeft: {
            textAlign: "left"
        },
        scenario: {
            padding: "5px 10px 5px 25px"
        }
    });
};