require('chai').should();

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
        `, () => {

        scenario("Account has sufficient funds", () => {
            let atm = new ATM();
            let cashReceived: number;

            given(`the account holders account has the following:
            | account | 12345 |
            | balance | 100   |
            | status  | valid |
        `, () => {
                    const accountHolder = stepContext.tableAsEntity;
                    atm.setStatus(accountHolder.account, accountHolder.status);
                    atm.deposit(accountHolder.account, accountHolder.balance)
                });

            and("the machine contains '1000' dollars", () => {
                atm.addCash(stepContext.values[0]);
            });

            when("the Account Holder requests '20' dollars", () => {
                cashReceived = atm.withDraw(scenarioContext.given.tableAsEntity.account, stepContext.values[0]);
            });

            then("the ATM should dispense '20' dollars", () => {
                cashReceived.should.be.equal(stepContext.values[0]);
            });

            and("the account balance should be '80' dollars", () => {
                atm.getBalance(scenarioContext.given.tableAsEntity.account).should.be.equal(stepContext.values[0]);
            });
        });
    });
