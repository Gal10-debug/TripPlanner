using System.Net.Http.Json;
using System.Text.Json.Serialization;
using server.Models;

namespace server.Services;

public class WeatherService(HttpClient httpClient)
{
    public async Task<object> GetForecastAsync(Trip trip)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (trip.EndDate < today)
        {
            return new { available = false, reason = "past", message = "This trip has already ended." };
        }

        if (trip.StartDate > today.AddDays(15))
        {
            var daysUntilAvailable = trip.StartDate.DayNumber - today.AddDays(15).DayNumber;
            return new { available = false, reason = "too-early", daysUntilAvailable, message = $"A live forecast will appear in {daysUntilAvailable} day{(daysUntilAvailable == 1 ? "" : "s")}." };
        }

        var query = Uri.EscapeDataString($"{trip.Destination}, {trip.Country}");
        var geocoding = await httpClient.GetFromJsonAsync<GeocodingResponse>($"https://geocoding-api.open-meteo.com/v1/search?name={query}&count=1&language=en&format=json");
        var location = geocoding?.Results?.FirstOrDefault();
        if (location is null)
        {
            return new { available = false, reason = "location", message = "We couldn't find this destination for a weather forecast." };
        }

        var url = $"https://api.open-meteo.com/v1/forecast?latitude={location.Latitude}&longitude={location.Longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=auto&forecast_days=16";
        var forecast = await httpClient.GetFromJsonAsync<ForecastResponse>(url);
        if (forecast?.Daily is null) throw new HttpRequestException("The weather provider returned no forecast data.");

        var days = forecast.Daily.Time.Select((date, index) => new
            {
                date,
                weatherCode = forecast.Daily.WeatherCode[index],
                temperatureMax = forecast.Daily.TemperatureMax[index],
                temperatureMin = forecast.Daily.TemperatureMin[index],
                precipitationProbability = forecast.Daily.PrecipitationProbability[index],
                windSpeedMax = forecast.Daily.WindSpeedMax[index]
            })
            .Where(day => day.weatherCode.HasValue
                && day.temperatureMax.HasValue
                && day.temperatureMin.HasValue
                && day.precipitationProbability.HasValue
                && day.windSpeedMax.HasValue
                && DateOnly.Parse(day.date) >= trip.StartDate
                && DateOnly.Parse(day.date) <= trip.EndDate)
            .Select(day => new
            {
                day.date,
                weatherCode = day.weatherCode!.Value,
                temperatureMax = day.temperatureMax!.Value,
                temperatureMin = day.temperatureMin!.Value,
                precipitationProbability = day.precipitationProbability!.Value,
                windSpeedMax = day.windSpeedMax!.Value
            })
            .ToList();

        return new
        {
            available = days.Count > 0,
            reason = days.Count > 0 ? (string?)null : "too-early",
            message = days.Count > 0 ? (string?)null : "The forecast is not available yet. Check again closer to departure.",
            location = new { name = location.Name, location.Country, location.Timezone },
            temperatureUnit = forecast.DailyUnits?.TemperatureMax ?? "°C",
            windSpeedUnit = forecast.DailyUnits?.WindSpeedMax ?? "km/h",
            days
        };
    }

    private sealed class GeocodingResponse { [JsonPropertyName("results")] public List<GeoLocation>? Results { get; set; } }
    private sealed class GeoLocation
    {
        [JsonPropertyName("name")] public string Name { get; set; } = string.Empty;
        [JsonPropertyName("country")] public string Country { get; set; } = string.Empty;
        [JsonPropertyName("timezone")] public string Timezone { get; set; } = string.Empty;
        [JsonPropertyName("latitude")] public double Latitude { get; set; }
        [JsonPropertyName("longitude")] public double Longitude { get; set; }
    }
    private sealed class ForecastResponse
    {
        [JsonPropertyName("daily")] public DailyForecast? Daily { get; set; }
        [JsonPropertyName("daily_units")] public DailyUnits? DailyUnits { get; set; }
    }
    private sealed class DailyForecast
    {
        [JsonPropertyName("time")] public List<string> Time { get; set; } = [];
        [JsonPropertyName("weather_code")] public List<int?> WeatherCode { get; set; } = [];
        [JsonPropertyName("temperature_2m_max")] public List<double?> TemperatureMax { get; set; } = [];
        [JsonPropertyName("temperature_2m_min")] public List<double?> TemperatureMin { get; set; } = [];
        [JsonPropertyName("precipitation_probability_max")] public List<int?> PrecipitationProbability { get; set; } = [];
        [JsonPropertyName("wind_speed_10m_max")] public List<double?> WindSpeedMax { get; set; } = [];
    }
    private sealed class DailyUnits
    {
        [JsonPropertyName("temperature_2m_max")] public string TemperatureMax { get; set; } = "°C";
        [JsonPropertyName("wind_speed_10m_max")] public string WindSpeedMax { get; set; } = "km/h";
    }
}
