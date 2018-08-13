import * as React from "react";
import * as ReactDOM from "react-dom";
import { StyleSheet, css } from "aphrodite/no-important";
import * as model from "livedoc-mocha/model";

export class Scenario extends React.PureComponent<
    {
        scenario: model.Scenario | model.ScenarioOutline;
        back: () => void;
        extensionRootPath: string;
    },
    {
        selectedExample?: model.ScenarioExample;
    }> {

    public constructor(props) {
        super(props);

        this.state = {
            selectedExample: null
        };

        this.selectExample = this.selectExample.bind(this);
    }

    public componentWillReceiveProps(nextProps) {
        if (this.props.scenario !== nextProps.scenario) {
            this.setState({ selectedExample: null });
        }
    }

    private getStatusIcon(status: string) {
        let className;
        switch (status) {
            case "fail":
            case "fail-pending":
            case "fail-warning":
                className = "fa-times-circle";
                break;
            default:
                className = "fa-check-circle";
        }
        return (
            <i className={`fas ${className}`} />
        );
    }

    private getStatusFromStatistics(statistics: model.Statistics<model.LiveDocSuite>) {
        const pass = !!statistics.passCount;
        const fail = !!statistics.failedCount;
        const pending = !!statistics.pendingCount;
        const warning = !!statistics.totalRuleViolations;

        let text = pass && "pass" || fail && "fail";
        if (pending) {
            text += "-pending";
        }
        if (warning) {
            text += "-warning";
        }
        return text;
    }

    private selectExample(example: model.ScenarioExample) {
        this.setState({
            selectedExample: example
        });
    }

    private renderExamples(scenarioOutline: model.ScenarioOutline) {
        const { examples, tables } = scenarioOutline;

        if (!examples) {
            return null;
        }

        let rowOffset = 0;
        return tables.map((table, tableIndex) => {
            const htmlTableContents = table.dataTable.map((cols: string[], rowIndex) => {
                if (rowIndex === 0) {
                    const columns = cols.map((value, colIndex) => {
                        return (
                            <th key={colIndex} className={css(Scenario.styles.borderedCell)}>{value}</th>
                        );
                    });
                    columns.unshift(<th key="status" className={css(Scenario.styles.borderedCell)}></th>);

                    return (
                        <thead key={rowIndex}>
                            <tr>
                                {columns}
                            </tr>
                        </thead>
                    );
                } else {
                    const example = examples[rowOffset + rowIndex - 1];
                    const selectedStyle = example === this.state.selectedExample && Scenario.styles.selectedRow;

                    const columns = cols.map((value, colIndex) => {
                        return (
                            <td key={colIndex} className={css(Scenario.styles.borderedCell, selectedStyle)}>{value}</td>
                        );
                    });
                    columns.unshift(<td key={`status${rowIndex}`} className={css(Scenario.styles.borderedCell, selectedStyle)}>
                        {this.getStatusIcon(this.getStatusFromStatistics(example.statistics))}
                    </td>);

                    return (
                        <tr key={rowIndex} role="button" onClick={this.selectExample.bind(null, example)}>
                            {columns}
                        </tr>
                    )
                }
            });

            rowOffset += table.dataTable.length - 1;
            return (
                <div key={tableIndex}>
                    <h4>Examples: {table.name}</h4>
                    <table cellPadding={0} cellSpacing={0} className="table table-bordered table-sm">
                        {htmlTableContents}
                    </table>
                </div>
            );
        });
    }

    private renderExampleSteps(example: model.ScenarioExample) {
        const steps = example.steps.map(step => {
            return (
                <li key={step.id}>
                    {this.getStatusIcon(this.getStatusFromStatistics(example.statistics))}
                    {String.fromCharCode(160).repeat(2)}
                    {
                        ["and", "but"].indexOf(step.type) > -1
                        &&
                        String.fromCharCode(160).repeat(4)
                    }
                    <span className={css(Scenario.styles.stepType)}>{step.type}</span>
                    {" "}
                    {step.title}
                </li>
            );
        });

        return (
            <div>
                <h4>Example</h4>
                <ul className={css(Scenario.styles.noListStyle)}>
                    {steps}
                </ul>
            </div>
        );
    }

    private renderStepsDefinition(scenario: model.Scenario) {
        const isScenarioOutline = scenario.hasOwnProperty("examples");
        const steps = scenario.steps.map(step => {
            return (
                <li key={step.id}>
                    {
                        !isScenarioOutline
                        &&
                        this.getStatusIcon(step.status)
                    }
                    {String.fromCharCode(160).repeat(2)}
                    {
                        ["and", "but"].indexOf(step.type) > -1
                        &&
                        String.fromCharCode(160).repeat(4)
                    }
                    <span className={css(Scenario.styles.stepType)}>{step.type}</span>
                    {" "}
                    <span dangerouslySetInnerHTML={{ __html: step.rawTitle.replace(/<[^>]+>/g, match => `<span class="${css(Scenario.styles.binding)}">${match.replace("<", "&lt;").replace(">", "&gt;")}</span>`) }}></span>
                    {
                        step.description
                        &&
                        <p dangerouslySetInnerHTML={{ __html: step.description.replace(/\n/g, "<br/>").replace(/\s{2}/g, "&nbsp;") }} />
                    }
                    {
                        step.docString
                        &&
                        <p>
                            <div>"""</div>
                            <div dangerouslySetInnerHTML={{ __html: step.docString.replace(/<[^>]+>/g, match => `<span class="${css(Scenario.styles.binding)}">${match.replace("<", "&lt;").replace(">", "&gt;")}</span>`).replace(/\n/g, "<br/>").replace(/\s{2}/g, "&nbsp;") }} />
                            <div>"""</div>
                        </p>
                    }
                </li>
            );
        });

        return (
            <div>
                <ul className={css(Scenario.styles.noListStyle)}>
                    {steps}
                </ul>
            </div>
        );
    }

    public render() {
        const { parent: feature, ...scenario } = this.props.scenario;

        return (
            <div className={css(Scenario.styles.flex)}>
                <a href="javascript:void(0)" onClick={this.props.back}>Back to summary</a>
                <div>
                    <h2>Feature: {feature.title}</h2>
                    {
                        feature.description
                        &&
                        <p dangerouslySetInnerHTML={{ __html: feature.description.replace(/\n/g, "<br/>").replace(/\s{2}/g, "&nbsp;") }}></p>
                    }
                </div>
                <h3>Scenario: {scenario.title}</h3>
                {
                    scenario.description
                    &&
                    <p dangerouslySetInnerHTML={{ __html: scenario.description.replace(/\n/g, "<br/>").replace(/\s{2}/g, "&nbsp;") }}></p>
                }

                {this.renderStepsDefinition(scenario as model.Scenario)}

                {this.renderExamples(scenario as model.ScenarioOutline)}

                {
                    this.state.selectedExample
                    &&
                    this.renderExampleSteps(this.state.selectedExample)
                }
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
        },
        expandable: {
            overflow: "hidden"
        },
        collapsed: {
            height: 0
        },
        borderedCell: {
            border: "solid 1px #fff",
            padding: "5px"
        },
        selectedRow: {
            backgroundColor: "royalblue"
        },
        noListStyle: {
            listStyleType: "none"
        },
        stepType: {
            color: "blue"
        },
        binding: {
            color: "firebrick"
        }
    });
}