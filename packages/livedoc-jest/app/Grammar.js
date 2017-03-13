
(function () {
    function feature(n, d, f) {
        debugger;
        if (d) {
            n += "\n" + d;
        }
        describe("feature: " + n, f);
    };
}(this));


/*
let background = function (n) {
    return "background:\n" + n;
}

let feature = function (n, d, f) {
    debugger;
    if (d) {
        n += "\n" + d;
    }
    describe("feature: " + n, f);
};
let scenario = function (n, f) {
    describe("scenario: " + n, f);
};

let given = function (n, f) {
    describe("given: " + n, f);
};
let when = function (n, f) {
    describe("when: " + n, f);
};
let then = function (n, f) {
    it("then: " + n, f);
};
let and = function (n, f) {
    it("and: " + n, f);
};
let but = function (n, f) {
    it("but: " + n, f);
};
*/