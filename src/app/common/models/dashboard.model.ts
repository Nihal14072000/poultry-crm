export interface DashboardMetric {
  label: string;
  value: string;
  change: string;
  direction: 'up' | 'down' | 'neutral';
  icon: string;
  tone: string;
  detail: string;
}

export interface TrendPoint {
  label: string;
  value: number;
}

export interface FarmPerformance {
  name: string;
  location: string;
  birds: number;
  mortality: number;
  fcr: number;
  status: string;
  trend: number[];
}

export interface DashboardAlert {
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  time: string;
}

export interface DashboardData {
  metrics: DashboardMetric[];
  revenueTrend: TrendPoint[];
  farmPerformance: FarmPerformance[];
  alerts: DashboardAlert[];
  recentActivity: { title: string; description: string; time: string; type: string }[];
}
