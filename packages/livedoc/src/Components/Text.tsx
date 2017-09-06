import * as React from "react";

export class TextProps {
    text: string;
}
export class Text extends React.Component<TextProps, any> {
    render() {
        return (
            <p style={{ whiteSpace: "pre-wrap" }}>
                {this.props.text}
                {this.props.children}
            </p >
        );
    }
}