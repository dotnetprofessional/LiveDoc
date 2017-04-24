import * as React from "react";
import { Header } from "./Components/Header";
import { FeatureSummary } from "./Components/FeatureSummary";

export class HomeScreen extends React.Component<any, any> {
    render() {
        console.log("HS:", this.props.features);
        return (
            <div>
                <Header />
                <FeatureSummary features={this.props.features} />
            </div>
        );
    }
}