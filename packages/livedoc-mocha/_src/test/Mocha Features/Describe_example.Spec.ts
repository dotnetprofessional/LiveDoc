// debugger;
// it("************************* this is an it outside of a describe", () => { });

// describe("Describe still functions the same as native mocha", () => {

//     it("throwing exception in it will result in fail", () => {
//         throw new TypeError("Bail...");
//     });

//     debugger;
//     describe("first nested describe", () => {
//         it("will execute and pass", () => {

//         });

//         it.skip("will be skipped and marked as pending", () => {
//             throw new Error("I shouldn't have been executed!!");
//         });

//         context("a context is nested within a describe", () => {
//             it("will execute and pass", () => {
//             });
//         });
//     });

//     debugger;
//     describe("second nested describe", () => {
//         before(() => {
//             debugger;
//             it("****** This will be associated wit the root suite not this one!", () => {
//                 debugger;
//                 console.log("I was executed, just not recorded!");
//             });
//         });


//         debugger;
//         it("will execute and pass", () => {
//             const expected = { field1: "Hello", field2: "world" };
//             const actual = { field1: "Goodbye", field2: "world" };
//             //"hello world".should.be.eq("goodbye world");

//             actual.should.be.eq(expected);
//         });

//         it.skip("will be skipped and marked as pending", () => {
//             throw new Error("I shouldn't have been executed!!");
//         });

//         context("a context is nested within a describe", () => {
//             it("will execute and pass", () => {
//                 // throw new TypeError("Bail...");
//             });
//         });
//     });
// });
