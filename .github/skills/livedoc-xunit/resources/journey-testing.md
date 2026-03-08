# Journey Testing — .http-Based End-to-End API Tests

> **Load this resource** when the task involves creating `.http` journey files, `.Response.json` contracts, `property-rules.txt`, capture mode, or MSBuild journey configuration.

## Overview

Journey testing uses annotated `.http` files to define end-to-end API test flows. The LiveDoc journey generator reads BDD comments from these files and scaffolds xUnit test classes that execute the journeys against a real server and validate responses against precanned JSON contracts.

## Journey Folder Structure

Each journey lives in a folder under a `journeys/` root:

```
journeys/
├── http-client.env.json                ← httpYac environment variables
├── property-rules.txt                  ← Global rules for dynamic fields
├── health-check/
│   ├── _health-check.http              ← Journey file (prefixed with _)
│   ├── healthCheck.Response.json       ← Expected response for "healthCheck" step
│   └── adminHealth.Response.json       ← Expected response for "adminHealth" step
└── api/
    └── ai-services/
        ├── _ai-services.http
        ├── createService.Response.json
        ├── getService.Response.json
        └── ...
```

**Naming conventions:**
- `.http` files are prefixed with `_` so they sort above `.Response.json` files
- `.Response.json` files are named `{requestName}.Response.json` matching the `# @name` annotation
- Folder names use kebab-case — no numeric prefixes (ordering is only within a `.http` file, not across folders)
- The generator strips any numeric prefixes if present (e.g., `00-health-check` → `HealthCheck`)

## Writing .http Journey Files

Every `.http` file uses BDD comments that the generator parses into test structure:

```http
# Feature: Health Check
# Description: Verify the server is running and responsive

# Scenario: Server is alive and healthy

# When checking the public health endpoint
# @name healthCheck
GET {{baseUrl}}/health

?? status == 200
?? body status == healthy

###

# Then the admin health endpoint is also accessible
# @name adminHealth
GET {{baseUrl}}/health
X-Admin-Token: {{adminToken}}

?? status == 200
?? body status == healthy
```

### BDD Annotations Reference

| Comment Pattern | Purpose | Generated Code |
| --- | --- | --- |
| `# Feature: Title` | Feature name and `[Feature]` attribute | `[Feature("Title")]` |
| `# Description: Text` | Feature description | `[Feature("Title", Description = "Text")]` |
| `# Scenario: Title` | Scenario method name | `[Scenario("Title")]` |
| `# Given step text` | BDD step | `Given("step text", ctx => { ... });` |
| `# When step text` | BDD step | `When("step text", ctx => { ... });` |
| `# Then step text` | BDD step | `Then("step text", ctx => { ... });` |
| `# And step text` | BDD step | `And("step text", ctx => { ... });` |
| `# But step text` | BDD step | `But("step text", ctx => { ... });` |
| `# @name requestName` | Links preceding BDD step to the HTTP request | `run.AssertStep("requestName", ...)` |
| `# @tag tagName` | Tags the feature | `[Tag("tagName")]` |

### Critical Rules for .http Files

1. **`# @name` must appear after the BDD step comment and before the HTTP method line**
2. **`###` separates HTTP requests** — required between every request
3. **`??` lines are httpYac assertions** — they run during both manual and automated execution
4. **Steps without a BDD comment** (like cleanup requests) are still executed but don't appear in the test's BDD output
5. **Variable syntax**: `{{variableName}}` for env vars, `{{requestName.field}}` for captured responses, `{{$processEnv VAR}}` for system env vars

### Complete CRUD Journey Example

```http
# Feature: Widget API
# Description: Full CRUD validation for the /api/widgets endpoints

# Scenario: Create, read, update, and delete a widget

# --- Cleanup (safe to re-run) ---

# @name cleanup
DELETE {{baseUrl}}/api/widgets/test-widget
X-Admin-Token: {{adminToken}}

?? status >= 200
?? status < 500

###

# Given a new widget is created
# @name createWidget
POST {{baseUrl}}/api/widgets
Content-Type: application/json
X-Admin-Token: {{adminToken}}

{
  "name": "test-widget",
  "type": "standard",
  "tags": ["api-test"]
}

?? status == 201
?? body name == test-widget

###

# When getting the widget by name
# @name getWidget
GET {{baseUrl}}/api/widgets/test-widget
X-Admin-Token: {{adminToken}}

?? status == 200
?? body name == test-widget

###

# And updating the widget
# @name updateWidget
PUT {{baseUrl}}/api/widgets/test-widget
Content-Type: application/json
X-Admin-Token: {{adminToken}}

{
  "tags": ["api-test", "updated"]
}

?? status == 200

###

# And deleting the widget
# @name deleteWidget
DELETE {{baseUrl}}/api/widgets/test-widget
X-Admin-Token: {{adminToken}}

?? status == 204

###

# Then getting the deleted widget returns 404
# @name verifyDeleted
GET {{baseUrl}}/api/widgets/test-widget
X-Admin-Token: {{adminToken}}

?? status == 404
```

