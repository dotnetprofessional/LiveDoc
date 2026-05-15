import { feature, scenario, given, when, Then as then, and } from "../../app/livedoc";
import { expect } from "vitest";

type AccountStatus = "valid" | "invalid";

type AccountRecord = {
    balance: number;
    status: AccountStatus;
};

class ATM {
    private machineCash = 0;
    private accounts: Record<string, AccountRecord> = {};

    openAccount(account: string, balance: number, status: AccountStatus): void {
        this.accounts[account] = { balance, status };
    }

    withdraw(account: string, amount: number): number {
        const accountRecord = this.accounts[account];
        if (!accountRecord) {
            throw TypeError("Account not found");
        }

        if (accountRecord.status !== "valid") {
            throw TypeError("Invalid keycard");
        }

        if (accountRecord.balance < amount || this.machineCash < amount) {
            throw TypeError("Insufficient funds");
        }

        this.machineCash -= amount;
        accountRecord.balance -= amount;
        return amount;
    }

    addCash(amount: number): void {
        this.machineCash += amount;
    }

    getBalance(account: string): number {
        const accountRecord = this.accounts[account];
        if (!accountRecord) {
            throw TypeError("Account not found");
        }

        return accountRecord.balance;
    }
}

feature(`Account Holder withdraws cash
        @showcase @public-doc @cash-withdrawal

        Account Holders should be able to withdraw cash at any of the
        company's ATMs.

        Rules:
        * Account Holders should have a valid keycard
        * Have sufficient available funds
        * The ATM has the necessary funds
        `, (ctx) => {

        scenario("Account has sufficient funds", () => {
            let atm = new ATM();
            let cashReceived: number;
            let accountId: string;

            given(`the account holders account has the following:
            | account | 12345 |
            | balance |   100 |
            | status  | valid |
        `, (ctx) => {
                    const accountHolder = ctx.step.tableAsEntity as {
                        account: string;
                        balance: number;
                        status: AccountStatus;
                    };
                    accountId = accountHolder.account;
                    atm.openAccount(accountHolder.account, accountHolder.balance, accountHolder.status);
                });

            and("the machine contains '1000' dollars", (ctx) => {
                atm.addCash(ctx.step.values[0]);
            });

            when("the Account Holder requests '20' dollars", (ctx) => {
                cashReceived = atm.withdraw(accountId, ctx.step.values[0]);
            });

            then("the ATM should dispense '20' dollars", (ctx) => {
                expect(cashReceived).toBe(ctx.step.values[0]);
            });

            and("the account balance should be '80' dollars", (ctx) => {
                expect(atm.getBalance(accountId)).toBe(ctx.step.values[0]);
            });
        });
    });
