import Dexie, { type EntityTable } from 'dexie';

// Types for cached data
export interface AssignmentCache {
  id: string;
  expediente_id: string;
  supervisor_id: string;
  fecha_asignacion: string;
  cached_at: number;
}

export interface PointCache {
  id: string;
  expediente_id: string;
  locacion: string;
  cod_punto_campo: string;
  este: number;
  norte: number;
  estatus: string;
  cached_at: number;
}

export interface MutationQueue {
  id?: number;
  type: 'UPDATE_POINT_STATUS' | 'CREATE_ASSIGNMENT' | 'DELETE_ASSIGNMENT';
  payload: any;
  timestamp: number;
  retry_count: number;
  max_retries: number;
  status: 'PENDING' | 'PROCESSING' | 'FAILED' | 'COMPLETED';
}

// Database schema
export class OfflineDB extends Dexie {
  assignments_cache!: EntityTable<AssignmentCache, 'id'>;
  points_cache!: EntityTable<PointCache, 'id'>;
  mutations_queue!: EntityTable<MutationQueue, 'id'>;

  constructor() {
    super('LoteXOfflineDB');
    
    this.version(1).stores({
      assignments_cache: 'id, expediente_id, supervisor_id, fecha_asignacion, cached_at',
      points_cache: 'id, expediente_id, locacion, cod_punto_campo, estatus, cached_at',
      mutations_queue: '++id, type, timestamp, status, retry_count'
    });
  }

  // Cache management methods
  async clearExpiredCache(maxAgeMs: number = 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - maxAgeMs;
    
    await Promise.all([
      this.assignments_cache.where('cached_at').below(cutoff).delete(),
      this.points_cache.where('cached_at').below(cutoff).delete()
    ]);
  }

  async getCacheSize() {
    const [assignments, points, mutations] = await Promise.all([
      this.assignments_cache.count(),
      this.points_cache.count(),
      this.mutations_queue.count()
    ]);

    return {
      assignments,
      points,
      mutations,
      total: assignments + points + mutations
    };
  }

  async getPendingMutationsCount() {
    return await this.mutations_queue
      .where('status')
      .equals('PENDING')
      .count();
  }

  async addMutation(type: MutationQueue['type'], payload: any) {
    return await this.mutations_queue.add({
      type,
      payload,
      timestamp: Date.now(),
      retry_count: 0,
      max_retries: 3,
      status: 'PENDING'
    });
  }
}

// Singleton instance
export const db = new OfflineDB();
