using System.Collections.Concurrent;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

var store = new ConcurrentDictionary<int, Item>();
var nextId = 0;

app.MapGet("/health", () => Results.Ok(new
{
    status = "healthy",
    timestamp = DateTime.UtcNow
}));

app.MapGet("/api/items", () => Results.Ok(store.Values.OrderBy(i => i.Id).ToArray()));

app.MapPost("/api/items", (CreateItemRequest request) =>
{
    var id = Interlocked.Increment(ref nextId);
    var item = new Item(id, request.Name, DateTime.UtcNow);
    store[id] = item;
    return Results.Created($"/api/items/{id}", item);
});

app.MapGet("/api/items/{id:int}", (int id) =>
    store.TryGetValue(id, out var item)
        ? Results.Ok(item)
        : Results.NotFound());

app.MapDelete("/api/items/{id:int}", (int id) =>
    store.TryRemove(id, out _)
        ? Results.NoContent()
        : Results.NotFound());

app.Run();

record Item(int Id, string Name, DateTime CreatedAt);
record CreateItemRequest(string Name);
