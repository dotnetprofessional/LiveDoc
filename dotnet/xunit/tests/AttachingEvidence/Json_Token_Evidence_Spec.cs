using System.Collections.Concurrent;
using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using Newtonsoft.Json.Linq;
using SweDevTools.LiveDoc.xUnit.Core;
using SweDevTools.LiveDoc.xUnit.Reporter;
using SweDevTools.LiveDoc.xUnit.Reporter.Models;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.AttachingEvidence;

[Specification("JSON Token Evidence", Description = "Recorded JSON evidence retains the supplied objects, collections, and scalar values rather than the enumerable implementation details of a JSON token.")]
[Tag("attachments, json, json-tokens")]
public sealed class Json_Token_Evidence_Spec(ITestOutputHelper output) : SpecificationTest(output)
{
    private bool _recorded;

    public override void Dispose()
    {
        if (!_recorded)
            base.Dispose();
    }

    [Rule("Action 'Finish', receipt ID 'fixture-id', and type 'Example' retain JSON '{\"action\":\"Finish\",\"receipt\":{\"id\":\"fixture-id\",\"type\":\"Example\"}}' in object, token array, raw JSON, and CLR array attachments")]
    public void Equivalent_payload_representations_retain_their_JSON()
    {
        var (action, id, type, expected) = Rule.Values.As<string, string, string, string>();
        var payload = new JObject
        {
            ["action"] = action,
            ["receipt"] = new JObject { ["id"] = id, ["type"] = type }
        };
        AttachJson(payload, "Newtonsoft object");
        AttachJson(new[] { payload }, "Newtonsoft object array");
        AttachJson(Newtonsoft.Json.JsonConvert.SerializeObject(new[] { payload }), "Serialized JSON control");
        AttachJson(new[] { new { action, receipt = new { id, type } } }, "CLR object control");

        var execution = RecordedExecution();
        Assert.Equal(4, execution.Attachments!.Count);
        var expectedArray = $"[{expected}]";
        AssertRecordedJson(execution.Attachments.Single(attachment => attachment.Title == "Serialized JSON control"), expectedArray);
        AssertRecordedJson(execution.Attachments.Single(attachment => attachment.Title == "CLR object control"), expectedArray);
        AssertRecordedJson(execution.Attachments.Single(attachment => attachment.Title == "Newtonsoft object"), expected);
        AssertRecordedJson(execution.Attachments.Single(attachment => attachment.Title == "Newtonsoft object array"), expectedArray);
    }

