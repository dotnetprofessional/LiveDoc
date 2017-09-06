import * as React from "react";
import * as model from "livedoc-model";
const Link = require("react-router-dom").Link;
import { ProgressBar } from "react-bootstrap";
import { StatusFlag, Text } from ".";

//import * as Bootstrap from "react-bootstrap";
//import * as Components from ".";

export class Feature extends React.Component<model.Feature, any> {

    scenarioItem(scenario: model.Scenario) {
        const stats = model.CalcStatistics.scenario(scenario);
        return (
            <tr>
                <td><StatusFlag status={stats.status} /></td>
                <td><Link to={`/scenario/${scenario.id}`}>{scenario.title}</Link></td>
                <td>
                    <ProgressBar>
                        <ProgressBar striped={true} bsStyle="success" now={stats.passedPercent} key={1} />
                        <ProgressBar bsStyle="warning" now={stats.failedPercent} key={2} />
                        <ProgressBar active={true} bsStyle="info" now={stats.pendingPercent} key={3} />
                    </ProgressBar>
                </td>
                <td>{stats.passed}</td>
                <td>{stats.failed}</td>
                <td>{stats.pending}</td>
            </tr>
        );
    }

    render() {
        const scenarios: any[] = [];
        for (let i = 0; i < this.props.scenarios.length; i++) {
            console.log("scenario:", this.props.scenarios[i]);
            scenarios.push(this.scenarioItem(this.props.scenarios[i]));
        }

        return (
            <div>
                <h2>
                    <p>{this.props.title}</p>
                    <blockquote>
                        <Text text={this.props.description} />
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
        );
    }
}