using SweDevTools.LiveDoc.xUnit;
using Xunit;
using Xunit.Abstractions;

namespace Acme.Orders
{
    [Specification("Declared namespace context")]
    [Tag("namespace-paths")]
    public sealed class NamespaceContext : SpecificationTest
    {
        public NamespaceContext(ITestOutputHelper output) : base(output) { }

        [Rule("The declared namespace is 'Acme.Orders'")]
        public void Declared_namespace_is_reported()
        {
            Assert.Equal(Rule.Values[0].AsString(), GetType().Namespace);
        }
    }

    [Specification("Declared namespace fallback")]
    [Tag("namespace-paths")]
    public sealed class NamespaceFallback
    {
        [Fact]
        public void Declared_namespace_matches_the_context_class()
        {
            Assert.Equal(typeof(NamespaceContext).Namespace, GetType().Namespace);
        }
    }
}

namespace Acme.Orders.Payments
{
    public sealed class Outer
    {
        [Specification("Nested namespace context")]
        [Tag("namespace-paths")]
        public sealed class NestedContext : SpecificationTest
        {
            public NestedContext(ITestOutputHelper output) : base(output) { }

            [Rule("The nested class namespace is 'Acme.Orders.Payments'")]
            public void Declared_namespace_is_reported()
            {
                Assert.Equal(Rule.Values[0].AsString(), GetType().Namespace);
            }
        }

        [Trait("Category", "namespace-paths")]
        public sealed class NestedFallback
        {
            [Fact]
            public void Declared_namespace_matches_the_nested_context_class()
            {
                Assert.Equal(typeof(NestedContext).Namespace, GetType().Namespace);
            }
        }
    }
}

namespace Elsewhere.Inventory
{
    [Specification("Independent namespace branch")]
    [Tag("namespace-paths")]
    public sealed class InventoryContext : SpecificationTest
    {
        public InventoryContext(ITestOutputHelper output) : base(output) { }

        [Rule("The declared namespace is 'Elsewhere.Inventory'")]
        public void Declared_namespace_is_reported()
        {
            Assert.Equal(Rule.Values[0].AsString(), GetType().Namespace);
        }
    }
}

[Specification("Namespace-free context")]
[Tag("namespace-paths")]
public sealed class NamespaceFreeContext : SpecificationTest
{
    public NamespaceFreeContext(ITestOutputHelper output) : base(output) { }

    [Rule("The namespace-free class reports namespace ''")]
    public void No_namespace_is_reported()
    {
        Assert.Equal(Rule.Values[0].AsString(), GetType().Namespace ?? "");
    }
}

[Trait("Category", "namespace-paths")]
public sealed class NamespaceFreeFallback
{
    [Fact]
    public void No_namespace_matches_the_context_class()
    {
        Assert.Equal(typeof(NamespaceFreeContext).Namespace, GetType().Namespace);
    }
}