    [RuleOutline("Representation '<representation>' records JSON '<expected>' with title 'JSON evidence — café 東京 🌿', MIME 'application/json', and kind 'file'")]
    [Example("JObject", "{\"text\":\"café 東京 🌿\",\"number\":13,\"flag\":true,\"optional\":null,\"array\":[],\"object\":{}}")]
    [Example("JArray", "[\"café 東京 🌿\",13,true,null,{\"nested\":[false,{},[]]}]")]
    [Example("JValue string", "\"café 東京 🌿\"")]
    [Example("JValue integer", "13")]
    [Example("JValue decimal", "13.25")]
    [Example("JValue boolean", "true")]
    [Example("JValue boolean", "false")]
    [Example("JValue null", "null")]
    [Example("JValue string", "\"\"")]
    [Example("JValue string", "\"quote \\\" slash \\\\ newline \\n tab \\t control \\u0001 café 東京 🌿\"")]
    [Example("JValue integer", "-13")]
    [Example("JValue decimal", "-0.125")]
    [Example("JToken primitive", "123456789012345678901234567890")]
    [Example("JToken primitive", "1.25e-10")]
    [Example("JToken primitive", "\"café 東京 🌿\"")]
    [Example("JObject array", "[{\"value\":\"café 東京 🌿\"}]")]
    [Example("JObject list", "[{\"value\":\"café 東京 🌿\"}]")]
    [Example("JToken array", "[\"café 東京 🌿\",13,true,null]")]
    [Example("JToken list", "[\"café 東京 🌿\",13,true,null]")]
    [Example("JToken dictionary", "{\"text\":\"café 東京 🌿\",\"number\":13,\"flag\":true,\"optional\":null}")]
    [Example("CLR object with JToken field", "{\"value\":{\"text\":\"café 東京 🌿\",\"array\":[13,true,null]}}")]
    [Example("CLR object with JValue field", "{\"value\":\"café 東京 🌿\"}")]
    [Example("CLR object with token list field", "{\"value\":[\"café 東京 🌿\",13,true,null]}")]
    [Example("Attributed CLR token field", "{\"wire_value\":{\"text\":\"café 東京 🌿\"},\"Number\":13,\"Flag\":true,\"Optional\":null}")]
    [Example("CLR dictionary with mixed values", "{\"token\":{\"text\":\"café 東京 🌿\"},\"scalar\":13,\"optional\":null,\"array\":[true,\"café 東京 🌿\"]}")]
    [Example("Nullable token list", "[null,\"café 東京 🌿\",null]")]
    [Example("Derived JObject", "{\"text\":\"café 東京 🌿\"}")]
    [Example("Derived JArray", "[13,true,null]")]
    [Example("Derived JValue", "\"café 東京 🌿\"")]
    [Example("Deep mixed collections", "{\"value\":[{\"tokens\":[{\"nested\":[\"café 東京 🌿\",13,true,null,[],{}]}]}]}")]
    [Example("Empty JObject", "{}")]
    [Example("Empty JArray", "[]")]
    [Example("Empty JToken list", "[]")]
    [Example("Empty JToken dictionary", "{}")]
    [Example("Raw JSON", " { \"value\" : \"café 東京 🌿\" } ")]
    [Example("CLR object", "{\"wire_value\":\"café 東京 🌿\",\"Number\":13,\"Flag\":true,\"Optional\":null}")]
    [Example("CLR array", "[{\"wire_value\":\"café 東京 🌿\",\"Number\":13,\"Flag\":true,\"Optional\":null}]")]
    [Example("JsonElement", "{\"value\":\"café 東京 🌿\",\"array\":[13,true,null]}")]
    [Example("JsonDocument", "{\"value\":\"café 東京 🌿\",\"array\":[13,true,null]}")]
    [Example("JsonNode", "{\"value\":\"café 東京 🌿\",\"array\":[13,true,null]}")]
    public void Recorded_tokens_preserve_JSON_semantics(string representation, string expected)
    {
        var title = Rule.Values[2].AsString();
        var mimeType = Rule.Values[3].AsString();
        var kind = Rule.Values[4].AsString();
        using var document = JsonDocument.Parse(expected);
        var payload = CreatePayload(representation, expected, document);
        AttachJson(payload, title);

        var attachment = Assert.Single(RecordedExecution().Attachments!);
        Assert.Equal(title, attachment.Title);
        Assert.Equal(mimeType, attachment.MimeType);
        Assert.Equal(kind, attachment.Kind);
        AssertRecordedJson(attachment, expected);
        if (representation == "Raw JSON")
            Assert.Equal(expected, Decode(attachment));
        if (representation is "CLR object" or "CLR array")
            Assert.Equal(System.Text.Json.JsonSerializer.Serialize(payload, new JsonSerializerOptions { WriteIndented = true }),
                Decode(attachment));
    }

    [RuleOutline("Unsupported '<representation>' with value '<value>' throws 'JsonException' identifying '<tokenType>' and records no JSON attachment")]
    [Example("Root property", "fixture-id", "Property")]
    [Example("Root constructor", "Example", "Constructor")]
    [Example("Nested constructor", "Example", "Constructor")]
    [Example("Raw valid JSON", "{\"id\":\"fixture-id\"}", "Raw")]
    [Example("Raw invalid JSON", "not JSON", "Raw")]
    [Example("Nested raw JSON", "not JSON", "Raw")]
    [Example("Undefined value", "undefined", "Undefined")]
    [Example("Comment value", "fixture comment", "Comment")]
    public void Nonstandard_tokens_fail_explicitly(string representation, string value, string tokenType)
    {
        JToken token = representation switch
        {
            "Root property" => new JProperty("id", value),
            "Root constructor" => new JConstructor(value),
            "Nested constructor" => new JObject { ["value"] = new JConstructor(value) },
            "Raw valid JSON" or "Raw invalid JSON" => new JRaw(value),
            "Nested raw JSON" => new JArray(new JRaw(value)),
            "Undefined value" => JValue.CreateUndefined(),
            "Comment value" => JValue.CreateComment(value),
            _ => throw new ArgumentOutOfRangeException(nameof(representation))
        };
        var exception = Assert.Throws<JsonException>(() => AttachJson(token));
        Assert.Contains(tokenType, exception.Message);
        Assert.Contains("AttachJson", exception.Message);
        Assert.Contains("standard JSON", exception.Message);
        Assert.Empty(RecordedExecution().Attachments ?? []);
    }

