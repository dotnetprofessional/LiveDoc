import { Describe } from "./model/Describe";


/**
 * This is used to store the current state of the executing test for bdd style tests
 * 
 * @class BddContext
 */
export class BddContext {
    parent: BddContext;
    type: string;
    describe: Describe;
    child: Describe;
}