# LiveDoc for xUnit - Getting Started

This guide will help you get started with LiveDoc for xUnit, bringing BDD-style testing to C#.

## Installation

```bash
cd samples
dotnet restore
dotnet build
```

## Running the Sample

```bash
dotnet test ShippingSample.csproj
```

## Expected Output

You should see output like this in your test results:

```
  Feature: Beautiful Tea Shipping Costs

    Scenario: Free shipping in Australia
      Given the customer is from Australia
      When the customer's order totals $100
      Then the customer pays GST
        and they are charged Free shipping
      
      ✓ 4 passing (12ms)

    Scenario Outline: Calculate GST status and shipping rate
      Example: Australia, 99.99, 9.999, Standard Domestic
        Given the customer is from Australia
        When the customer's order totals 99.99
        Then the customer pays 9.999 GST
          and they are charged the Standard Domestic shipping rate
      
      ✓ 4 passing (8ms)
```

## Visual Studio Test Explorer

In Visual Studio's Test Explorer, you'll see:

```
📁 ShippingCostsTests
  ✅ Free_shipping_in_Australia
  ✅ Standard_shipping_in_Australia_for_orders_under_100_dollars
  ✅ International_shipping_for_overseas_customers
  ✅ Calculate_GST_and_shipping(CustomerCountry: "Australia", OrderTotal: 99.99, ...)
  ✅ Calculate_GST_and_shipping(CustomerCountry: "Australia", OrderTotal: 100.00, ...)
  ✅ Calculate_GST_and_shipping(CustomerCountry: "New Zealand", OrderTotal: 99.99, ...)
  ✅ Calculate_GST_and_shipping(CustomerCountry: "New Zealand", OrderTotal: 100.00, ...)
  ✅ Calculate_GST_and_shipping(CustomerCountry: "Zimbabwe", OrderTotal: 100.00, ...)
```

## Key Features Demonstrated

### 1. Clean Syntax
No `_ctx` prefix, just plain `Given`, `When`, `Then`:

```csharp
Given("the customer is from Australia", () => { ... });
```

### 2. Readable Test Names
Method names auto-format to readable scenarios:
- `Free_shipping_in_Australia` → "Free shipping in Australia"

### 3. ScenarioOutline with Positional Parameters
```csharp
[Example("Australia", 100.00, 10.00, "Free")]
```
Values must match test method parameter order.

### 4. Placeholder Replacement
```csharp
Given("the customer is from <CustomerCountry>", () => { ... });
```
Automatically replaces `<CustomerCountry>` with the actual value in the output.

### 5. Perfect Debugging
Press F11 to step directly into your lambda expressions. No generated code to navigate through.

## Next Steps

1. Try modifying the test scenarios
2. Add new examples to the scenario outline
3. Create your own feature tests following this pattern
4. Use tags for test filtering (coming soon)