    [Rule("Raw string 'not JSON' passes through unchanged without token validation")]
    public void Raw_strings_retain_existing_pass_through()
    {
        var raw = Rule.Values[0].AsString();
        AttachJson(raw);
        Assert.Equal(raw, Decode(Assert.Single(RecordedExecution().Attachments!)));
    }

    private static object CreatePayload(string representation, string json, JsonDocument document)
    {
        var root = document.RootElement;
        return representation switch
        {
            "JObject" or "Empty JObject" => JObject.Parse(json),
            "JArray" or "Empty JArray" => JArray.Parse(json),
            "JValue string" => new JValue(root.GetString()),
            "JValue integer" => new JValue(root.GetInt32()),
            "JValue decimal" => new JValue(root.GetDecimal()),
            "JValue boolean" => new JValue(root.GetBoolean()),
            "JValue null" => JValue.CreateNull(),
            "JToken primitive" => JToken.Parse(json),
            "Derived JObject" => new DerivedObject(JObject.Parse(json)),
            "Derived JArray" => new DerivedArray(JArray.Parse(json)),
            "Derived JValue" => new DerivedValue(root.GetString()!),
            "JObject array" => root.EnumerateArray().Select(item => JObject.Parse(item.GetRawText())).ToArray(),
            "JObject list" => root.EnumerateArray().Select(item => JObject.Parse(item.GetRawText())).ToList(),
            "JToken array" => root.EnumerateArray().Select(item => JToken.Parse(item.GetRawText())).ToArray(),
            "JToken list" => root.EnumerateArray().Select(item => JToken.Parse(item.GetRawText())).ToList(),
            "JToken dictionary" => root.EnumerateObject().ToDictionary(property => property.Name,
                property => JToken.Parse(property.Value.GetRawText())),
            "CLR object with JToken field" => new { value = JToken.Parse(root.GetProperty("value").GetRawText()) },
            "CLR object with JValue field" => new { value = new JValue(root.GetProperty("value").GetString()) },
            "CLR object with token list field" => new
            {
                value = root.GetProperty("value").EnumerateArray().Select(item => JToken.Parse(item.GetRawText())).ToList()
            },
            "Attributed CLR token field" => new ClrTokenPayload
            {
                Value = JObject.Parse(root.GetProperty("wire_value").GetRawText()),
                Number = root.GetProperty("Number").GetInt32(),
                Flag = root.GetProperty("Flag").GetBoolean()
            },
            "CLR dictionary with mixed values" => new Dictionary<string, object?>
            {
                ["token"] = JObject.Parse(root.GetProperty("token").GetRawText()),
                ["scalar"] = root.GetProperty("scalar").GetInt32(),
                ["optional"] = null,
                ["array"] = new object[]
                {
                    new JValue(root.GetProperty("array")[0].GetBoolean()),
                    root.GetProperty("array")[1].GetString()!
                }
            },
            "Nullable token list" => root.EnumerateArray()
                .Select(item => item.ValueKind == JsonValueKind.Null ? null : JToken.Parse(item.GetRawText())).ToList(),
            "Deep mixed collections" => new
            {
                value = new List<Dictionary<string, object>>
                {
                    new()
                    {
                        ["tokens"] = new object[]
                        {
                            JObject.Parse(root.GetProperty("value")[0].GetProperty("tokens")[0].GetRawText())
                        }
                    }
                }
            },
            "Empty JToken list" => new List<JToken>(),
            "Empty JToken dictionary" => new Dictionary<string, JToken>(),
            "Raw JSON" => json,
            "CLR object" => CreateClrPayload(root),
            "CLR array" => root.EnumerateArray().Select(CreateClrPayload).ToArray(),
            "JsonElement" => root,
            "JsonDocument" => document,
            "JsonNode" => JsonNode.Parse(json)!,
            _ => throw new ArgumentOutOfRangeException(nameof(representation), representation, "Unknown JSON representation.")
        };
    }

