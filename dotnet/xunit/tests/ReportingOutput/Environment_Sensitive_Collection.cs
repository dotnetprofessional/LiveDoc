using Xunit;

namespace SweDevTools.LiveDoc.xUnit.Tests.ReportingOutput;

[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class Environment_Sensitive_Collection
{
    public const string Name = "Environment-sensitive reporting tests";
}
