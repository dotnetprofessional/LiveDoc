# Tutorial
For those getting starting with Gherkin, it can be a bit to take in. There's plenty of information on internet about Cucumber, Specflow and Gherkin, and most of it is relevant to livedoc-mocha. However, it can still be a little confusing to start. This brief tutorial is designed to get you up and running quickly. It can also be used as a starting point for your team to get up to speed writing tests using this style.

> To help explain how to use livedoc-mocha, I'll be using the same example that was presented by [Alister Scott](https://www.thoughtworks.com/profiles/alister-scott) in his article [Specification by Example: a Love Story](https://watirmelon.blog/2011/05/18/specification-by-example-a-love-story/), which is a recommended read. This tutorial provides an alternative approach to the same lessons.

Let assume we have a shipping company in Australia that wants to ship tea. The business comes to you and explains that they need to following implemented on their website:

_We need to charge a different amount for our customers overseas to what we do here in Australia. The tax office tells us we have to charge GST for Australian customers but not for our overseas ones. So we need to add this to our shopping cart. Also, we got a great deal with a local shipping company so we can ship to anywhere in Australia for free if they spend more than AUD$100, but we still have to charge the overseas customers._

You've read that using Gherkin is a great way to test these features. You've also ready that there are the following parts to a Gherkin spec.

* feature
* scenario
* steps (given, when, then)

This tutorial will talk you through each of these parts for the above requirements. So lets see how that looks...

## Features
It all starts with a feature, and a feature is something that describes a benefit to the users of your application. Its written in the terms of the business and not in technical terms. This is probably one of the hardest aspects for people new to this style to grok, as developers tend to think in technical terms rather than those of the business. Now its actually better if you have your business stakeholders work with you when creating them.

Those just starting with Gherkin may go with this as the feature:

``` gherkin
Feature: Add additional shipping options to shopping cart
```

The above feature does describe what the owner requested, as the requirement was to add additional shipping options. However, it doesn't really convey the reasoning of why the business wants this. Its also quite focussed on the technical aspects, rather than the business ones.

An alternative would be to write the following using the language of the business:

``` gherkin
Feature: Beautiful Tea Shipping Costs

    * Australian customers pay GST
    * Overseas customers don’t pay GST
    * Australian customers get free shipping for orders $100 and above
    * Overseas customers all pay the same shipping rate regardless of order size
```

Notice that this version actually doesn't mention a website, or anything technical at all. Instead its focussed on the business needs. At this point, there's been no decision about how this might be implemented. Also reading this feature, you would walk away with a fairly good understanding of how shipping cost are calculated for this company.

## Scenarios
Now that we have our feature, we need some scenarios. Scenarios describe the actions that the user or system take to some event. The scenarios then have a set of steps that describe how to accomplish the scenario. These are written as <code>given</code>, <code>when</code>, <code>then</code> statements. Here is a brief description of each:

* given: steps are used to describe the initial context of the system. It is typically something that happened in the _past_.
* when: steps are used to describe an event, or an action. This can be a person interacting with the system, or it can be an event triggered by another system.
* then: steps are used to describe an expected outcome, or result.

There are also additional <code>and</code> and <code>but</code> statements. These are used after one of the previous commands, and are really used to make it easier to read. The system actually treats all of them the same way.

Back to our example, you may at first come up with a scenario that look like the following:

``` gherkin
Scenario: Free shipping in Australia
``` gherkin
Scenario: Free shipping in Australia
  Given I am on the Beautiful Tea home page
  When I search for ‘Byron Breakfast’ tea
  Then I see the page for ‘Byron Breakfast’ tea
  When I add ‘Byron Breakfast’ tea to my cart
    And I select 10 as the quantity
  Then I see 10 x ‘Byron Breakfast’ tea in my cart
  When I select ‘Check Out’
    And I enter my country as ‘Australia’
  Then I see the total including GST
    And I see that I am eligible for free shipping

Scenario: No free shipping outside Australia
...

Scenario: No free shipping in Australia
...
```

> The last two scenarios were omitted for brevity as they would look very similar

Again this style (which is common) is very technical and doesn't really explain _what_ the business needs are, rather it focuses on the _how_. You could attempt to decipher this and make assumptions about what it means that the customer selected Australia and so pays GST. However, its not clear why the customer received free shipping.

Taking a different approach and focusing on the business needs rather than the technical ones, might lead you to a rather different set of scenarios:

``` gherkin
Scenario Outline: Calculate GST status and shipping rate

Given the customer is from <customer’s country>
When the customer’s order totals <order total>
Then the customer <pays GST>
  And they are charged <shipping rate>

