using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Journeys;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.Journeys;

[Specification(Description = "JourneyResult.Parse() reads httpYac CLI output into per-step results, detecting step boundaries, HTTP status codes, failed assertions, ANSI codes, and step name normalization.")]
public class JourneyResult_Parse_Spec : SpecificationTest
{
    public JourneyResult_Parse_Spec(ITestOutputHelper output) : base(output)
    {
    }

    [Rule("Parses successful multi-step output into two passing steps with correct names")]
    public void Parses_successful_multi_step_output()
    {
        var output = string.Join("\n",
            "=== createUser ===",
            "POST http://localhost:5000/api/users",
            "HTTP/1.1 201  - Created",
            "Content-Type: application/json",
            "",
            "{\"id\": 1, \"name\": \"Alice\"}",
            "",
            "[x] status == 201",
            "",
            "=== getUser ===",
            "GET http://localhost:5000/api/users/1",
            "HTTP/1.1 200  - OK",
            "Content-Type: application/json",
            "",
            "{\"id\": 1, \"name\": \"Alice\"}",
            "",
            "[x] status == 200",
            "2 requests processed (2 succeeded)");

        var result = JourneyResult.Parse(0, output);

        Assert.True(result.Success);
        Assert.Equal(2, result.Steps.Count);
        Assert.True(result.Steps["createUser"].Passed);
        Assert.True(result.Steps["getUser"].Passed);
    }

    [Rule("Step with '[-]' failed assertion marker is detected as not passing")]
    public void Detects_dash_failed_assertion()
    {
        var output = string.Join("\n",
            "=== validateInput ===",
            "POST http://localhost:5000/api/validate",
            "HTTP/1.1 400  - Bad Request",
            "Content-Type: application/json",
            "",
            "{\"error\": \"invalid\"}",
            "",
            "[-] status == 200",
            "1 requests processed (0 succeeded)");

        var result = JourneyResult.Parse(1, output);

        Assert.False(result.Steps["validateInput"].Passed);
    }

    [Rule("Step with '[✗]' unicode marker is also detected as failed")]
    public void Detects_unicode_cross_failed_assertion()
    {
        var output = string.Join("\n",
            "=== checkHealth ===",
            "GET http://localhost:5000/health",
            "HTTP/1.1 503  - Service Unavailable",
            "",
            "[✗] status == 200",
            "1 requests processed (0 succeeded)");

        var result = JourneyResult.Parse(1, output);

        Assert.False(result.Steps["checkHealth"].Passed);
    }

    [Rule("Detects HTTP status codes from response lines")]
    public void Detects_http_status_codes()
    {
        var output = string.Join("\n",
            "=== successRequest ===",
            "GET http://localhost:5000/api/items",
            "HTTP/1.1 200  - OK",
            "Content-Type: application/json",
            "",
            "[]",
            "",
            "[x] status == 200",
            "",
            "=== notFoundRequest ===",
            "GET http://localhost:5000/api/items/999",
            "HTTP/1.1 404  - Not Found",
            "",
            "[x] status == 404",
            "2 requests processed (2 succeeded)");

        var result = JourneyResult.Parse(0, output);

        Assert.Equal(200, result.Steps["successRequest"].StatusCode);
        Assert.Equal(404, result.Steps["notFoundRequest"].StatusCode);
    }

    [Rule("ANSI escape codes are stripped so step headers still parse correctly")]
    public void Strips_ansi_escape_codes()
    {
        var output = string.Join("\n",
            "\x1B[32m=== createItem ===\x1B[0m",
            "POST http://localhost:5000/api/items",
            "\x1B[36mHTTP/1.1 201  - Created\x1B[0m",
            "",
            "\x1B[33m{\"id\": 42}\x1B[0m",
            "",
            "[x] status == 201",
            "1 requests processed (1 succeeded)");

        var result = JourneyResult.Parse(0, output);

        Assert.True(result.Steps.ContainsKey("createItem"));
        Assert.Equal(201, result.Steps["createItem"].StatusCode);
        Assert.True(result.Steps["createItem"].Passed);
    }

    [Rule("Empty output produces zero steps")]
    public void Empty_output_produces_zero_steps()
    {
        var result = JourneyResult.Parse(0, "");

        Assert.Equal(0, result.Steps.Count);
    }

    [Rule("Step name is normalized to first token with quotes stripped")]
    public void Normalizes_step_name()
    {
        var output = string.Join("\n",
            "=== \"createUser\" (1/3) ===",
            "POST http://localhost:5000/api/users",
            "HTTP/1.1 201  - Created",
            "",
            "[x] status == 201",
            "1 requests processed (1 succeeded)");

        var result = JourneyResult.Parse(0, output);

        Assert.True(result.Steps.ContainsKey("createUser"));
        Assert.Equal("createUser", result.Steps["createUser"].Name);
    }

    [Rule("Exit code 1 sets Success to false even when all step assertions pass")]
    public void Exit_code_1_sets_success_false()
    {
        var output = string.Join("\n",
            "=== healthCheck ===",
            "GET http://localhost:5000/health",
            "HTTP/1.1 200  - OK",
            "",
            "[x] status == 200",
            "1 requests processed (1 succeeded)");

        var result = JourneyResult.Parse(1, output);

        Assert.False(result.Success);
        Assert.True(result.Steps["healthCheck"].Passed);
    }

    [Rule("Steps dictionary uses case-insensitive key lookup")]
    public void Steps_dictionary_is_case_insensitive()
    {
        var output = string.Join("\n",
            "=== GetUser ===",
            "GET http://localhost:5000/api/users/1",
            "HTTP/1.1 200  - OK",
            "",
            "[x] status == 200",
            "1 requests processed (1 succeeded)");

        var result = JourneyResult.Parse(0, output);

        Assert.True(result.Steps.ContainsKey("getuser"));
        Assert.True(result.Steps.ContainsKey("GETUSER"));
        Assert.True(result.Steps.ContainsKey("GetUser"));
    }
}
