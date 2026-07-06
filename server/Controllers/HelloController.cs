using Microsoft.AspNetCore.Mvc;

namespace server.Controllers;

[ApiController] // An attribute that indicates that this class is an API controller, which means it can handle HTTP requests and return responses.
[Route("api/[controller]")]
public class HelloController : ControllerBase
{
    [HttpGet]
    public IActionResult Get()
    {
        return Ok("Hello from .NET!");
    }
}