export interface DirectoryResponse {
  records: Record<string, string | number>[];
}

export interface Employee extends Record<string, unknown> {
  id: number;
  name: string;
  address: string;
  number: string;
  type: string;
  status: string;
  isActive: boolean;
  isDeleted: boolean;
  createDate: string | null;
  updatedDate: string | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface DirectoryColumn {
  key: string;
  label: string;
}

export interface PerformanceMetric {
  label: string;
  value: string;
  change: string;
  direction: 'up' | 'down' | 'neutral';
  note: string;
}

export interface PerformanceSeries {
  name: string;
  color: string;
  values: number[];
}

export interface PerformanceChart {
  title: string;
  unit: string;
  labels: string[];
  series: PerformanceSeries[];
}

export interface ProductionPerformance {
  description: string;
  metrics: PerformanceMetric[];
  charts: PerformanceChart[];
  insight: string;
}

export interface ProductionResponse extends DirectoryResponse {
  performance: ProductionPerformance;
}