### Chaining Response Values Between Requests

httpYac automatically captures the JSON response body of every named request. Reference captured fields in subsequent requests using `{{requestName.propertyPath}}`:

```http
# Given a profile is created
# @name createProfile
POST {{baseUrl}}/api/profiles
Content-Type: application/json

{ "name": "test-user" }

?? status == 201
```

The `createProfile` request returns a JSON body like `{"api_key": "sk-abc123", "id": 42}`. httpYac captures this automatically because the request has `# @name createProfile`.

```http
###

# When making an authenticated request with the profile's API key
# @name authenticatedRequest
GET {{baseUrl}}/v1/data
Authorization: Bearer {{createProfile.api_key}}

?? status == 200
```

`{{createProfile.api_key}}` resolves to `sk-abc123` — the `api_key` field from the `createProfile` response body. No explicit variable declaration is needed; httpYac binds the full JSON response to the request name automatically.

**Nested access** works too: `{{createProfile.metadata.region}}` for `{"metadata": {"region": "us-east"}}`.

### Error Case Testing

Journeys can validate error responses — httpYac passes when assertions on 4xx/5xx status codes match:

```http
# When requesting without authorization
# @name missingAuth
POST {{baseUrl}}/v1/chat/completions
Content-Type: application/json

{ "model": "gpt-4", "messages": [{"role": "user", "content": "Hello"}] }

?? status == 401
```

---

## .Response.json Contract Files

For each step where you want **full payload validation**, create a `.Response.json` file in the same folder as the `.http` file. The file name must match the `@name`: `{requestName}.Response.json`.

**Example** — `createWidget.Response.json`:
```json
{
  "name": "test-widget",
  "type": "standard",
  "is_active": true,
  "tags": ["api-test"],
  "created_at": "2024-01-15T10:30:00Z"
}
```

**When to create a contract:**
- ✅ Step returns a meaningful JSON body you want to validate structurally
- ❌ Step returns `204 No Content` or the body doesn't matter
- ❌ Step is a cleanup/setup with variable results

Steps **without** a `.Response.json` file get a simple `run.AssertStep("name")` — they still verify httpYac assertions passed, but don't do payload comparison.

Steps **with** a `.Response.json` file get the full comparison:
```csharp
run.AssertStep("createWidget", step =>
{
    var expected = _server.LoadResponseFile("folder", "createWidget");
    Assert.False(string.IsNullOrWhiteSpace(step.ResponseBody),
        "Step 'createWidget' has a response contract but returned no body");
    JsonAssertions.IsComparable(step.ResponseBody, expected, _propertyRules, "createWidget");
});
```

---

## Auto-Generating Contracts with Capture Mode

Instead of writing `.Response.json` files manually, use **capture mode** to run journeys against a live server and save actual responses as contract files:

```bash
# Via MSBuild target
dotnet msbuild -t:LiveDocCaptureJourneys \
  -p:LiveDocCaptureVars="--var baseUrl=http://localhost:5000 --var adminToken=my-token"

# Or directly
dotnet path/to/JourneyGenerator.dll capture ./journeys \
  --var baseUrl=http://localhost:5000 --var adminToken=my-token
```

**Key behaviors:**
- Only creates `.Response.json` files that **don't already exist** (safe by default)
- Add `--overwrite` (or `-p:LiveDocCaptureOverwrite=true`) to regenerate all
- Skips non-JSON responses and empty bodies
- The developer must **review captured responses** to verify correctness before committing

**MSBuild properties:**
- `LiveDocCaptureVars`: httpYac variables (`--var key=value --var key2=value2`)
- `LiveDocCaptureEnv`: httpYac environment name (default: `local`)
- `LiveDocCaptureOverwrite`: `true` to overwrite existing files (default: `false`)

**Recommended workflow for AI agents:**
1. Help the user write `.http` files with BDD annotations
2. Instruct them to start their server
3. Tell them to run capture mode to seed the `.Response.json` files
4. Help them review and adjust the captured responses
5. Help them configure `property-rules.txt` for dynamic fields
6. Build to scaffold `.Journey.cs` test files

---

## property-rules.txt

The `property-rules.txt` file tells `JsonAssertions.IsComparable()` how to handle dynamic or non-deterministic fields. Place at the journeys root for global rules.

