require('chai').should();
import { feature, scenario, Given, When, Then, And } from "../../app/livedoc";

class ATM {
    private machineCash = 0;
    private accounts = {};

    deposit(account: string, amount: number) {
        this.machineCash += amount;
        if (!this.accounts[account]) {
            this.accounts[account] = 0;
        }
        this.accounts[account] += amount;
    }

    withDraw(account: string, amount: number): number {
        const accountBalance = this.accounts[account];
        accountBalance
        if (accountBalance >= amount && this.machineCash >= amount) {
            this.machineCash -= amount;
            this.accounts[account] -= amount;
            return amount;
        } else {
            throw TypeError("Insufficient funds");
        }

    }

    setStatus(account: string, status: string) {

    }

    addCash(amount: number) {
        this.machineCash += amount;
    }

    getBalance(account: string): number {
        return this.accounts[account];
    }
}

feature(`Account Holder withdraws cash

        Account Holders should be able to withdraw cash at any of the
        companies ATMs.

        Rules:
        * Account Holders should have a valid keycard
        * Have sufficient available funds
        * The ATM has the necessary funds
        `, (ctx) => {

        scenario("Account has sufficient funds", (ctx) => {
            let atm = new ATM();
            let cashReceived: number;
            let givenCtx: any;

            Given(`the account holders account has the following:
            | account | 12345 |
            | balance |   100 |
            | status  | valid |
        `, (ctx) => {
                    const accountHolder = ctx.step.tableAsEntity;
                    atm.setStatus(accountHolder.account, accountHolder.status);
                    atm.deposit(accountHolder.account, accountHolder.balance)
                    givenCtx = ctx.step;
                });

            And("the machine contains '1000' dollars", (ctx) => {
                atm.addCash(ctx.step.values[0]);
            });

            When("the Account Holder requests '20' dollars", (ctx) => {
                cashReceived = atm.withDraw(givenCtx.tableAsEntity.account, ctx.step.values[0]);
            });

            Then("the ATM should dispense '20' dollars", (ctx) => {
                cashReceived.should.be.equal(ctx.step.values[0]);
            });

            And("the account balance should be '80' dollars", (ctx) => {
                atm.getBalance(givenCtx.tableAsEntity.account).should.be.equal(ctx.step.values[0]);
            });
        });
    });
