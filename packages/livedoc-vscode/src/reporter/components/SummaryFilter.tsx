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
        model: model.ExecutionResults
    },
    {}> {

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
                    count={statisticsRollup.passCount} />
                <CheckboxWithCount
                    id="failed"
                    label="Failed"
                    groupingName="test-result"
                    count={statisticsRollup.failedCount} />
                <CheckboxWithCount
                    id="pending"
                    label="Pending"
                    groupingName="test-result"
                    count={statisticsRollup.pendingCount} />
                <CheckboxWithCount
                    id="warning"
                    label="Warning"
                    groupingName="test-result"
                    count={statisticsRollup.ruleViolationsCount} />
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