Examples:

    | customer’s country  | GSTamount  | order total  | shipping rate           |
    | Australia           |      9.999 |        99.99 | Standard Domestic       |
    | Australia           |      10.00 |       100.00 | Free                    |
    | New Zealand         |          0 |        99.99 | Standard International  |
    | New Zealand         |          0 |       100.00 | Standard International  |
    | Zimbabwe            |          0 |       100.00 | Standard International  |
```

This style provides a number of benefits, namely that its very clear how GST is calculated and who is eligible for free shipping and _why_. Using a feature in Gherkin called _Scenario Outlines_ a set of examples were used to describe the different combinations without having to write them all out, as was the case in the more technical version.

This would result in the final feature being defined as the following:

``` Gherkin
Feature: Beautiful Tea Shipping Costs

    * Australian customers pay GST
    * Overseas customers don’t pay GST
    * Australian customers get free shipping for orders $100 and above
    * Overseas customers all pay the same shipping rate regardless of order size

Scenario Outline: Calculate GST status and shipping rate

Given the customer is from <customer’s country>
When the customer’s order totals <order total>
Then the customer <pays GST>
  And they are charged <shipping rate>

Examples:

    | customer’s country  | GSTamount  | order total  | shipping rate           |
    | Australia           |      9.999 |        99.99 | Standard Domestic       |
    | Australia           |      10.00 |       100.00 | Free                    |
    | New Zealand         |          0 |        99.99 | Standard International  |
    | New Zealand         |          0 |       100.00 | Standard International  |
    | Zimbabwe            |          0 |       100.00 | Standard International  |
```

This version of the requirements, can now be used for both validation of the system, but also serve as documentation which __anyone__ on the team can understand.

## livedoc-mocha
Having arrived at our feature and scenarios, implementing them in livedoc-mocha is quite straightforward as it follows the Gherkin layout quite closely.

### Features
Taking the example and converting the feature would result in the following code:

```js
feature(`Feature: Beautiful Tea Shipping Costs

    * Australian customers pay GST
    * Overseas customers don’t pay GST
    * Australian customers get free shipping for orders $100 and above
    * Overseas customers all pay the same shipping rate regardless of order size`, () => { });
```

Points to note here are that the back tick (`) is used support multi-line descriptions.

### Scenarios
Next adding scenarios are done is a similar fashion with each scenario being a child function of the feature function. This gives us the following:

```js
feature(`Feature: Beautiful Tea Shipping Costs

    * Australian customers pay GST
    * Overseas customers don’t pay GST
    * Australian customers get free shipping for orders $100 and above
    * Overseas customers all pay the same shipping rate regardless of order size`, () => {

        scenarioOutline("Calculate GST status and shipping rate", () => {

        });
    });
```

### Steps
Each scenario must have a set of steps to execute, this is where the actual testing begins. If you're coming from a TDD or more traditional unit testing background and are familiar with the AAA syntax (Arrange, Act, Assert). Then you can translate those to the following step definitions:

* Arrange: Given
* Act: When
* Assert: Then

Translating our feature's steps into code would look like the following:

```js
scenarioOutline(`Calculate GST status and shipping rate

    Examples:

    | customer’s country  | GST_amount  | order total  | shipping rate           |
    | Australia           |      9.999 |        99.99 | Standard Domestic       |
    | Australia           |      10.00 |       100.00 | Free                    |
    | New Zealand         |          0 |        99.99 | Standard International  |
    | New Zealand         |          0 |       100.00 | Standard International  |
    | Zimbabwe            |          0 |       100.00 | Standard International  |
`, () => {
        const cart = new ShoppingCart();

        given("the customer is from <customer’s country>", () => {
            cart.country = scenarioOutlineContext.example["customer’s country"];
        });

        when("the customer’s order totals <order total>", () => {
            const item = new CartItem();
            item.quantity = 1;
            item.price = scenarioOutlineContext.example["order total"];
            item.product = "tea";
            cart.items.push(item);
            cart.calculateInvoice();
        });

        then("the customer <pays GST>", () => {
            cart.gst.should.be.equal(Number(scenarioOutlineContext.example.GST_amount);
        });

        and("they are charged <shipping rate>", () => {
            const rate = shippingRates[scenarioOutlineContext.example["shipping rate"].replace(" ", "")];
            cart.shipping.should.be.equal(rate);
        });
    });
```

This example shows that using the array indexer of the scenarioOutline, you can use any type of name. However, if you use names that are can be valid property names like the GST_amount header, then you can also use the dot syntax as shown in the <code>then</code> function.

This has been a brief tutorial on how to write specifications using livedoc-mocha. For more details on how to use livedoc-mocha refer to the [API reference](API.md) documentation.

You can find the full source code for this [example here](../_src/test/Tutorial.Spec.ts).