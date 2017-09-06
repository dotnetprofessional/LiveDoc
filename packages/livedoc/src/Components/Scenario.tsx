import * as React from "react";
import * as model from "livedoc-model";
const Link = require("react-router-dom").Link;
import { ProgressBar } from "react-bootstrap";
import { StatusFlag, Text } from ".";

//import * as Bootstrap from "react-bootstrap";
//import * as Components from ".";

export class ScenarioProps {
    feature: model.Feature;
    scenario: model.Scenario;
}
export class Scenario extends React.Component<ScenarioProps, any> {

    stepItem(scenario: model.StepDefinition) {
        return (
        );
    }

    render() {
        const steps: any[] = [];
        for (let i = 0; i < this.props.scenario.steps.length; i++) {
            steps.push(this.stepItem(this.props.scenario.steps[i]));
        }

        return (
            <div>
                <h2>
                    <p>{this.props.feature.title}</p>
                    <blockquote>
                        <Text text={this.props.feature.description} />
                    </blockquote>
                </h2>

                <table className="table table-striped table-hover ">
                    <thead>
                        <tr>
                            <th>Status</th>
                            <th>Description</th>
                            <th>Progress</th>
                            <th>Success</th>
                            <th>Failed</th>
                            <th>Pending</th>
                        </tr>
                    </thead>
                    <tbody>{scenarios}</tbody>
                </table>
            </div>
        )
    }
}