import * as React from "react";
import * as model from "livedoc-model";
import * as Bootstrap from "react-bootstrap";

export class StatusFlagProps {
    public status: string;
}

export class StatusFlag extends React.Component<StatusFlagProps, any> {

    render() {
        let style;

        switch (this.props.status) {
            case model.Status.Pass:
                style = "success";
                break;
            case model.Status.Failed:
                style = "danger";
                break;
            case model.Status.Pending:
                style = "info";
                break;
            default:
                style = "default";
        }
        return (
            <h4><Bootstrap.Label bsStyle={style}>{this.props.status}</Bootstrap.Label></h4>
        );
    }

}