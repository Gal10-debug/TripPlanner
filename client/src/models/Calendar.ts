export interface CalendarTrip {
    id: number;
    destination: string;
    country: string;
    startDate: string;
    endDate: string;
}

export interface CalendarActivity {
    id: number;
    tripId: number;
    title: string;
    date: string;
    time: string;
    location: string;
    destination: string;
    country: string;
}

export interface CalendarMonth {
    trips: CalendarTrip[];
    activities: CalendarActivity[];
}
