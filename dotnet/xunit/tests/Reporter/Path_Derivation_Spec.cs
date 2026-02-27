using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Reporter;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.Reporter;

[Specification(Description = @"
    Path derivation trims assembly namespace prefixes so the viewer hierarchy
    stays focused on meaningful folders.")]
public class Path_Derivation_Spec : SpecificationTest
{
    public Path_Derivation_Spec(ITestOutputHelper output) : base(output)
    {
    }

    [Rule("DerivePathFromNames strips a leading assembly prefix")]
    public void DerivePathFromNames_strips_leading_assembly_prefix()
    {
        var path = LiveDocTestRunReporter.DerivePathFromNames(
            "LiveDoc.xUnit.Tests.Gherkin.Examples.Scenario_Outline_Spec",
            "LiveDoc.xUnit.Tests");

        Assert.Equal("Gherkin/Examples/Scenario_Outline_Spec.cs", path);
    }

    [Rule("DerivePathFromNames strips assembly prefix even with vendor namespace")]
    public void DerivePathFromNames_strips_prefixed_assembly_namespace()
    {
        var path = LiveDocTestRunReporter.DerivePathFromNames(
            "SweDevTools.LiveDoc.xUnit.Tests.Gherkin.Examples.Scenario_Outline_Spec",
            "LiveDoc.xUnit.Tests");

        Assert.Equal("Gherkin/Examples/Scenario_Outline_Spec.cs", path);
    }

    [Rule("DerivePathFromNames preserves full namespace when assembly segment is absent")]
    public void DerivePathFromNames_preserves_full_namespace_when_no_assembly_match()
    {
        var path = LiveDocTestRunReporter.DerivePathFromNames(
            "MyCompany.Product.Specs.Authentication.Login_Spec",
            "LiveDoc.xUnit.Tests");

        Assert.Equal("MyCompany/Product/Specs/Authentication/Login_Spec.cs", path);
    }
}
