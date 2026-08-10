import { SearchService } from '../search.service';

describe('SearchService', () => {
  let service: SearchService;
  const mockPrisma = {
    searchIndex: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SearchService(mockPrisma as any);
  });

  describe('search', () => {
    it('queries search_index by organizationId and query', async () => {
      mockPrisma.searchIndex.findMany.mockResolvedValue([
        {
          id: '1',
          title: 'Acme Corp',
          entityType: 'client',
          entityId: 'client-1',
          content: 'Acme Corp John',
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          organizationId: 'org-1',
        },
      ]);
      mockPrisma.searchIndex.count.mockResolvedValue(1);

      const results = await service.search('org-1', 'Acme');

      expect(mockPrisma.searchIndex.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-1' }),
        }),
      );
      expect(results.items).toHaveLength(1);
      expect(results.total).toBe(1);
      expect(results.query).toBe('Acme');
    });

    it('filters by entityType when provided', async () => {
      mockPrisma.searchIndex.findMany.mockResolvedValue([]);
      mockPrisma.searchIndex.count.mockResolvedValue(0);

      await service.search('org-1', 'test', { entityType: 'client' });

      expect(mockPrisma.searchIndex.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ entityType: 'client' }),
        }),
      );
    });

    it('respects limit and offset', async () => {
      mockPrisma.searchIndex.findMany.mockResolvedValue([]);
      mockPrisma.searchIndex.count.mockResolvedValue(0);

      await service.search('org-1', 'test', { limit: 5, offset: 10 });

      expect(mockPrisma.searchIndex.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5, skip: 10 }),
      );
    });

    it('caps limit at 100', async () => {
      mockPrisma.searchIndex.findMany.mockResolvedValue([]);
      mockPrisma.searchIndex.count.mockResolvedValue(0);

      await service.search('org-1', 'test', { limit: 999 });

      expect(mockPrisma.searchIndex.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('returns empty results when nothing matches', async () => {
      mockPrisma.searchIndex.findMany.mockResolvedValue([]);
      mockPrisma.searchIndex.count.mockResolvedValue(0);

      const results = await service.search('org-1', 'zzzzz');

      expect(results.items).toHaveLength(0);
      expect(results.total).toBe(0);
    });
  });

  describe('searchByEntityId', () => {
    it('finds search index by entity', async () => {
      const expected = {
        id: '1',
        entityType: 'client',
        entityId: 'client-1',
        title: 'Acme',
        content: '',
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        organizationId: 'org-1',
      };
      mockPrisma.searchIndex.findFirst.mockResolvedValue(expected);

      const result = await service.searchByEntityId('org-1', 'client', 'client-1');

      expect(result).toBeTruthy();
      expect(result!.entityId).toBe('client-1');
    });

    it('returns null when not found', async () => {
      mockPrisma.searchIndex.findFirst.mockResolvedValue(null);

      const result = await service.searchByEntityId('org-1', 'client', 'nonexistent');

      expect(result).toBeNull();
    });
  });
});
