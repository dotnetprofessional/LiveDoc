import * as React from "react";
import { Table, ProgressBar } from "react-bootstrap";
import { FeatureSummaryProps } from "./FeatureSummaryProps";
import * as model from "../model/Feature";

export class FeatureSummary extends React.Component<FeatureSummaryProps, any> {

    featureItem(feature: model.Feature) {
        return (
            <tr>
                <td>{feature.status}</td>
                <td>{feature.title}</td>
                <td>  <ProgressBar>
                    <ProgressBar striped bsStyle="success" now={feature.statistics.passed} key={1} />
                    <ProgressBar bsStyle="warning" now={feature.statistics.failed} key={2} />
                    <ProgressBar active bsStyle="info" now={feature.statistics.pending} key={3} />
                </ProgressBar>
                </td>
                <td>{feature.scenarios.length}</td>
                <td>{feature.statistics.passed}</td>
                <td>{feature.statistics.failed}</td>
                <td>{feature.statistics.pending}</td>
            </tr>
        );
    }


    render() {
        const features: any[] = [];
        console.log("FS:", this.props.features[0].statistics);
        for (let i = 0; i < this.props.features.length; i++) {
            console.log("feature:", this.props.features[i]);
            features.push(this.featureItem(this.props.features[i]));
        }

        console.log(features.length);
        return (
            <Table responsive>
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