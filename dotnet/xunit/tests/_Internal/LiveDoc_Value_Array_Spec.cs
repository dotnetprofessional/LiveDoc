using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Core;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests._Internal;

/// <summary>
/// Specification: LiveDocValueArray
/// 
/// Unit tests for the LiveDocValueArray class that provides
/// bounds-checked access to extracted values.
/// </summary>
[Specification(Description = @"
    LiveDocValueArray provides bounds-checked indexing over extracted values.
    It supports tuple deconstruction and typed conversion via As<T1,T2,...>,
    throwing LiveDocValueIndexException with helpful context on out-of-range access.")]
public class LiveDoc_Value_Array_Spec : SpecificationTest
{
    public LiveDoc_Value_Array_Spec(ITestOutputHelper output) : base(output)
    {
    }

    #region Count Property

    [Rule("Empty array has count 0")]
    public void Empty_array_has_count_zero()
    {
        var array = CreateArray();
        Assert.Equal(0, array.Count);
    }

    [Rule("Array with values has correct count")]
    public void Array_with_values_has_correct_count()
    {
        var array = CreateArray("one", "two", "three");
        Assert.Equal(3, array.Count);
    }

    #endregion

    #region Indexer

    [Rule("Valid index returns correct value")]
    public void Valid_index_returns_correct_value()
    {
        var array = CreateArray("first", "second", "third");
        
        Assert.Equal("first", array[0].AsString());
        Assert.Equal("second", array[1].AsString());
        Assert.Equal("third", array[2].AsString());
    }

    [Rule("Negative index throws with context")]
    public void Negative_index_throws_with_context()
    {
        var array = CreateArray("one", "two");
        
        var ex = Assert.Throws<LiveDocValueIndexException>(() => array[-1]);
        
        Assert.Equal(-1, ex.RequestedIndex);
        Assert.Equal(2, ex.AvailableCount);
        Assert.Contains("test step", ex.StepTitle);
    }

    [Rule("Index equal to count throws with context")]
    public void Index_equal_to_count_throws()
    {
        var array = CreateArray("one", "two");
        
        var ex = Assert.Throws<LiveDocValueIndexException>(() => array[2]);
        
        Assert.Equal(2, ex.RequestedIndex);
        Assert.Equal(2, ex.AvailableCount);
    }

    [Rule("Index greater than count throws with context")]
    public void Index_greater_than_count_throws()
    {
        var array = CreateArray("one");
        
        var ex = Assert.Throws<LiveDocValueIndexException>(() => array[99]);
        
        Assert.Equal(99, ex.RequestedIndex);
        Assert.Equal(1, ex.AvailableCount);
    }

    [Rule("Accessing empty array throws with helpful message")]
    public void Accessing_empty_array_throws()
    {
        var array = CreateArray();
        
        var ex = Assert.Throws<LiveDocValueIndexException>(() => array[0]);
        
        Assert.Equal(0, ex.RequestedIndex);
        Assert.Equal(0, ex.AvailableCount);
        Assert.Contains("0 values available", ex.Message);
    }

    #endregion

    #region Tuple Deconstruction

    [Rule("Deconstruct 2 values")]
    public void Deconstruct_two_values()
    {
        var array = CreateArray("hello", "42");
        
        var (first, second) = array;
        
        Assert.Equal("hello", first.AsString());
        Assert.Equal("42", second.AsString());
    }

    [Rule("Deconstruct 3 values")]
    public void Deconstruct_three_values()
    {
        var array = CreateArray("a", "b", "c");
        
        var (v1, v2, v3) = array;
        
        Assert.Equal("a", v1.AsString());
        Assert.Equal("b", v2.AsString());
        Assert.Equal("c", v3.AsString());
    }

    #endregion

    #region Typed Tuple Deconstruction

    [Rule("As<T1, T2> returns typed tuple")]
    public void As_T1_T2_returns_typed_tuple()
    {
        var array = CreateArray("John", "30");
        
        var (name, age) = array.As<string, int>();
        
        Assert.Equal("John", name);
        Assert.Equal(30, age);
    }

    [Rule("As<T1, T2, T3> returns typed tuple")]
    public void As_T1_T2_T3_returns_typed_tuple()
    {
        var array = CreateArray("Product", "5", "9.99");
        
        var (name, qty, price) = array.As<string, int, decimal>();
        
        Assert.Equal("Product", name);
        Assert.Equal(5, qty);
        Assert.Equal(9.99m, price);
    }

    [Rule("As<T1, T2, T3, T4> returns typed tuple")]
    public void As_T1_T2_T3_T4_returns_typed_tuple()
    {
        var array = CreateArray("a", "1", "true", "2.5");
        
        var (s, i, b, d) = array.As<string, int, bool, double>();
        
        Assert.Equal("a", s);
        Assert.Equal(1, i);
        Assert.True(b);
        Assert.Equal(2.5, d);
    }

    [Rule("Typed deconstruction throws on conversion error")]
    public void Typed_deconstruction_throws_on_conversion_error()
    {
        var array = CreateArray("not-a-number", "42");
        
        Assert.Throws<LiveDocConversionException>(() =>
        {
            var (first, _) = array.As<int, int>();
            _ = first;
        });
    }

    #endregion

    #region Helper

    private static LiveDocValueArray CreateArray(params string[] values)
    {
        var liveDocValues = values.Select(v => new LiveDocValue(v, "test step")).ToArray();
        return new LiveDocValueArray(liveDocValues, "test step");
    }

    #endregion
}
