using SweDevTools.LiveDoc.xUnit.Journeys;

namespace SweDevTools.LiveDoc.xUnit.Tests.Journeys;

/// <summary>
/// Fixture that starts the SampleApi server for journey integration tests.
/// </summary>
public class SampleApiFixture : JourneyFixtureBase
{
    protected override JourneyConfig Configure() => new()
    {
        ServerProject = "SampleApi",
        JourneysPath = "Journeys/sample-journeys",
    };
}
