export interface TripLineInput {
  quantity: number | null;
  rate: number | null;
}

export interface CreateTripInput {
  tripDate: string;
  vehicleId: string;
  driverId: string;
  route: string;
  vendorPickups: VendorPickupInput[];
}

export interface VendorPickupInput {
  vendorId: string;
  broiler: TripLineInput;
  culls: TripLineInput;
  feed: TripLineInput;
}

export interface TripPickupLine {
  quantity: number;
  rate: number;
  total: number;
}

export interface TripVendorPickup {
  vendorId: string;
  vendorName: string;
  broiler: TripPickupLine;
  culls: TripPickupLine;
  feed: TripPickupLine;
  total: number;
}

export interface TripSummary {
  vendors: number;
  broiler: number;
  culls: number;
  feed: number;
  birds: number;
  grandTotal: number;
}

export type TripRecord = Record<string, string | number>;
