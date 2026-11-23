import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ExpenseRecord {
  [key: string]: unknown;
  id?: number;
  tripId?: number;
  amount?: number;
  expenseDate?: string;
  category?: string;
  sellingPartyId?: number | null;
  actualOrderId?: number | null;
  note?: string;
  isActive?: boolean;
  isDeleted?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ExpenseApiService {
  private readonly endpoint = `${environment.apiUrl}/expenses`;

  constructor(private readonly http: HttpClient) {}

  async expensesForTrip(tripId: string): Promise<ExpenseRecord[]> {
    if (!/^\d+$/.test(tripId) || Number(tripId) <= 0) {
      throw new Error('A valid trip ID is required to retrieve expenses.');
    }
    let response: ExpenseRecord[] | { items?: ExpenseRecord[]; data?: ExpenseRecord[] };
    try {
      response = await firstValueFrom(this.http.get<ExpenseRecord[] | { items?: ExpenseRecord[]; data?: ExpenseRecord[] }>(
        `${this.endpoint}/trip/${encodeURIComponent(tripId)}`
      ));
    } catch (error) {
      // Expense data is supplementary to the trip view. A failed expense request
      // must not prevent the rest of the page from rendering.
      console.warn(`Unable to load expenses for trip ${tripId}; showing an empty expense list.`, error);
      return [];
    }
    const rows = Array.isArray(response) ? response : response.items ?? response.data ?? [];
    return rows
      .map((row) => this.camelCaseRow(row))
      .sort((a, b) => String(b['expenseDate'] ?? '').localeCompare(String(a['expenseDate'] ?? '')) || Number(b['id'] ?? 0) - Number(a['id'] ?? 0));
  }

  createExpense(input: ExpenseRecord): Promise<ExpenseRecord> {
    return firstValueFrom(this.http.post<ExpenseRecord>(this.endpoint, input)).then((row) => this.camelCaseRow(row));
  }

  updateExpense(id: string, input: ExpenseRecord): Promise<ExpenseRecord> {
    return firstValueFrom(this.http.put<ExpenseRecord>(`${this.endpoint}/${encodeURIComponent(id)}`, input)).then((row) => this.camelCaseRow(row));
  }

  deleteExpense(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.endpoint}/${encodeURIComponent(id)}`));
  }

  private camelCaseRow(row: ExpenseRecord): ExpenseRecord {
    return Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()), value]));
  }
}