### Syntax

```
# Comments start with #. Blank lines are ignored.

# Ignore entirely — field is skipped during comparison
api_key
api_key_prefix

# Must be present, any value
created_at: exists
updated_at: exists
id: exists

# Type checking
total_spend: type number
is_active: type boolean
tags: type array
details: type object

# Numeric comparisons
request_count: type number, >= 0
port: type number, > 0

# String/array length checks
data: length >= 1
content: type string, length > 0

# Regex matching
email: matches ^[^@]+@[^@]+$

# Multiple rules (AND logic)
total_tokens: type number, >= 0

# Scoped to parent object
providers.healthy: type number, >= 0
```

### Rule Types

| Rule | Meaning | Example |
| --- | --- | --- |
| *(bare name)* | Ignore entirely — skip comparison | `api_key` |
| `exists` | Must be present, value doesn't matter | `created_at: exists` |
| `type T` | Must be specified JSON type (`string`, `number`, `boolean`, `array`, `object`) | `tags: type array` |
| `> N`, `>= N`, `< N`, `<= N` | Numeric comparison | `port: type number, > 0` |
| `length > N`, `length >= N` | Array or string length check | `data: length >= 1` |
| `matches <regex>` | String must match regex | `email: matches ^[^@]+@` |
| Multiple rules | Comma-separated (AND logic) | `total: type number, >= 0` |

### Folder-Specific Overrides

Create additional `property-rules.txt` files in subfolders for specialized rules (e.g., journeys that hit external services with non-deterministic responses). The generator auto-merges global + folder-specific rules.

---

## MSBuild Configuration

Enable journey scaffolding in the test project `.csproj`:

```xml
<PropertyGroup>
  <LiveDocJourneysEnabled>true</LiveDocJourneysEnabled>
  <LiveDocJourneysDir>$(MSBuildProjectDirectory)\..\..\journeys</LiveDocJourneysDir>
  <LiveDocJourneyOutputDir>$(MSBuildProjectDirectory)\Journeys</LiveDocJourneyOutputDir>
  <LiveDocJourneyBaseNamespace>MyProject.Specs.Journeys</LiveDocJourneyBaseNamespace>
  <LiveDocJourneyFixtureType>JourneyServerFixture</LiveDocJourneyFixtureType>
  <LiveDocJourneyMode>scaffold</LiveDocJourneyMode>
  <LiveDocHttpYacEnsure>check</LiveDocHttpYacEnsure>
</PropertyGroup>
```

