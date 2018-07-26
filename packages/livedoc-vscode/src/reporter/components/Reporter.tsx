import * as React from "react";
import * as ReactDOM from "react-dom";
import { StyleSheet, css } from "aphrodite/no-important";
import { Filter } from "./Filter";
import { SummaryFilter } from "./SummaryFilter";
import { TestsSummary } from "./TestsSummary";
import * as model from "livedoc-mocha/model";
import { Scenario } from "./Scenario";

interface IReporterState {
    model?: model.ExecutionResults;
    viewScenario?: model.Scenario;
}

export class Reporter extends React.PureComponent<
    {

    }, IReporterState> {

    private _serializedModel: string;
    private _extensionRootPath: string;
    private _filters: [string, (featureOrScenario: model.Feature | model.Scenario) => boolean][] = [];

    public constructor(props) {
        super(props);

        this.state = {
            model: null,
            viewScenario: null
        };

        this.handleMessage = this.handleMessage.bind(this);
        this.applyFilter = this.applyFilter.bind(this);
        this.getRawModel = this.getRawModel.bind(this);
        this.goToSummary = this.goToSummary.bind(this);
        this.goToScenario = this.goToScenario.bind(this);
    }

    private handleMessage(event) {
        const { model, extensionRootPath, scenarioId } = event.data;

        if (extensionRootPath) {
            this._extensionRootPath = extensionRootPath;
        }

        const stateToUpdate: IReporterState = {};
        if (model) {
            this._serializedModel = JSON.stringify(model);
            stateToUpdate.model = model;

            if (!scenarioId) {
                stateToUpdate.viewScenario = null;
            }
        }

        if (scenarioId) {
            debugger;
            const searchModel: model.ExecutionResults = model || this.state.model;
            const [featureId] = scenarioId.split("-");

            const feature = searchModel.features.find(f => f.id === featureId);
            const scenario = feature.scenarios.find(s => s.id === scenarioId);
            this.goToScenario(scenario, feature);
        }
        this.setState(stateToUpdate);
    }

    private applyFilter(filterFn: (featureOrScenario: model.Feature | model.Scenario) => boolean) {
        const filterFnWrapper = (featureOrScenario: model.Feature | model.Scenario) => {
            let include = filterFn(featureOrScenario);

            if (featureOrScenario.hasOwnProperty("scenarios")) {
                include = include || (featureOrScenario as any).hasMatchedScenarios;
            }
            return include;
        }

        const existing = this._filters.find(pair => pair[0] === filterFn.name);
        if (existing) {
            existing[1] = filterFnWrapper;
        } else {
            this._filters.push([filterFn.name, filterFnWrapper]);
        }

        this.updateFilteredData();
    }

    private updateFilteredData() {
        const curryPredicate = (a: (featureOrSceanrio: model.Feature | model.Scenario) => boolean, b: (featureOrSceanrio: model.Feature | model.Scenario) => boolean): (featureOrSceanrio: model.Feature | model.Scenario) => boolean => {
            return (featureOrSceanrio: model.Feature | model.Scenario) => {
                return a(featureOrSceanrio) && b(featureOrSceanrio);
            }
        };

        this._filters[1];
        let predicate;
        for (const [key, filterFn] of this._filters) {
            if (!predicate) {
                predicate = filterFn;
            } else {
                predicate = curryPredicate(predicate, filterFn);
            }
        }

        const model = JSON.parse(this._serializedModel);
        const filteredFeatures = model.features.map(feature => {
            const filteredScenarios = feature.scenarios.filter(predicate);
            if (filteredScenarios.length > 0) {
                feature = Object.assign({}, feature, { scenarios: filteredScenarios, hasMatchedScenarios: true });
            }
            return feature;
        }).filter(predicate);
        const filteredModel = Object.assign({}, model, { features: filteredFeatures });

        this.setState({
            model: filteredModel
        });
    }

    private getRawModel(): model.ExecutionResults {
        return JSON.parse(this._serializedModel || "{}");
    }

    private goToSummary() {
        this.setState({
            viewScenario: null
        });
    }

    private goToScenario(scenario: model.Scenario, feature: model.Feature) {
        const viewScenario = scenario;
        viewScenario.parent = feature;
        this.setState({
            viewScenario
        });
    }

    public componentDidMount() {
        const vscode = acquireVsCodeApi();
        window.addEventListener("message", this.handleMessage);

        if (vscode) {
            vscode.postMessage("listening");
        }
    }

    public componentWillUnmount() {
        window.removeEventListener("message", this.handleMessage);
    }

    public render() {
        const model = this.state.model || {} as model.ExecutionResults;
        return (
            <div className={css(Reporter.styles.flexible)}>
                <div className={css(
                    Reporter.styles.screenActive,
                    this.state.viewScenario && Reporter.styles.screenInactive
                )}>
                    <Filter
                        applyFilter={this.applyFilter} />
                    <SummaryFilter
                        applyFilter={this.applyFilter}
                        model={model}
                        getRawModel={this.getRawModel} />
                    <TestsSummary model={model}
                        viewScenario={this.goToScenario} />
                </div>
                {
                    this.state.viewScenario
                    &&
                    <Scenario
                        scenario={this.state.viewScenario}
                        back={this.goToSummary}
                        extensionRootPath={this._extensionRootPath} />
                }
            </div>
        );
    }

    private static styles = StyleSheet.create({
        flexible: {
            display: "flex",
            flexDirection: "column",
            alignContent: "stretch",
            height: "100vh"
        },
        screenInactive: {
            display: "none"
        },
        screenActive: {
            flex: "1 1 auto",
            display: "flex",
            flexFlow: "column nowrap"
        }
    });
}