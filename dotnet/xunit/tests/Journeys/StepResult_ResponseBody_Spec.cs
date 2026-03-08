using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Journeys;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.Journeys;

[Specification(Description = "StepResult.ResponseBody extracts the HTTP response body from httpYac output, skipping status lines, headers, and assertion markers.")]
public class StepResult_ResponseBody_Spec : SpecificationTest
{
    public StepResult_ResponseBody_Spec(ITestOutputHelper output) : base(output)
    {
    }

    [Rule("Extracts JSON body from typical httpYac output between headers and assertion markers")]
    public void Extracts_json_body_from_typical_output()
    {
        var output = string.Join("\n",
            "HTTP/1.1 200  - OK",
            "Content-Type: application/json",
            "",
            "{\"id\": 1, \"name\": \"test\"}",
            "",
            "[x] status == 200");

        var step = new StepResult("getItem", true, 200, output, true);

        Assert.Equal("{\"id\": 1, \"name\": \"test\"}", step.ResponseBody);
    }

    [Rule("Returns null when output has no HTTP status line")]
    public void Returns_null_when_no_http_status_line()
    {
        var output = string.Join("\n",
            "Some random log output",
            "No status line here",
            "[x] status == 200");

        var step = new StepResult("noStatus", true, 200, output, true);

        Assert.Null(step.ResponseBody);
    }

    [Rule("Returns null when output is empty")]
    public void Returns_null_when_output_is_empty()
    {
        var empty = new StepResult("empty", true, 200, "", true);
        var nullOutput = new StepResult("null", true, 200, null!, true);

        Assert.Null(empty.ResponseBody);
        Assert.Null(nullOutput.ResponseBody);
    }

    [Rule("Stops collecting body at '[-]' assertion marker")]
    public void Stops_at_dash_assertion_marker()
    {
        var output = string.Join("\n",
            "HTTP/1.1 200",
            "",
            "{\"data\": true}",
            "[-] check failed");

        var step = new StepResult("failCheck", false, 200, output, true);

        Assert.Equal("{\"data\": true}", step.ResponseBody);
    }

    [Rule("Stops collecting body at 'N requests processed' summary line")]
    public void Stops_at_requests_processed_summary()
    {
        var output = string.Join("\n",
            "HTTP/1.1 200",
            "",
            "{\"ok\": true}",
            "3 requests processed");

        var step = new StepResult("summary", true, 200, output, true);

        Assert.Equal("{\"ok\": true}", step.ResponseBody);
    }

    [Rule("Handles multi-line pretty-printed JSON body")]
    public void Handles_multiline_json_body()
    {
        var output = string.Join("\n",
            "HTTP/1.1 200  - OK",
            "Content-Type: application/json",
            "",
            "{",
            "  \"user\": {",
            "    \"id\": 42,",
            "    \"name\": \"Alice\"",
            "  }",
            "}",
            "",
            "[x] status == 200");

        var step = new StepResult("prettyJson", true, 200, output, true);

        var expected = string.Join("\n",
            "{",
            "  \"user\": {",
            "    \"id\": 42,",
            "    \"name\": \"Alice\"",
            "  }",
            "}");

        Assert.Equal(expected, step.ResponseBody);
    }

    [Rule("Strips ANSI escape codes from body lines")]
    public void Strips_ansi_escape_codes()
    {
        var output = string.Join("\n",
            "HTTP/1.1 200",
            "",
            "\x1B[32m{\"color\": \"green\"}\x1B[0m",
            "",
            "[x] status == 200");

        var step = new StepResult("ansi", true, 200, output, true);

        Assert.Equal("{\"color\": \"green\"}", step.ResponseBody);
    }

    [Rule("Returns null when there is a status line but no body between headers and assertions")]
    public void Returns_null_when_status_line_but_no_body()
    {
        var output = string.Join("\n",
            "HTTP/1.1 204  - No Content",
            "X-Request-Id: abc123",
            "",
            "[x] status == 204");

        var step = new StepResult("noBody", true, 204, output, true);

        Assert.Null(step.ResponseBody);
    }
}
