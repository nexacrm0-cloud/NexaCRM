import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@nexa/database';

export interface SearchResult {
  id: string;
  entityType: string;
  entityId: string;
  title: string;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchResults {
  items: SearchResult[];
  total: number;
  query: string;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(private readonly prisma: PrismaService) {}

  async search(
    organizationId: string,
    query: string,
    options?: { entityType?: string; limit?: number; offset?: number },
  ): Promise<SearchResults> {
    const limit = Math.min(options?.limit ?? 20, 100);
    const offset = options?.offset ?? 0;

    const where: any = {
      organizationId,
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { content: { contains: query, mode: 'insensitive' } },
      ],
    };

    if (options?.entityType) {
      where.entityType = options.entityType;
    }

    const [items, total] = await Promise.all([
      this.prisma.searchIndex.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.searchIndex.count({ where }),
    ]);

    return {
      items: items as unknown as SearchResult[],
      total,
      query,
    };
  }

  async searchByEntityId(
    organizationId: string,
    entityType: string,
    entityId: string,
  ): Promise<SearchResult | null> {
    const entry = await this.prisma.searchIndex.findFirst({
      where: { organizationId, entityType, entityId },
    });
    return entry as unknown as SearchResult | null;
  }
}
