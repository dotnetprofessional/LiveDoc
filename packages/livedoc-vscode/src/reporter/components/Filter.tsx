import * as React from "react";
import * as ReactDOM from "react-dom";
import { StyleSheet, css } from "aphrodite/no-important";

import { CollapsableWithTitle } from "./Collapsable";
import * as model from "livedoc-mocha/model";

export class Filter extends React.PureComponent<
    {
        applyFilter: (filterFn: (featureOrScenario: model.Feature | model.Scenario) => boolean) => void;
    },
    {
        strings?: string[];
        tags?: string[];
    }> {

    private _refs: { [key: string]: HTMLElement } = {};

    public constructor(props) {
        super(props);

        this.state = {
            strings: [],
            tags: []
        };

        this.setRef = this.setRef.bind(this);
        this.addString = this.addString.bind(this);
    }

    private setRef(key: string, ref: HTMLElement) {
        this._refs[key] = ref;
    }

    public render() {
        return (
            <CollapsableWithTitle title="Filter">
                <div className={css(Filter.styles.flexibleRow)}>
                    <div className={css(Filter.styles.flexible, Filter.styles.flex)}>
                        <div className={css(Filter.styles.flexibleRow, Filter.styles.flex)}>
                            <label htmlFor="search-text" className={css(Filter.styles.inputLabel, Filter.styles.block)}>Search</label>
                            <input ref={this.setRef.bind(null, "search-text")} id="search-text" type="text" className={css(Filter.styles.flex)} />
                            <button onClick={this.addString.bind(this, "search-text", "strings")}>Add</button>
                        </div>
                        {
                            this.state.strings.map(s => {
                                return (
                                    <div>
                                        <span>{s}</span>
                                        <a href="javascript:void(0)" onClick={() => {
                                            const stringIndex = this.state.strings.indexOf(s);
                                            const newStrings = this.state.strings.slice(0, stringIndex).concat(this.state.strings.slice(stringIndex + 1));
                                            this.setState({
                                                strings: newStrings
                                            }, () => {
                                                this.applyFilter();
                                            });
                                        }}>-</a>
                                    </div>
                                );
                            })
                        }
                    </div>
                    <div className={css(Filter.styles.flexible, Filter.styles.flex)}>
                        <div className={css(Filter.styles.flexibleRow, Filter.styles.flex)}>
                            <label htmlFor="search-tag" className={css(Filter.styles.inputLabel, Filter.styles.block)}>Tags</label>
                            <input ref={this.setRef.bind(null, "tag-text")} id="search-tag" type="text" className={css(Filter.styles.flex)} />
                            <button onClick={this.addString.bind(this, "tag-text", "tags")}>Add</button>
                        </div>
                        {
                            this.state.tags.map(s => {
                                return (
                                    <div>
                                        <span>{s}</span>
                                        <a href="javascript:void(0)" onClick={() => {
                                            const tagIndex = this.state.tags.indexOf(s);
                                            const newTags = this.state.tags.slice(0, tagIndex).concat(this.state.tags.slice(tagIndex + 1));
                                            this.setState({
                                                tags: newTags
                                            }, () => {
                                                this.applyFilter();
                                            });
                                        }}>-</a>
                                    </div>
                                );
                            })
                        }
                    </div>
                    <div>
                        <button onClick={this.clearCriteria.bind(this)}>Clear</button>
                    </div>
                </div>
            </CollapsableWithTitle>
        );
    }

    private clearCriteria() {
        this.setState({
            strings: [],
            tags: []
        }, () => {
            this.applyFilter();
        });
    }

    private addString(inputKey: string, stateKey: string) {
        const input = this._refs[inputKey] as HTMLInputElement;
        if (input) {
            if (this.state[stateKey].indexOf(input.value) > -1) {
                return;
            }
            const newStrings = this.state[stateKey].concat([input.value]);
            input.value = "";

            this.setState({
                [stateKey]: newStrings
            }, () => {
                this.applyFilter();
            });
        }
    }

    private applyFilter() {
        const filterFn = featureOrScenario => {
            return (
                this.state.strings.length === 0
                || this.state.strings.some(s => {
                    const stringRegex = new RegExp(s, "i");
                    return stringRegex.test(featureOrScenario.title) || stringRegex.test(featureOrScenario.description);
                })
            )
                && (
                    this.state.tags.length === 0
                    || this.state.tags.some(filterTag => {
                        if (filterTag.endsWith("*")) {
                            filterTag = "^" + filterTag.replace("*", "");
                        } else {
                            filterTag = "^" + filterTag + "$";
                        }
                        const tagRegex = new RegExp(filterTag, "i");
                        return featureOrScenario.tags.some(tag => tagRegex.test(tag));
                    })
                );
        };
        const namedFilterFn = function filter(featureOrScenario: model.Feature | model.Scenario) {
            return filterFn(featureOrScenario);
        };

        this.props.applyFilter(namedFilterFn);
    }

    private static styles = StyleSheet.create({
        block: {
            display: "block"
        },
        flexible: {
            display: "flex",
            flexFlow: "column nowrap",
            alignItems: "stretch",
            justifyContent: "flex-start"
        },
        flexibleRow: {
            display: "flex",
            flexFlow: "row",
            padding: "5px 10px",
            alignItems: "flex-start",
            justifyContent: "flex-start"
        },
        flex: {
            flex: "1 1 auto"
        },
        inputLabel: {
            marginRight: 10
        },
        expandable: {
            overflow: "hidden"
        },
        collapsed: {
            height: 0
        }
    });
};