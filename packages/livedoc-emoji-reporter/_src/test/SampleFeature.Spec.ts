feature(`Sample Feature`, () => {

    scenario("Sample scenario 1", () => {
        given(`dummy step`, () => {

        });
    });

    scenario("Sample scenario 2", () => {
        given(`dummy step`, () => {

        });
    });
    scenario("Sample scenario 3", () => {
        given(`dummy step`, () => {
            throw Error("expected");
        });
    });
    scenario("Sample scenario 4", () => {
        given(`dummy step`, () => {

        });
    });

});