| Property | Default | Description |
| --- | --- | --- |
| `LiveDocJourneysEnabled` | `false` | Set to `true` to enable |
| `LiveDocJourneysDir` | `$(MSBuildProjectDirectory)\journeys` | Root folder with journey subfolders |
| `LiveDocJourneyOutputDir` | `$(MSBuildProjectDirectory)\Journeys` | Where `.Journey.cs` files are written |
| `LiveDocJourneyBaseNamespace` | `$(RootNamespace).Journeys` | Namespace for generated classes |
| `LiveDocJourneyFixtureType` | `JourneyServerFixture` | The `IClassFixture<T>` type |
| `LiveDocJourneyMode` | `scaffold` | `scaffold` (don't overwrite), `validate` (report drift), `force` (overwrite all) |
| `LiveDocHttpYacEnsure` | `check` | `check` (fail if missing), `auto-install`, `off` |

---

## Generated Test Pattern

The generator produces one `.Journey.cs` per `.http` file. The pattern:

```csharp
// Generated from api/widgets/_widgets.http
using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Journeys;
using Xunit;
using Xunit.Abstractions;
using MyProject.Specs.Journeys;

namespace MyProject.Specs.Journeys.Api;

[Feature("Widget API", Description = "Full CRUD validation")]
public class Widgets_Journey : FeatureTest, IClassFixture<JourneyServerFixture>
{
    private readonly JourneyServerFixture _server;
    private readonly PropertyRules _propertyRules;

    public Widgets_Journey(ITestOutputHelper output, JourneyServerFixture server) : base(output)
    {
        _server = server;
        _propertyRules = JsonAssertions.LoadPropertyRules(
            Path.Combine(server.JourneysDir, "property-rules.txt"));
    }

    [Scenario("Create, read, update, and delete a widget")]
    public async Task CreateReadUpdateAndDeleteAWidget()
    {
        var run = await _server.RunJourneyAsync("api/widgets/_widgets.http");

        // Steps WITH .Response.json get full payload validation
        Given("a new widget is created", ctx =>
        {
            run.AssertStep("createWidget", step =>
            {
                var expected = _server.LoadResponseFile("api/widgets", "createWidget");
                Assert.False(string.IsNullOrWhiteSpace(step.ResponseBody),
                    "Step 'createWidget' has a response contract but returned no body");
                JsonAssertions.IsComparable(step.ResponseBody, expected, _propertyRules, "createWidget");
            });
        });

        // Steps WITHOUT .Response.json get simple pass/fail assertion
        And("deleting the widget", ctx =>
        {
            run.AssertStep("deleteWidget");
        });
    }
}
```

**Key using statements:**
- `SweDevTools.LiveDoc.xUnit.Journeys` — provides `JourneyResult`, `StepResult`, `JsonAssertions`, `PropertyRules`, `JourneyFixtureBase`
- `MyProject.Specs.Journeys` — your concrete `JourneyServerFixture` class

**Path derivation:**
- `api/ai-services/_ai-services.http` → `Api/AiServices.Journey.cs` (namespace `.Api`)
- `00-health-check/_00-health-check.http` → `HealthCheck.Journey.cs` (root namespace)
- Numeric prefixes are stripped from class names

---

## Server Fixture (Library-Provided Base Class)

The library ships `JourneyFixtureBase` in `SweDevTools.LiveDoc.xUnit.Journeys` which handles:
- Server process management (start/stop/port selection)
- httpYac CLI execution (`RunJourneyAsync()`)
- Response contract loading (`LoadResponseFile()`)
- Capture mode (when `JOURNEY_CAPTURE=true`)

**Minimal fixture** — override `Configure()` with your project paths:

```csharp
using SweDevTools.LiveDoc.xUnit.Journeys;

public class JourneyServerFixture : JourneyFixtureBase
{
    protected override JourneyConfig Configure() => new()
    {
        ServerProject = "../../src/MyApi",
        JourneysPath  = "../../journeys",
    };
}
```

**JourneyConfig properties** (all have defaults except the two required paths):

| Property | Default | Description |
| --- | --- | --- |
| `ServerProject` | **required** | Relative path to server project directory |
| `JourneysPath` | **required** | Relative path to journeys directory |
| `ServerEnvironment` | `"Test"` | Sets `ASPNETCORE_ENVIRONMENT` and `DOTNET_ENVIRONMENT` |
| `HttpYacEnvironment` | `"local"` | httpYac environment name |
| `StartupTimeout` | 30 seconds | How long to wait for server startup |
| `ServerArguments` | `"--no-launch-profile"` | Extra args for `dotnet run` |

**Automatic behavior** (no config needed):
- Random ephemeral port, `ASPNETCORE_URLS` auto-set, Kestrel startup detection, `baseUrl` httpYac variable, capture mode, process cleanup

**Virtual method overrides** (advanced scenarios only):

| Method | Default | When to Override |
| --- | --- | --- |
| `ConfigureServerProcess(psi)` | No-op | Add custom env vars to server process |
| `IsServerReady(line)` | Detects "Now listening on" or "Application started" | Non-Kestrel server |
| `GetHttpYacVariables()` | `{ "baseUrl": BaseUrl }` | Additional variables (tokens, API keys) |
| `OnServerOutputLine(line)` | No-op | Extract values from startup logs |

**Adding custom httpYac variables:**
```csharp
protected override Dictionary<string, string> GetHttpYacVariables()
{
    var vars = base.GetHttpYacVariables(); // includes baseUrl
    vars["adminToken"] = "test-token-123";
    return vars;
}
```

---

## Validation Checklist

- [ ] `.http` file has `# Feature:` and at least one `# Scenario:`
- [ ] Every BDD step that makes an HTTP request has a `# @name` annotation
- [ ] `# @name` appears after the BDD comment and before the HTTP method line
- [ ] `###` separates every HTTP request
- [ ] `.Response.json` files match the `@name` exactly: `{name}.Response.json`
- [ ] `property-rules.txt` covers all dynamic fields (timestamps, IDs, ports, etc.)
- [ ] `LiveDocJourneysEnabled` is `true` in the test project `.csproj`
- [ ] httpYac is installed (`npm install --save-dev httpyac`)
- [ ] Concrete `JourneyServerFixture` exists inheriting from `JourneyFixtureBase`
- [ ] `LiveDocJourneyInfrastructureNamespace` matches where `JourneyServerFixture` lives

## Failure Handling

- If journey tests fail with "httpYac not found", run `npm install --save-dev httpyac`
- If `.Journey.cs` files aren't generated, verify `LiveDocJourneysEnabled=true` and the `.http` file has BDD comments
- If response contract assertions fail, check `property-rules.txt` covers dynamic fields and `.Response.json` matches current API shape
