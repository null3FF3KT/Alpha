using ApiCSharp.Functions;
using FluentAssertions;
using Xunit;

namespace ApiCSharp.Tests;

public class HttpIngestTests
{
    [Fact]
    public void PngSignature_IsDetected()
    {
        var png = new byte[] {0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,0x00};
        HttpIngest.IsPng(png).Should().BeTrue();
    }

    [Fact]
    public void JpegSignature_IsDetected()
    {
        var jpg = new byte[] {0xFF,0xD8,0x01,0x02,0xFF,0xD9};
        HttpIngest.IsJpeg(jpg).Should().BeTrue();
    }
}
