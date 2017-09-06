"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var CalcStatistics = (function () {
    function CalcStatistics() {
    }
    CalcStatistics.feature = function (feature) {
        var _this = this;
        var stats = new Statistics();
        feature.scenarios.forEach(function (scenario) {
            var scenarioStats = _this.scenario(scenario);
            stats.passed += scenarioStats.passed;
            stats.failed += scenarioStats.failed;
            stats.pending += scenarioStats.pending;
        });
        return stats;
    };
    CalcStatistics.scenario = function (scenario) {
        var stats = new Statistics();
        scenario.steps.forEach(function (step) {
            switch (step.status) {
                case exports.Status.Pass:
                    stats.passed++;
                    break;
                case exports.Status.Failed:
                    stats.failed++;
                    break;
                case exports.Status.Pending:
                    stats.pending++;
                    break;
                default:
                    break;
            }
        });
        return stats;
    };
    return CalcStatistics;
}());
exports.CalcStatistics = CalcStatistics;
var Feature = (function () {
    function Feature() {
        this.scenarios = [];
    }
    return Feature;
}());
exports.Feature = Feature;
var Scenario = (function () {
    function Scenario() {
        this.steps = [];
    }
    return Scenario;
}());
exports.Scenario = Scenario;
var Background = (function (_super) {
    __extends(Background, _super);
    function Background() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return Background;
}(Scenario));
exports.Background = Background;
var ScenarioOutline = (function (_super) {
    __extends(ScenarioOutline, _super);
    function ScenarioOutline() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.examples = [];
        return _this;
    }
    return ScenarioOutline;
}(Scenario));
exports.ScenarioOutline = ScenarioOutline;
var example = (function () {
    function example() {
    }
    return example;
}());
exports.example = example;
var StepDefinition = (function () {
    function StepDefinition() {
        this.error = new Exception();
    }
    return StepDefinition;
}());
exports.StepDefinition = StepDefinition;
var Exception = (function () {
    function Exception() {
    }
    return Exception;
}());
exports.Exception = Exception;
var Statistics = (function () {
    function Statistics() {
        this.passed = 0;
        this.failed = 0;
        this.pending = 0;
    }
    Object.defineProperty(Statistics.prototype, "status", {
        get: function () {
            if (this.failed !== 0) {
                return exports.Status.Failed;
            }
            else if (this.passed === 0 && this.pending > 0) {
                return exports.Status.Pending;
            }
            else if (this.passed > 0) {
                return exports.Status.Pass;
            }
            else {
                return exports.Status.Unknown;
            }
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Statistics.prototype, "total", {
        get: function () {
            return this.passed + this.failed + this.pending;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Statistics.prototype, "passedPercent", {
        get: function () {
            return this.calcPercent(this.passed);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Statistics.prototype, "failedPercent", {
        get: function () {
            return this.calcPercent(this.failed);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Statistics.prototype, "pendingPercent", {
        get: function () {
            return this.calcPercent(this.pending);
        },
        enumerable: true,
        configurable: true
    });
    Statistics.prototype.calcPercent = function (value) {
        if (this.total === 0) {
            return 0;
        }
        return value / this.total * 100;
    };
    return Statistics;
}());
exports.Statistics = Statistics;
exports.Status = {
    "Unknown": "Unknown",
    "Pass": "Pass",
    "Pending": "Pending",
    "Failed": "Failed"
};
