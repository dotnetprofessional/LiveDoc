using System.Collections.ObjectModel;
using System.Text.Json;
using System.Xml;
using Microsoft.VisualStudio.TestPlatform.ObjectModel;
using Microsoft.VisualStudio.TestPlatform.ObjectModel.Logging;
using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Logger;
using SweDevTools.LiveDoc.xUnit.VSTestCoverage;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.ReportingOutput;

[Specification("VSTest Coverage Collector", Description = @"
    The packaged LiveDoc data collector activates the post-run attachment processor,
    injects an invocation-scoped metadata directory, and emits coded lifecycle diagnostics.")]
[Collection(Environment_Sensitive_Collection.Name)]
public class Coverage_Collector_Spec : SpecificationTest
{
    public Coverage_Collector_Spec(ITestOutputHelper output) : base(output)
    {
    }

    [Rule("Attachment processor advertises Microsoft URI 'datacollector://microsoft/CodeCoverage/2.0', Coverlet URI 'datacollector://Microsoft/CoverletCodeCoverage/1.0', and collector URI 'datacollector://swedevtools/livedoc/coverage'")]
    public void Attachment_processor_advertises_supported_uris()
    {
        var (microsoftUri, coverletUri, collectorUri) = Rule.Values.As<string, string, string>();
        var uris = new LiveDocCoverageAttachmentProcessor()
            .GetExtensionUris()
            .Select(uri => uri.OriginalString)
            .ToList();

        Assert.Contains(microsoftUri, uris);
        Assert.Contains(coverletUri, uris);
        Assert.Contains(collectorUri, uris);
    }

    [Rule("Collector injects the LIVEDOC_RUN_METADATA_DIR environment variable with an existing invocation directory")]
    public void Collector_injects_metadata_directory()
    {
        var expectedVariable = LiveDocPostRunCoverage.RunMetadataDirEnvironmentVariable;
        var originalMetadataDir = Environment.GetEnvironmentVariable(expectedVariable);
        string? metadataDir = null;
        try
        {
            using var collector = new LiveDocCoverageDataCollector();
            var variables = collector
                .GetTestExecutionEnvironmentVariables()
                .ToDictionary(pair => pair.Key, pair => pair.Value);

            Assert.True(variables.TryGetValue(expectedVariable, out metadataDir));
            Assert.False(string.IsNullOrWhiteSpace(metadataDir));
            Assert.True(Directory.Exists(metadataDir));
        }

        finally
        {
            Environment.SetEnvironmentVariable(expectedVariable, originalMetadataDir);
            if (!string.IsNullOrWhiteSpace(metadataDir) && Directory.Exists(metadataDir))
                Directory.Delete(metadataDir, recursive: true);
        }
    }

    [Rule("Collector initialization before environment query reuses '1' invocation directory and '1' marker path")]
    public void Collector_initialization_then_environment_query_reuses_invocation_identity()
    {
        var (expectedDirectoryCount, expectedMarkerCount) = Rule.Values.As<int, int>();
        AssertCollectorInvocationIdentity(
            initializeFirst: true,
            expectedDirectoryCount,
            expectedMarkerCount);
    }

    [Rule("Collector environment query before initialization reuses '1' invocation directory and '1' marker path")]
    public void Collector_environment_query_then_initialization_reuses_invocation_identity()
    {
        var (expectedDirectoryCount, expectedMarkerCount) = Rule.Values.As<int, int>();
        AssertCollectorInvocationIdentity(
            initializeFirst: false,
            expectedDirectoryCount,
            expectedMarkerCount);
    }

    [Rule("Attachment processor uses incremental processing 'true' and returns '2' input attachment sets unchanged")]
    public async Task Processor_uses_incremental_processing_and_preserves_input()
    {
        var (expectedIncremental, expectedSetCount) = Rule.Values.As<bool, int>();
        var scratch = CreateScratchDirectory();
        try
        {
            var processor = new LiveDocCoverageAttachmentProcessor();
            var markerSet = CreateMarkerSet(scratch, DateTime.UtcNow);
            var coverageSet = CreateCoverageSet(scratch);
            var attachments = new Collection<AttachmentSet> { markerSet, coverageSet };

            var result = await processor.ProcessAttachmentSetsAsync(
                LoadConfiguration(scratch),
                attachments,
                new Progress<int>(),
                new RecordingMessageLogger(),
                CancellationToken.None);

            Assert.Equal(expectedIncremental, processor.SupportsIncrementalProcessing);
            Assert.Equal(expectedSetCount, result.Count);
            Assert.Same(markerSet, result.ElementAt(0));
            Assert.Same(coverageSet, result.ElementAt(1));
        }
        finally
        {
            Directory.Delete(scratch, recursive: true);
        }
    }

    [Rule("Processor invocation with a marker but no run metadata emits codes 'LD-COV-040', 'LD-COV-041', 'LD-COV-050', and 'LD-COV-053' while preserving '2' input attachment sets unchanged")]
    public async Task Processor_reports_missing_run_metadata()
    {
        var expected = Rule.Values.As<string, string, string, string, int>();
        var scratch = CreateScratchDirectory();
        try
        {
            var coveragePath = Path.Combine(scratch, "coverage.cobertura.xml");
            File.WriteAllText(coveragePath, "<coverage><packages /></coverage>");
            var set = new AttachmentSet(
                LiveDocCoverageAttachmentProcessor.MicrosoftCodeCoverageUri,
                "Code Coverage");
            set.Attachments.Add(UriDataAttachment.CreateFrom(coveragePath, "coverage"));
            var markerPath = Path.Combine(
                scratch,
                $"spec{LiveDocCoverageDataCollector.MarkerFileSuffix}");
            File.WriteAllText(markerPath, JsonSerializer.Serialize(new LiveDocCoverageInvocationMarker
            {
                MetadataDir = scratch,
                InitializedAtUtc = DateTime.UtcNow.AddSeconds(-1)
            }));
            var markerSet = new AttachmentSet(
                LiveDocCoverageDataCollector.CollectorUri,
                LiveDocCoverageDataCollector.FriendlyName);
            markerSet.Attachments.Add(UriDataAttachment.CreateFrom(markerPath, "invocation"));
            var attachments = new Collection<AttachmentSet> { markerSet, set };
            var logger = new RecordingMessageLogger();
            var configuration = LoadConfiguration(scratch);

            var result = await new LiveDocCoverageAttachmentProcessor().ProcessAttachmentSetsAsync(
                configuration,
                attachments,
                new Progress<int>(),
                logger,
                CancellationToken.None);

            var combined = string.Join(Environment.NewLine, logger.Messages);
            foreach (var code in new[] { expected.Item1, expected.Item2, expected.Item3, expected.Item4 })
                Assert.Contains(code, combined);
            Assert.Equal(expected.Item5, result.Count);
            Assert.Same(markerSet, result.ElementAt(0));
            Assert.Same(set, result.ElementAt(1));
        }
        finally
        {
            Directory.Delete(scratch, recursive: true);
        }
    }

    [Rule("Marker-first then coverage-later with fresh processors accepts a fresh-mtime disk marker initialized '6' hours earlier, posts '1' current run, posts '0' old-mtime runs, and emits neither 'LD-COV-043' nor 'LD-COV-045'")]
    public async Task Marker_first_split_delivery_uses_disk_marker_completion_time()
    {
        var expected = Rule.Values.As<int, int, int, string, string>();
        var scratch = CreateScratchDirectory();
        var staleDir = Path.Combine(scratch, "stale");
        var currentDir = Path.Combine(scratch, "current");
        Directory.CreateDirectory(staleDir);
        Directory.CreateDirectory(currentDir);
        try
        {
            var staleMarkerSet = CreateMarkerSet(staleDir, DateTime.UtcNow.AddMinutes(-10));
            File.SetLastWriteTimeUtc(
                AttachmentPath(staleMarkerSet.Attachments.Single()),
                DateTime.UtcNow.AddMinutes(-10));
            WriteRunMetadata(staleDir, "stale-run");
            WriteRunMetadata(currentDir, "current-run");

            var currentMarkerSet = CreateMarkerSet(
                currentDir,
                DateTime.UtcNow.AddHours(-expected.Item1));
            var firstResult = await new LiveDocCoverageAttachmentProcessor()
                .ProcessAttachmentSetsAsync(
                    LoadConfiguration(scratch),
                    new Collection<AttachmentSet> { currentMarkerSet },
                    new Progress<int>(),
                    new RecordingMessageLogger(),
                    CancellationToken.None);

            var postedEndpoints = new List<string>();
            var logger = new RecordingMessageLogger();
            var coverageSet = CreateCoverageSet(scratch);
            var secondResult = await new LiveDocCoverageAttachmentProcessor((endpoint, _) =>
                {
                    postedEndpoints.Add(endpoint);
                    return SuccessfulUpload();
                })
                .ProcessAttachmentSetsAsync(
                    LoadConfiguration(scratch),
                    new Collection<AttachmentSet> { coverageSet },
                    new Progress<int>(),
                    logger,
                    CancellationToken.None);

            Assert.Single(firstResult);
            Assert.Same(currentMarkerSet, firstResult.Single());
            Assert.Single(secondResult);
            Assert.Same(coverageSet, secondResult.Single());
            Assert.Equal(expected.Item2, postedEndpoints.Count(endpoint =>
                endpoint.Contains("current-run", StringComparison.Ordinal)));
            Assert.Equal(expected.Item3, postedEndpoints.Count(endpoint =>
                endpoint.Contains("stale-run", StringComparison.Ordinal)));
            Assert.DoesNotContain(logger.Messages, message =>
                message.Contains(expected.Item4, StringComparison.Ordinal) ||
                message.Contains(expected.Item5, StringComparison.Ordinal));
        }
        finally
        {
            Directory.Delete(scratch, recursive: true);
        }
    }

    [Rule("Coverage-first then marker-later with fresh processors returns '1' coverage set, emits 'LD-COV-044', posts '1' run after re-feed, and returns '2' sets unchanged")]
    public async Task Coverage_first_split_delivery_posts_after_marker_re_feed()
    {
        var (expectedFirstSetCount, pendingCode, expectedPosts, expectedSecondSetCount) =
            Rule.Values.As<int, string, int, int>();
        var scratch = CreateScratchDirectory();
        try
        {
            WriteRunMetadata(scratch, "coverage-first-run");
            var postedEndpoints = new List<string>();
            LiveDocPostRunCoverage.CoverageUploader uploader = (endpoint, _) =>
            {
                postedEndpoints.Add(endpoint);
                return SuccessfulUpload();
            };
            var coverageSet = CreateCoverageSet(scratch);
            var firstLogger = new RecordingMessageLogger();

            var firstResult = await new LiveDocCoverageAttachmentProcessor(uploader)
                .ProcessAttachmentSetsAsync(
                    LoadConfiguration(scratch),
                    new Collection<AttachmentSet> { coverageSet },
                    new Progress<int>(),
                    firstLogger,
                    CancellationToken.None);

            var markerSet = CreateMarkerSet(scratch, DateTime.UtcNow);
            var secondInput = new Collection<AttachmentSet>(firstResult.ToList())
            {
                markerSet
            };
            var secondResult = await new LiveDocCoverageAttachmentProcessor(uploader)
                .ProcessAttachmentSetsAsync(
                    LoadConfiguration(scratch),
                    secondInput,
                    new Progress<int>(),
                    new RecordingMessageLogger(),
                    CancellationToken.None);

            Assert.Equal(expectedFirstSetCount, firstResult.Count);
            Assert.Same(coverageSet, firstResult.Single());
            Assert.Contains(firstLogger.Messages, message =>
                message.Contains(pendingCode, StringComparison.Ordinal));
            Assert.Equal(expectedPosts, postedEndpoints.Count);
            Assert.Contains("coverage-first-run", postedEndpoints.Single());
            Assert.Equal(expectedSecondSetCount, secondResult.Count);
            Assert.Same(coverageSet, secondResult.ElementAt(0));
            Assert.Same(markerSet, secondResult.ElementAt(1));
        }
        finally
        {
            Directory.Delete(scratch, recursive: true);
        }
    }

    [Rule("Two current markers plus '2' coverage sets post to '2' distinct runs and return '4' input sets unchanged")]
    public async Task Multiple_markers_target_all_runs()
    {
        var (expectedCoverageSets, expectedPosts, expectedReturnedSets) =
            Rule.Values.As<int, int, int>();
        var scratch = CreateScratchDirectory();
        var firstDir = Path.Combine(scratch, "first");
        var secondDir = Path.Combine(scratch, "second");
        Directory.CreateDirectory(firstDir);
        Directory.CreateDirectory(secondDir);
        try
        {
            WriteRunMetadata(firstDir, "run-one");
            WriteRunMetadata(secondDir, "run-two");
            var endpoints = new List<string>();
            var processor = new LiveDocCoverageAttachmentProcessor((endpoint, _) =>
            {
                endpoints.Add(endpoint);
                return SuccessfulUpload();
            });
            var firstMarkerSet = CreateMarkerSet(firstDir, DateTime.UtcNow);
            var secondMarkerSet = CreateMarkerSet(secondDir, DateTime.UtcNow);
            var firstCoverageSet = CreateCoverageSet(scratch);
            var secondCoverageSet = CreateCoverageSet(scratch);
            var attachments = new Collection<AttachmentSet>
            {
                firstMarkerSet,
                secondMarkerSet,
                firstCoverageSet,
                secondCoverageSet
            };

            var result = await processor.ProcessAttachmentSetsAsync(
                LoadConfiguration(scratch),
                attachments,
                new Progress<int>(),
                new RecordingMessageLogger(),
                CancellationToken.None);

            Assert.Equal(expectedCoverageSets, attachments.Count(IsCoverageSet));
            Assert.Equal(expectedPosts, endpoints.Count);
            Assert.Contains(endpoints, endpoint => endpoint.Contains("run-one", StringComparison.Ordinal));
            Assert.Contains(endpoints, endpoint => endpoint.Contains("run-two", StringComparison.Ordinal));
            Assert.Equal(expectedReturnedSets, result.Count);
            Assert.Same(firstMarkerSet, result.ElementAt(0));
            Assert.Same(secondMarkerSet, result.ElementAt(1));
            Assert.Same(firstCoverageSet, result.ElementAt(2));
            Assert.Same(secondCoverageSet, result.ElementAt(3));
        }
        finally
        {
            Directory.Delete(scratch, recursive: true);
        }
    }

    [Rule("Associative re-feed with fresh processors posts '1' time, returns '2' sets unchanged each round, emits 'LD-COV-080', then emits 'LD-COV-081' without 'LD-COV-064'")]
    public async Task Associative_re_feed_is_idempotent_across_fresh_processors()
    {
        var (expectedPosts, expectedSetCount, acceptedCode, skipCode, repeatedParseCode) =
            Rule.Values.As<int, int, string, string, string>();
        var scratch = CreateScratchDirectory();
        try
        {
            WriteRunMetadata(scratch, "idempotent-run");
            var posts = 0;
            LiveDocPostRunCoverage.CoverageUploader uploader = (_, _) =>
            {
                posts++;
                return SuccessfulUpload();
            };
            var markerSet = CreateMarkerSet(scratch, DateTime.UtcNow);
            var coverageSet = CreateCoverageSet(scratch);
            var attachments = new Collection<AttachmentSet> { markerSet, coverageSet };
            var firstLogger = new RecordingMessageLogger();
            var secondLogger = new RecordingMessageLogger();

            var firstResult = await new LiveDocCoverageAttachmentProcessor(uploader)
                .ProcessAttachmentSetsAsync(
                    LoadConfiguration(scratch),
                    attachments,
                    new Progress<int>(),
                    firstLogger,
                    CancellationToken.None);
            var secondResult = await new LiveDocCoverageAttachmentProcessor(uploader)
                .ProcessAttachmentSetsAsync(
                    LoadConfiguration(scratch),
                    firstResult,
                    new Progress<int>(),
                    secondLogger,
                    CancellationToken.None);

            Assert.Equal(expectedPosts, posts);
            Assert.Equal(expectedSetCount, firstResult.Count);
            Assert.Same(markerSet, firstResult.ElementAt(0));
            Assert.Same(coverageSet, firstResult.ElementAt(1));
            Assert.Equal(expectedSetCount, secondResult.Count);
            Assert.Same(markerSet, secondResult.ElementAt(0));
            Assert.Same(coverageSet, secondResult.ElementAt(1));
            Assert.Contains(firstLogger.Messages, message =>
                message.Contains(acceptedCode, StringComparison.Ordinal) &&
                message.Contains("server-accepted", StringComparison.Ordinal));
            Assert.Contains(secondLogger.Messages, message =>
                message.Contains(skipCode, StringComparison.Ordinal));
            Assert.DoesNotContain(secondLogger.Messages, message =>
                message.Contains(repeatedParseCode, StringComparison.Ordinal));
        }
        finally
        {
            Directory.Delete(scratch, recursive: true);
        }
    }

    [Rule("A richer callback with '1' additional coverage artifact performs '2' uploads")]
    public async Task Richer_callback_replaces_partial_coverage_dataset()
    {
        var (additionalArtifacts, expectedPosts) = Rule.Values.As<int, int>();
        var scratch = CreateScratchDirectory();
        try
        {
            WriteRunMetadata(scratch, "richer-run");
            var posts = 0;
            LiveDocPostRunCoverage.CoverageUploader uploader = (_, _) =>
            {
                posts++;
                return SuccessfulUpload();
            };
            var markerSet = CreateMarkerSet(scratch, DateTime.UtcNow);
            var firstCoverageSet = CreateCoverageSet(scratch);
            var initialAttachments = new Collection<AttachmentSet> { markerSet, firstCoverageSet };

            await new LiveDocCoverageAttachmentProcessor(uploader)
                .ProcessAttachmentSetsAsync(
                    LoadConfiguration(scratch),
                    initialAttachments,
                    new Progress<int>(),
                    new RecordingMessageLogger(),
                    CancellationToken.None);

            var richerAttachments = new Collection<AttachmentSet>(initialAttachments.ToList());
            for (var i = 0; i < additionalArtifacts; i++)
                richerAttachments.Add(CreateCoverageSet(scratch));

            await new LiveDocCoverageAttachmentProcessor(uploader)
                .ProcessAttachmentSetsAsync(
                    LoadConfiguration(scratch),
                    richerAttachments,
                    new Progress<int>(),
                    new RecordingMessageLogger(),
                    CancellationToken.None);

            Assert.Equal(expectedPosts, posts);
        }
        finally
        {
            Directory.Delete(scratch, recursive: true);
        }
    }

    [Rule("An authoritative marker with '1' foreign disk marker posts only '1' attached run")]
    public async Task Authoritative_marker_excludes_foreign_disk_markers()
    {
        var (foreignMarkerCount, expectedPosts) = Rule.Values.As<int, int>();
        var scratch = CreateScratchDirectory();
        try
        {
            var attachedDir = Path.Combine(scratch, "attached");
            var foreignDir = Path.Combine(scratch, "foreign");
            Directory.CreateDirectory(attachedDir);
            Directory.CreateDirectory(foreignDir);
            WriteRunMetadata(attachedDir, "attached-run");
            WriteRunMetadata(foreignDir, "foreign-run");
            var attachedMarker = CreateMarkerSet(attachedDir, DateTime.UtcNow);
            for (var i = 0; i < foreignMarkerCount; i++)
                CreateMarkerSet(foreignDir, DateTime.UtcNow);

            var coverage = CreateCoverageSet(attachedDir);
            var endpoints = new List<string>();
            LiveDocPostRunCoverage.CoverageUploader uploader = (endpoint, _) =>
            {
                endpoints.Add(endpoint);
                return SuccessfulUpload();
            };

            await new LiveDocCoverageAttachmentProcessor(uploader)
                .ProcessAttachmentSetsAsync(
                    LoadConfiguration(scratch),
                    new Collection<AttachmentSet> { attachedMarker, coverage },
                    new Progress<int>(),
                    new RecordingMessageLogger(),
                    CancellationToken.None);

            Assert.Equal(expectedPosts, endpoints.Count);
            Assert.Contains("attached-run", endpoints[0], StringComparison.Ordinal);
            Assert.DoesNotContain(endpoints, endpoint =>
                endpoint.Contains("foreign-run", StringComparison.Ordinal));
        }
        finally
        {
            Directory.Delete(scratch, recursive: true);
        }
    }

    [Rule("Authoritative marker initialized '30' days earlier with an old file mtime posts '1' run and emits no 'LD-COV-045'")]
    public async Task Authoritative_marker_is_accepted_at_arbitrary_age()
    {
        var (initializedDaysAgo, expectedPosts, rejectedCode) =
            Rule.Values.As<int, int, string>();
        var scratch = CreateScratchDirectory();
        try
        {
            WriteRunMetadata(scratch, "authoritative-run");
            var markerSet = CreateMarkerSet(
                scratch,
                DateTime.UtcNow.AddDays(-initializedDaysAgo));
            File.SetLastWriteTimeUtc(
                AttachmentPath(markerSet.Attachments.Single()),
                DateTime.UtcNow.AddDays(-initializedDaysAgo));
            var coverageSet = CreateCoverageSet(scratch);
            var posts = 0;
            var logger = new RecordingMessageLogger();

            var result = await new LiveDocCoverageAttachmentProcessor((_, _) =>
            {
                posts++;
                return SuccessfulUpload();
            }).ProcessAttachmentSetsAsync(
                LoadConfiguration(scratch),
                new Collection<AttachmentSet> { markerSet, coverageSet },
                new Progress<int>(),
                logger,
                CancellationToken.None);

            Assert.Equal(expectedPosts, posts);
            Assert.Same(markerSet, result.ElementAt(0));
            Assert.Same(coverageSet, result.ElementAt(1));
            Assert.DoesNotContain(logger.Messages, message =>
                message.Contains(rejectedCode, StringComparison.Ordinal));
        }
        finally
        {
            Directory.Delete(scratch, recursive: true);
        }
    }

    [Rule("Failed HTTP upload emits 'LD-COV-071', writes '0' accepted sentinels, then a fresh processor succeeds on attempt '2' and writes '1' sentinel")]
    public async Task Failed_upload_remains_retryable()
    {
        var (failureCode, expectedFailedSentinels, expectedAttempts, expectedSuccessSentinels) =
            Rule.Values.As<string, int, int, int>();
        var scratch = CreateScratchDirectory();
        try
        {
            WriteRunMetadata(scratch, "retry-run");
            var attempts = 0;
            LiveDocPostRunCoverage.CoverageUploader uploader = (_, _) =>
            {
                attempts++;
                return attempts == 1
                    ? new LiveDocPostRunCoverage.CoverageUploadResult(
                        false,
                        "503 Service Unavailable",
                        """{"error":"retry"}""")
                    : SuccessfulUpload();
            };
            var attachments = new Collection<AttachmentSet>
            {
                CreateMarkerSet(scratch, DateTime.UtcNow),
                CreateCoverageSet(scratch)
            };
            var firstLogger = new RecordingMessageLogger();

            await new LiveDocCoverageAttachmentProcessor(uploader)
                .ProcessAttachmentSetsAsync(
                    LoadConfiguration(scratch),
                    attachments,
                    new Progress<int>(),
                    firstLogger,
                    CancellationToken.None);
            Assert.Equal(
                expectedFailedSentinels,
                Directory.EnumerateFiles(scratch, "*.coverage-accepted").Count());

            await new LiveDocCoverageAttachmentProcessor(uploader)
                .ProcessAttachmentSetsAsync(
                    LoadConfiguration(scratch),
                    attachments,
                    new Progress<int>(),
                    new RecordingMessageLogger(),
                    CancellationToken.None);

            Assert.Equal(expectedAttempts, attempts);
            Assert.Contains(firstLogger.Messages, message =>
                message.Contains(failureCode, StringComparison.Ordinal));
            Assert.Equal(
                expectedSuccessSentinels,
                Directory.EnumerateFiles(scratch, "*.coverage-accepted").Count());
        }
        finally
        {
            Directory.Delete(scratch, recursive: true);
        }
    }

    [Rule("A marker-only ordinary run emits informational code 'LD-COV-051' without warning or error messages")]
    public async Task No_coverage_run_is_informational()
        {
            var expectedCode = Rule.Values[0].AsString();
            var scratch = CreateScratchDirectory();
            try
            {
                var logger = new RecordingMessageLogger();
                await new LiveDocCoverageAttachmentProcessor().ProcessAttachmentSetsAsync(
                    LoadConfiguration(scratch),
                    new Collection<AttachmentSet> { CreateMarkerSet(scratch, DateTime.UtcNow) },
                    new Progress<int>(),
                    logger,
                    CancellationToken.None);

                Assert.Contains(logger.Messages, message =>
                    message.Level == TestMessageLevel.Informational &&
                    message.Text.Contains(expectedCode, StringComparison.Ordinal));
                Assert.DoesNotContain(logger.Messages, message =>
                    message.Level is TestMessageLevel.Warning or TestMessageLevel.Error);
            }
            finally
            {
                Directory.Delete(scratch, recursive: true);
            }
        }

    [Rule("Metadata older than the invocation emits code 'LD-COV-054' and does not contact the server")]
    public void Stale_metadata_is_rejected()
    {
        var expectedCode = Rule.Values[0].AsString();
        var scratch = CreateScratchDirectory();
        try
        {
            var coveragePath = Path.Combine(scratch, "coverage.cobertura.xml");
            File.WriteAllText(coveragePath, "<coverage><packages /></coverage>");
            var metadataPath = Path.Combine(scratch, "stale-run.json");
            File.WriteAllText(
                metadataPath,
                """{"protocolVersion":"1.0","runId":"stale-run","serverUrl":"http://127.0.0.1:1"}""");
            File.SetLastWriteTimeUtc(metadataPath, DateTime.UtcNow.AddMinutes(-10));

            var set = new AttachmentSet(
                LiveDocCoverageAttachmentProcessor.MicrosoftCodeCoverageUri,
                "Code Coverage");
            set.Attachments.Add(UriDataAttachment.CreateFrom(coveragePath, "coverage"));

            var messages = LiveDocPostRunCoverage.Publish(
                [set],
                scratch,
                reportMissingMetadata: true,
                metadataNotBeforeUtc: DateTime.UtcNow,
                includeFallbackMetadataRoot: false);

            Assert.Contains(messages, message => message.Contains(expectedCode, StringComparison.Ordinal));
            Assert.DoesNotContain(messages, message => message.Contains("LD-COV-070", StringComparison.Ordinal));
        }
        finally
        {
            Directory.Delete(scratch, recursive: true);
        }
    }

    private static XmlElement LoadConfiguration(string metadataRoot)
    {
        var document = new XmlDocument();
        document.LoadXml(
            $"<Configuration><RunMetadataRoot>{System.Security.SecurityElement.Escape(metadataRoot)}</RunMetadataRoot></Configuration>");
        return document.DocumentElement!;
    }

    private static void AssertCollectorInvocationIdentity(
        bool initializeFirst,
        int expectedDirectoryCount,
        int expectedMarkerCount)
    {
        var scratch = CreateScratchDirectory();
        var originalMetadataDir = Environment.GetEnvironmentVariable(
            LiveDocPostRunCoverage.RunMetadataDirEnvironmentVariable);
        try
        {
            using var collector = new LiveDocCoverageDataCollector();
            var configuration = LoadConfiguration(scratch);
            string initializedDirectory;
            string environmentDirectory;
            string initializedMarker;
            string environmentMarker;

            if (initializeFirst)
            {
                initializedDirectory = collector.GetOrCreateInvocationMetadataDirectory(configuration);
                initializedMarker = collector.InvocationMarkerPath;
                environmentDirectory = collector.GetTestExecutionEnvironmentVariables().Single().Value;
                environmentMarker = collector.InvocationMarkerPath;
            }
            else
            {
                environmentDirectory = collector.GetTestExecutionEnvironmentVariables().Single().Value;
                environmentMarker = collector.InvocationMarkerPath;
                initializedDirectory = collector.GetOrCreateInvocationMetadataDirectory(configuration);
                initializedMarker = collector.InvocationMarkerPath;
            }

            Assert.Equal(expectedDirectoryCount, new[] { initializedDirectory, environmentDirectory }
                .Distinct(StringComparer.OrdinalIgnoreCase).Count());
            Assert.Equal(expectedMarkerCount, new[] { initializedMarker, environmentMarker }
                .Distinct(StringComparer.OrdinalIgnoreCase).Count());
        }
        finally
        {
            Environment.SetEnvironmentVariable(
                LiveDocPostRunCoverage.RunMetadataDirEnvironmentVariable,
                originalMetadataDir);
            Directory.Delete(scratch, recursive: true);
        }
    }

    private static AttachmentSet CreateMarkerSet(string metadataDir, DateTime initializedAtUtc)
    {
        Directory.CreateDirectory(metadataDir);
        var markerPath = Path.Combine(
            metadataDir,
            $"{Guid.NewGuid():N}{LiveDocCoverageDataCollector.MarkerFileSuffix}");
        File.WriteAllText(markerPath, JsonSerializer.Serialize(new LiveDocCoverageInvocationMarker
        {
            MetadataDir = metadataDir,
            InitializedAtUtc = initializedAtUtc
        }));
        var markerSet = new AttachmentSet(
            LiveDocCoverageDataCollector.CollectorUri,
            LiveDocCoverageDataCollector.FriendlyName);
        markerSet.Attachments.Add(UriDataAttachment.CreateFrom(markerPath, "invocation"));
        return markerSet;
    }

    private static AttachmentSet CreateCoverageSet(string directory)
    {
        Directory.CreateDirectory(directory);
        var coveragePath = Path.Combine(directory, $"coverage-{Guid.NewGuid():N}.cobertura.xml");
        File.WriteAllText(coveragePath, "<coverage><packages /></coverage>");
        var set = new AttachmentSet(
            LiveDocCoverageAttachmentProcessor.MicrosoftCodeCoverageUri,
            "Code Coverage");
        set.Attachments.Add(UriDataAttachment.CreateFrom(coveragePath, "coverage"));
        return set;
    }

    private static void WriteRunMetadata(string metadataDir, string runId)
    {
        File.WriteAllText(
            Path.Combine(metadataDir, $"{runId}.json"),
            JsonSerializer.Serialize(new
            {
                protocolVersion = "1.0",
                runId,
                serverUrl = "http://127.0.0.1:3100"
            }));
    }

    private static string AttachmentPath(UriDataAttachment attachment)
    {
        return attachment.Uri.IsFile ? attachment.Uri.LocalPath : attachment.Uri.ToString();
    }

    private static bool IsCoverageSet(AttachmentSet set)
    {
        return set.Uri.Equals(LiveDocCoverageAttachmentProcessor.MicrosoftCodeCoverageUri) ||
               set.Uri.Equals(LiveDocCoverageAttachmentProcessor.CoverletCodeCoverageUri);
    }

    private static LiveDocPostRunCoverage.CoverageUploadResult SuccessfulUpload(
        string status = "200 OK")
    {
        return new LiveDocPostRunCoverage.CoverageUploadResult(
            true,
            status,
            """{"success":true,"persistence":{"completed":true},"broadcast":{"matched":1,"sent":1,"failed":0},"restHydration":{"available":true}}""");
    }

    private static string CreateScratchDirectory()
    {
        var path = Path.Combine(
            AppContext.BaseDirectory,
            "collector-spec-data",
            Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(path);
        return path;
    }

    private sealed class RecordingMessageLogger : IMessageLogger
    {
        public List<RecordedMessage> Messages { get; } = [];

        public void SendMessage(TestMessageLevel testMessageLevel, string message)
        {
            Messages.Add(new RecordedMessage(testMessageLevel, message));
        }
    }

    private sealed record RecordedMessage(TestMessageLevel Level, string Text)
    {
        public bool Contains(string value, StringComparison comparison)
        {
            return Text.Contains(value, comparison);
        }

        public override string ToString()
        {
            return $"{Level}: {Text}";
        }
    }
}
