namespace ShippingSample;

/// <summary>
/// Simple shopping cart for demonstration purposes.
/// </summary>
public class ShoppingCart
{
    public string Country { get; set; } = "";
    public List<CartItem> Items { get; } = new();
    public decimal Subtotal { get; private set; }
    public decimal GST { get; private set; }
    public decimal Shipping { get; private set; }
    public string ShippingType { get; private set; } = "";
    public decimal Total { get; private set; }

    public void AddItem(CartItem item)
    {
        Items.Add(item);
    }

    public void Calculate()
    {
        // Calculate subtotal
        Subtotal = Items.Sum(i => i.Price * i.Quantity);

        // Calculate GST (10% for Australia only)
        if (Country == "Australia")
        {
            GST = Math.Round(Subtotal * 0.1m, 3);
        }
        else
        {
            GST = 0;
        }

        // Calculate shipping
        if (Country == "Australia" && Subtotal >= 100)
        {
            Shipping = 0;
            ShippingType = "Free";
        }
        else if (Country == "Australia")
        {
            Shipping = 9.95m;
            ShippingType = "Standard Domestic";
        }
        else
        {
            Shipping = 25.00m;
            ShippingType = "Standard International";
        }

        Total = Subtotal + GST + Shipping;
    }
}

public class CartItem
{
    public string Name { get; set; } = "";
    public decimal Price { get; set; }
    public int Quantity { get; set; } = 1;
}
