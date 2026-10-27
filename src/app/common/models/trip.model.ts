export interface TripLineInput {
  quantity: number | null;
  weight?: number | null;
  rate: number | null;
}

export interface CreateTripInput {
  tripDate: string;
  vehicleId: string;
  driverId: string;
  route: string;
  vendorPickups: VendorPickupInput[];
  supervisorId?: string;
  supervisorEmail?: string;
  vendorDeliveries?: VendorDeliveryInput[];
}

export interface VendorPickupInput {
  vendorId: string;
  broiler: TripLineInput;
  culls: TripLineInput;
  feed: TripLineInput;
}

export interface VendorDeliveryInput {
  vendorDestinationId: string;
  broilerQuantity: number | null;
  broilerWeight?: number | null;
  broilerRate: number | null;
  cullsQuantity: number | null;
  cullsWeight?: number | null;
  cullsRate: number | null;
  feedQuantity?: number | null;
  feedWeight?: number | null;
  feedRate?: number | null;
}

export interface TripPickupLine {
  quantity: number;
  weight?: number;
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
