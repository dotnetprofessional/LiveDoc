import * as React from "react";
import * as ReactDOM from "react-dom";
import { StyleSheet, css } from "aphrodite/no-important";
import * as model from "livedoc-mocha/model";

import { Collapsable } from "./Collapsable";
import { Checkbox, ICheckboxProps } from "./Checkbox";
import { RuleViolations } from "../../../node_modules/livedoc-mocha/model/RuleViolations";

interface ICheckboxWithCountProps extends ICheckboxProps {
    count: number;
}

const CheckboxWithCount: React.StatelessComponent<ICheckboxWithCountProps> = (props: ICheckboxWithCountProps) => {
    const { count, ...checkboxProps } = props;
    return (
        <div className={css(SummaryFilter.styles.flexibleRow)}>
            <Checkbox {...checkboxProps} />
            <div>
                <span>({count})</span>
            </div>
        </div>
    );
};

export class SummaryFilter extends React.PureComponent<
    {
        model: model.ExecutionResults;
    },
    {
        filters?: {
            passed: boolean;
            failed: boolean;
            pending: boolean;
            warning: boolean;
        }
    }> {

    public constructor(props) {
        super(props);

        this.state = {
            filters: {
                passed: true,
                failed: true,
                pending: true,
                warning: true
            }
        }

        this.filterChanged = this.filterChanged.bind(this);
    }

    private rollupFeatureStatistics(): { passCount: number; failedCount: number; pendingCount: number; ruleViolationsCount: number } {
        return (this.props.model && this.props.model.features || [])
            .reduce((rollup, feature) => {
                rollup.passCount += feature.statistics.passCount;
                rollup.failedCount += feature.statistics.failedCount;
                rollup.pendingCount += feature.statistics.pendingCount;
                rollup.ruleViolationsCount += feature.statistics.totalRuleViolations;
                return rollup;
            }, { passCount: 0, failedCount: 0, pendingCount: 0, ruleViolationsCount: 0 });
    }

    public render() {
        const statisticsRollup = this.rollupFeatureStatistics();
        return (
            <Collapsable title="Summary">
                <CheckboxWithCount
                    id="passed"
                    label="Passed"
                    groupingName="test-result"
                    count={statisticsRollup.passCount}
                    onChange={this.filterChanged.bind(null, "passed")}
                    checked={this.state.filters.passed} />
                <CheckboxWithCount
                    id="failed"
                    label="Failed"
                    groupingName="test-result"
                    count={statisticsRollup.failedCount}
                    onChange={this.filterChanged.bind(null, "failed")}
                    checked={this.state.filters.failed} />
                <CheckboxWithCount
                    id="pending"
                    label="Pending"
                    groupingName="test-result"
                    count={statisticsRollup.pendingCount}
                    onChange={this.filterChanged.bind(null, "pending")}
                    checked={this.state.filters.pending} />
                <CheckboxWithCount
                    id="warning"
                    label="Warning"
                    groupingName="test-result"
                    count={statisticsRollup.ruleViolationsCount}
                    onChange={this.filterChanged.bind(null, "warning")}
                    checked={this.state.filters.warning} />
            </Collapsable>
        );
    }

    private filterChanged(name: string, value: boolean) {
        const newFilters = Object.assign({}, this.state.filters, { [name]: value });
        this.setState({
            filters: newFilters
        });
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