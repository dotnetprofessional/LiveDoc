import * as React from "react";
import * as ReactDOM from "react-dom";
import { StyleSheet, css } from "aphrodite/no-important";
import * as model from "livedoc-mocha/model";

import { CollapsableWithTitle } from "./Collapsable";
import { Checkbox, ICheckboxProps } from "./Checkbox";
import { BoxPackProperty } from "../../../node_modules/csstype";

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
        applyFilter: (filterFn: (featureOrScenario: model.Feature | model.Scenario) => boolean) => void;
        getRawModel: () => model.ExecutionResults;
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
        const model = this.props.getRawModel();
        return (model && model.features || [])
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
            <CollapsableWithTitle title="Summary">
                <div className={css(SummaryFilter.styles.flexibleRow)}>
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
                </div>
            </Collapsable>
        );
    }

    private filterChanged(name: string, value: boolean) {
        const newFilters = Object.assign({}, this.state.filters, { [name]: value });
        this.setState({
            filters: newFilters
        }, () => {
            const curryPredicate = (a: (featureOrSceanrio: model.Feature | model.Scenario) => boolean, b: (featureOrSceanrio: model.Feature | model.Scenario) => boolean): (featureOrSceanrio: model.Feature | model.Scenario) => boolean => {
                return (featureOrSceanrio: model.Feature | model.Scenario) => {
                    return a(featureOrSceanrio) || b(featureOrSceanrio);
                }
            };

            let predicate = (featureOrSceanrio: model.Feature | model.Scenario) => this.state.filters.passed && featureOrSceanrio.statistics.passCount > 0;
            predicate = curryPredicate(predicate, featureOrSceanrio => this.state.filters.failed && featureOrSceanrio.statistics.failedCount > 0)
            predicate = curryPredicate(predicate, featureOrSceanrio => this.state.filters.pending && featureOrSceanrio.statistics.pendingCount > 0)
            predicate = curryPredicate(predicate, featureOrSceanrio => this.state.filters.warning && featureOrSceanrio.statistics.totalRuleViolations > 0)

            const filter = function summaryFilter(featureOrSceanrio: model.Feature | model.Scenario) {
                return predicate(featureOrSceanrio);
            }

            // this.props.applyFilter(fs => {
            //     return (this.state.filters.passed && fs.statistics.passCount > 0)
            //         || (this.state.filters.failed && fs.statistics.failedCount > 0)
            //         || (this.state.filters.pending && fs.statistics.pendingCount > 0)
            //         || (this.state.filters.warning && fs.statistics.totalRuleViolations > 0)
            // });
            this.props.applyFilter(filter)
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