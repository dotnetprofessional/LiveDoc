// describe("Describe still functions the same as native mocha", () => {
//     it("throwing exception in it will result in fail", () => {
//         throw new TypeError("Bail...");
//     });

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

//     describe("second nested describe", () => {
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
