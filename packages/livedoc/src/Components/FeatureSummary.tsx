import * as React from "react";
import { Table, ProgressBar } from "react-bootstrap";
import { FeatureSummaryProps } from "./FeatureSummaryProps";
import * as model from "livedoc-model";
import { StatusFlag } from ".";
const Link = require("react-router-dom").Link;

export class FeatureSummary extends React.Component<FeatureSummaryProps, any> {

    featureItem(feature: model.Feature) {
        const stats = model.CalcStatistics.feature(feature);
        return (
            <tr>
                <td><StatusFlag status={stats.status} /></td>
                <td><Link to={`/feature/${feature.id}`}>{feature.title}</Link></td>
                <td>
                    <ProgressBar>
                        <ProgressBar striped={true} bsStyle="success" now={stats.passedPercent} key={1} />
                        <ProgressBar bsStyle="warning" now={stats.failedPercent} key={2} />
                        <ProgressBar active={true} bsStyle="info" now={stats.pendingPercent} key={3} />
                    </ProgressBar>
                </td>
                <td>{feature.scenarios.length}</td>
                <td>{stats.passed}</td>
                <td>{stats.failed}</td>
                <td>{stats.pending}</td>
            </tr>
        );
    }

    render() {
        const features: any[] = [];
        for (let i = 0; i < this.props.features.length; i++) {
            console.log("feature:", this.props.features[i]);
            features.push(this.featureItem(this.props.features[i]));
        }

        console.log(features.length);
        return (
            <Table responsive >
                <thead>
                    <tr>
                        <th>Status</th>
                        <th>Name</th>
                        <th>Progress</th>
                        <th>Scenarios</th>
                        <th>Success</th>
                        <th>Failed</th>
                        <th>Pending</th>
                    </tr>
                </thead>
                <tbody>{features}</tbody>
            </Table>
        )
    }
}