    private static ClrPayload CreateClrPayload(JsonElement element) => new()
    {
        Text = element.GetProperty("wire_value").GetString()!,
        Number = element.GetProperty("Number").GetInt32(),
        Flag = element.GetProperty("Flag").GetBoolean()
    };

    private sealed class ClrPayload
    {
        [JsonPropertyName("wire_value")]
        [Newtonsoft.Json.JsonProperty("different_newtonsoft_name")]
        public required string Text { get; init; }
        public int Number { get; init; }
        public bool Flag { get; init; }
        public string? Optional { get; init; }
    }

    private sealed class ClrTokenPayload
    {
        [JsonPropertyName("wire_value")]
        [Newtonsoft.Json.JsonProperty("different_newtonsoft_name")]
        public required JObject Value { get; init; }
        public int Number { get; init; }
        public bool Flag { get; init; }
        public string? Optional { get; init; }
        [JsonIgnore]
        public string Ignored => "must not be serialized";
    }

    private sealed class DerivedObject(JObject value) : JObject(value);
    private sealed class DerivedArray(JArray value) : JArray(value);
    private sealed class DerivedValue(string value) : JValue(value);

    private ExecutionResult RecordedExecution()
    {
        // Complete the context so assertions inspect the reporter's execution attachment,
        // not the original payload or its pending attachment buffer.
        var context = Assert.IsType<LiveDocContext>(typeof(LiveDocTestBase)
            .GetField("_context", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(this));
        context.Dispose();
        _recorded = true;
        var tests = Assert.IsType<ConcurrentDictionary<string, BaseTest>>(typeof(LiveDocTestRunReporter)
            .GetField("_tests", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(LiveDocTestRunReporter.Instance));
        var outlineId = (string?)typeof(LiveDocContext)
            .GetField("_outlineId", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(context);
        var testId = outlineId ?? (string)typeof(LiveDocContext)
            .GetField("_scenarioId", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(context)!;
        var test = tests[testId];
        Assert.Empty(test.RuleViolations ?? []);
        if (test is RuleOutlineTest outline)
        {
            var rowId = (int)typeof(LiveDocContext)
                .GetField("_outlineRowId", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(context)!;
            return Assert.Single(outline.ExampleResults!, row => row.TestId == testId && row.Result.RowId == rowId).Result;
        }
        return test.Execution!;
    }

    private static string Decode(Attachment attachment)
        => new UTF8Encoding(false, true).GetString(Convert.FromBase64String(attachment.Base64!));

    private static void AssertRecordedJson(Attachment attachment, string expected)
    {
        var decoded = Decode(attachment);
        using var expectedDocument = JsonDocument.Parse(expected);
        using var actualDocument = JsonDocument.Parse(decoded);
        // .NET 8's JsonNode equality compares numeric lexemes, including exponent casing.
        var equal = expectedDocument.RootElement.ValueKind == JsonValueKind.Number &&
            actualDocument.RootElement.ValueKind == JsonValueKind.Number &&
            expectedDocument.RootElement.TryGetDecimal(out var expectedNumber) &&
            actualDocument.RootElement.TryGetDecimal(out var actualNumber)
                ? expectedNumber == actualNumber
                : JsonNode.DeepEquals(JsonNode.Parse(expected), JsonNode.Parse(decoded));
        Assert.True(equal,
            $"{attachment.Title}: expected JSON {expected}; recorded JSON {decoded}");
    }
}
