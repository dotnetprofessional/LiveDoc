using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using Newtonsoft.Json.Linq;

namespace SweDevTools.LiveDoc.xUnit.Core;

internal sealed class NewtonsoftJsonTokenConverterFactory : JsonConverterFactory
{
    public override bool CanConvert(Type typeToConvert) => typeof(JToken).IsAssignableFrom(typeToConvert);

    public override JsonConverter CreateConverter(Type typeToConvert, JsonSerializerOptions options)
        => (JsonConverter)Activator.CreateInstance(
            typeof(TokenConverter<>).MakeGenericType(typeToConvert), nonPublic: true)!;

    private sealed class TokenConverter<TToken> : JsonConverter<TToken> where TToken : JToken
    {
        public override TToken Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
            => throw new NotSupportedException("The JSON attachment token converter only supports serialization.");

        public override void Write(Utf8JsonWriter writer, TToken value, JsonSerializerOptions options)
        {
            if (value is JProperty)
                throw UnsupportedToken(value);

            IEnumerable<JToken> tokens = value is JContainer container
                ? container.DescendantsAndSelf()
                : new[] { value };
            foreach (var token in tokens)
            {
                if (token.Type is JTokenType.Constructor or JTokenType.Raw or JTokenType.Undefined or JTokenType.Comment)
                    throw UnsupportedToken(token);
            }

            // WriteTo quotes scalar JValues and preserves Newtonsoft's number/escaping semantics.
            using var text = new StringWriter(CultureInfo.InvariantCulture);
            using (var tokenWriter = new Newtonsoft.Json.JsonTextWriter(text)
            {
                Formatting = options.WriteIndented ? Newtonsoft.Json.Formatting.Indented : Newtonsoft.Json.Formatting.None
            })
            {
                value.WriteTo(tokenWriter);
            }
            writer.WriteRawValue(text.ToString(), skipInputValidation: false);
        }

        private static JsonException UnsupportedToken(JToken token)
            => new($"AttachJson cannot serialize Newtonsoft token type '{token.Type}' as a standard JSON value. " +
                "Use JObject, JArray, or a JSON-compatible JValue; place properties inside a JObject " +
                "and parse raw JSON into a standard token first.");
    }
}
