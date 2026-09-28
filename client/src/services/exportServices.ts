import type { Trip } from '../models/Trip';
import type { ItineraryItem } from '../models/ItineraryItem';
import type { PackingItem } from '../models/PackingItem';
import type { BudgetOverview } from '../models/Budget';

export interface TripSummary {
  trip: Trip;
  itinerary: ItineraryItem[];
  packing: PackingItem[];
  budget: BudgetOverview;
  generatedAt: Date;
}

export async function loadTripSummary(tripId: number, signal: AbortSignal): Promise<TripSummary> {
  async function read<T>(suffix: string): Promise<T> {
    const response = await fetch(`/api/trips/${tripId}${suffix}`, { credentials: 'include', signal });
    if (!response.ok) throw new Error('Unable to prepare the trip summary. Please try again.');
    return response.json();
  }
  const [trip, itinerary, packing, budget] = await Promise.all([
    read<Trip>(''), read<ItineraryItem[]>('/itinerary'), read<PackingItem[]>('/packing'), read<BudgetOverview>('/budget'),
  ]);
  return { trip, itinerary, packing, budget, generatedAt: new Date() };
}
