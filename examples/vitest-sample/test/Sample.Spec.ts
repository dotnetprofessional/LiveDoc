import { expect } from 'chai';
import { feature, scenario, given, and, when, Then as then } from "@livedoc/vitest";

class ATM {
    private machineCash = 0;
    private accounts: Record<string, number> = {};

    deposit(account: string, amount: number) {
        this.machineCash += amount;
        if (!this.accounts[account]) {
            this.accounts[account] = 0;
        }
        this.accounts[account] += amount;
    }

    withDraw(account: string, amount: number): number {
        const accountBalance = this.accounts[account];
        if (accountBalance >= amount && this.machineCash >= amount) {
            this.machineCash -= amount;
            this.accounts[account] -= amount;
            return amount;
        } else {
            throw TypeError("Insufficient funds");
        }
    }

    setStatus(_account: string, _status: string) {
        // Status tracking would go here
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
        `, () => {

        scenario("Account has sufficient funds", () => {
            let atm = new ATM();
            let cashReceived: number;
            let accountNumber: string;

            given(`the account holders account has the following:
            | account | 12345 |
            | balance |   100 |
            | status  | valid |
        `, (ctx) => {
                    const accountHolder = ctx.step.tableAsEntity;
                    accountNumber = accountHolder.account;
                    atm.setStatus(accountHolder.account, accountHolder.status);
                    atm.deposit(accountHolder.account, Number(accountHolder.balance));
                });

            and("the machine contains '1000' dollars", (ctx) => {
                atm.addCash(ctx.step.values[0]);
            });

            when("the Account Holder requests '20' dollars", (ctx) => {
                cashReceived = atm.withDraw(accountNumber, ctx.step.values[0]);
            });

            then("the ATM should dispense '20' dollars", (ctx) => {
                expect(cashReceived).to.equal(ctx.step.values[0]);
            });

            and("the account balance should be '80' dollars", (ctx) => {
                expect(atm.getBalance(accountNumber)).to.equal(ctx.step.values[0]);
            });
        });
    });
