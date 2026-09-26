export interface ForecastDay {
    date: string;
    weatherCode: number;
    temperatureMax: number;
    temperatureMin: number;
    precipitationProbability: number;
    windSpeedMax: number;
}

export interface WeatherForecast {
    available: boolean;
    reason?: "past" | "too-early" | "location";
    message?: string;
    daysUntilAvailable?: number;
    location?: { name: string; country: string; timezone: string };
    temperatureUnit?: string;
    windSpeedUnit?: string;
    days?: ForecastDay[];
}

export interface TripReminder {
    id: number;
    tripId: number;
    title: string;
    dueDate: string;
    isCompleted: boolean;
    isAutomatic: boolean;
}

export interface DashboardReminder extends TripReminder {
    destination: string;
    country: string;
}

export type ReminderRequest = Pick<TripReminder, "title" | "dueDate" | "isCompleted">;
