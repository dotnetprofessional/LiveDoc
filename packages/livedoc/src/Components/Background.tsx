import * as React from "react";
import * as model from "livedoc-model";

//import * as Bootstrap from "react-bootstrap";
import { Text } from ".";

export class Scenario extends React.Component<model.Background, any> {
    render() {
        return (
            <div>
                <h2>
                    <h3>Background:</h3>
                    <Text text={this.props.title} />
                </h2>

            </div>
        )
    }
}