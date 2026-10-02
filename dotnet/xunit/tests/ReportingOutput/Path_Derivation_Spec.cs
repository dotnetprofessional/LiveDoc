using System.Reflection;
using System.Reflection.Emit;
using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Reporter;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.ReportingOutput;

[Specification("Namespace Navigation Paths", Description = @"
    Declared namespaces keep documentation in the same hierarchy when a test assembly is renamed.")]
[Tag("reporting, namespace-paths")]
public class Path_Derivation_Spec : SpecificationTest
{
    public Path_Derivation_Spec(ITestOutputHelper output) : base(output)
    {
    }

    [RuleOutline("Class '<className>' in assembly '<assemblyName>' reports path '<expectedPath>'")]
    [Example("Acme.Orders.Checkout", "Acme.Orders", "Acme/Orders/Checkout.cs")]
    [Example("Acme.Orders.Checkout", "Unrelated.Library", "Acme/Orders/Checkout.cs")]
    [Example("Vendor.Acme.Orders.Checkout", "Acme.Orders", "Vendor/Acme/Orders/Checkout.cs")]
    [Example("Acme.OrdersExtra.Checkout", "Acme.Orders", "Acme/OrdersExtra/Checkout.cs")]
    [Example("Elsewhere.Inventory.Stock", "Acme.Orders", "Elsewhere/Inventory/Stock.cs")]
    [Example("Acme.Orders.Payments.Outer+Inner", "Acme.Orders", "Acme/Orders/Payments/Outer+Inner.cs")]
    [Example("Checkout", "Acme.Orders", "Checkout.cs")]
    [Example("Acme.Orders.Checkout", "", "Acme/Orders/Checkout.cs")]
    public void Named_class_paths_preserve_namespaces(string className, string assemblyName, string expectedPath)
    {
        Assert.Equal(expectedPath, LiveDocTestRunReporter.DerivePathFromNames(className, assemblyName));
    }

    [Rule("Class 'Acme.Orders.Checkout' in assemblies 'Acme.Orders' and 'Unrelated.Library' reports 'Acme/Orders/Checkout.cs'")]
    public void Reflected_class_paths_are_independent_of_assembly_name()
    {
        var (className, firstAssembly, secondAssembly, expectedPath) = Rule.Values.As<string, string, string, string>();
        var firstType = CreateType(firstAssembly, className);
        var secondType = CreateType(secondAssembly, className);
        Assert.NotEqual(firstType.Assembly.GetName().Name, secondType.Assembly.GetName().Name);
        Assert.Equal(firstType.Namespace, secondType.Namespace);
        Assert.Equal(expectedPath, LiveDocTestRunReporter.DerivePath(firstType));
        Assert.Equal(expectedPath, LiveDocTestRunReporter.DerivePath(secondType));
    }

    [Rule("Namespace-free class 'Checkout' in assembly 'Acme.Orders' reports 'Checkout.cs'")]
    public void Namespace_free_classes_remain_at_the_document_root()
    {
        var (className, assemblyName, expectedPath) = Rule.Values.As<string, string, string>();
        var type = CreateType(assemblyName, className);
        Assert.Null(type.Namespace);
        Assert.Equal(expectedPath, LiveDocTestRunReporter.DerivePath(type));
    }

    [Rule("Nested class 'Acme.Orders.Outer+Inner' in assembly 'Acme.Orders' reports 'Acme/Orders/Outer+Inner.cs'")]
    public void Nested_types_do_not_add_class_names_to_namespace_folders()
    {
        var (className, assemblyName, expectedPath) = Rule.Values.As<string, string, string>();
        var assembly = AssemblyBuilder.DefineDynamicAssembly(new AssemblyName(assemblyName), AssemblyBuilderAccess.RunAndCollect);
        var module = assembly.DefineDynamicModule(assemblyName);
        var names = className.Split('+');
        var outer = module.DefineType(names[0], TypeAttributes.Public);
        var inner = outer.DefineNestedType(names[1], TypeAttributes.NestedPublic);
        outer.CreateType();
        var type = inner.CreateType()!;
        Assert.Equal(expectedPath, LiveDocTestRunReporter.DerivePath(type));
        Assert.Equal(expectedPath, LiveDocTestRunReporter.DerivePathFromNames(type.FullName!, assemblyName));
    }

    private static Type CreateType(string assemblyName, string className)
    {
        var assembly = AssemblyBuilder.DefineDynamicAssembly(new AssemblyName(assemblyName), AssemblyBuilderAccess.RunAndCollect);
        return assembly.DefineDynamicModule(assemblyName).DefineType(className, TypeAttributes.Public).CreateType()!;
    }
}
