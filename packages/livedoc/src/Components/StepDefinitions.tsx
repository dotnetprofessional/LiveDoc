import * as React from "react";
import * as model from "livedoc-model";
// import * as Bootstrap from "react-bootstrap";
import { Text, View } from ".";

export class StepDefinition extends React.Component<model.StepDefinition, any> {

    render() {
        let result = <Text text={this.props.type + ":"} ><Text text={this.props.title} /></Text>;
        return (
            <span>{result}</span>
        );
    }
}

export class StepDefinitions extends React.Component<model.StepDefinition[], any> {

    render() {
        let stepItems: Object[] = [];
        this.props.forEach(step => {
            const item = <StepDefinition {...step} />;
            stepItems.push(item);
        });

        return (
            <View>
                {stepItems}
            </View>
        );
    }
}