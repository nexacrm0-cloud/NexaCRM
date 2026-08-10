'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api-client';
import { usePermissions } from '@/hooks/use-permissions';
import { usePlan } from '@/hooks/use-plan';
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  CheckSquare,
  FileText,
  Settings,
  UserCircle,
  ChevronLeft,
  PanelRightOpen,
  Group,
  Activity,
  CalendarDays,
  Receipt,
  Zap,
  Plug,
  Bot,
  Headphones,
  Lock,
  Package,
  History,
  Tag,
} from 'lucide-react';

type NavSubRoute = { href: string; label: string; ownerOnly?: boolean };

type NavItem = {
  href: string;
  label: string;
  icon: any;
  adminOnly?: boolean;
  ownerOnly?: boolean;
  supportOnly?: boolean;
  inventorySection?: boolean;
  planRequired?: 'starter' | 'pro';
  subRoutes?: NavSubRoute[];
};

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clients', label: 'Clientes', icon: Users },
  { href: '/pipeline', label: 'Pipeline', icon: KanbanSquare },
  { href: '/tasks', label: 'Tareas', icon: CheckSquare },
  { href: '/quotes', label: 'Presupuestos', icon: FileText },
  { href: '/calendar', label: 'Calendario', icon: CalendarDays },
  { href: '/activity', label: 'Actividad', icon: Activity },
  { href: '/invoices', label: 'Facturación', icon: Receipt },
  { href: '/inventory', label: 'Inventario', icon: Package, inventorySection: true },
  { href: '/inventory/movements', label: 'Movimientos', icon: History },
  {
    href: '/automation',
    label: 'Automatizaciones',
    icon: Zap,
    planRequired: 'starter',
    subRoutes: [
      { href: '/automation/templates', label: 'Marketplace' },
      { href: '/automation', label: 'Mis flujos' },
      { href: '/automation/subscriptions', label: 'Mis suscripciones' },
      { href: '/automation/admin', label: 'Gestor (Owner)', ownerOnly: true },
      { href: '/automation/transfers', label: 'Transferencias (Owner)', ownerOnly: true },
    ],
  },
  {
    href: '/connectors',
    label: 'Conectores',
    icon: Plug,
    adminOnly: true,
    planRequired: 'starter',
  },
  { href: '/agents', label: 'AI Agents', icon: Bot, ownerOnly: true, planRequired: 'pro' },
  { href: '/team', label: 'Equipo', icon: Group, adminOnly: true },
  { href: '/support', label: 'Soporte', icon: Headphones, supportOnly: true },
];

const bottomItems = [
  { href: '/profile', label: 'Perfil', icon: UserCircle },
  { href: '/settings', label: 'Configuración', icon: Settings, adminOnly: true },
];

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const pathname = usePathname();
  const { isSuperAdmin, isOwner, canManageTeam, canManageSettings } = usePermissions();
  const { hasPlan } = usePlan();

  const { data: categories } = useQuery<{
    data: Array<{ id: string; name: string; slug: string; color: string | null }>;
  }>({
    queryKey: ['categories'],
    queryFn: () => api.get('/inventory/products/categories'),
    staleTime: 5 * 60 * 1000,
  });

  const visibleNavItems = navItems.filter(
    (item) =>
      (!item.adminOnly || (item.href === '/team' ? canManageTeam : canManageSettings)) &&
      (!item.ownerOnly || isOwner) &&
      (!item.supportOnly || isSuperAdmin),
  );
  const visibleBottomItems = bottomItems.filter(
    (item) => !item.adminOnly || (item.href === '/settings' ? canManageSettings : true),
  );

  const sidebarContent = (
    <aside
      className={cn(
        'border-ink/14 bg-paper-2 flex h-full flex-col border-r font-sans transition-all duration-200',
        collapsed ? 'w-[60px]' : 'w-[var(--sidebar-width)]',
      )}
    >
      <div
        className={cn(
          'border-ink/14 flex items-center gap-2 border-b px-4 py-5',
          collapsed && 'justify-center px-2',
        )}
      >
        <div className="bg-ink text-paper flex h-7 w-7 shrink-0 items-center justify-center">
          <span className="font-display text-[15px] font-semibold leading-none">N</span>
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-none">
            <span className="font-display text-ink text-[17px] font-semibold tracking-[-0.02em]">
              Nexa
            </span>
            <span className="eyebrow mt-0.5 text-[9px]">CRM & Facturación</span>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 p-2 pt-3">
        {visibleNavItems.map((item, idx) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const locked = item.planRequired && !hasPlan(item.planRequired);
          const isExpandedSection =
            item.inventorySection && !collapsed && (categories?.data?.length ?? 0) > 0;
          const showSubRoutes = !collapsed && (item.subRoutes?.length ?? 0) > 0 && !locked;
          return (
            <div key={item.href}>
              <Link
                href={item.href}
                onClick={onMobileClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 text-[13px] font-medium tracking-[0.005em] transition-colors duration-150',
                  collapsed && 'justify-center px-2',
                  isActive
                    ? 'bg-receipt text-ink border-naranja border-l-2'
                    : locked
                      ? 'text-ink-3/60 hover:bg-receipt hover:text-ink-2'
                      : 'text-ink-2 hover:bg-receipt/70 hover:text-ink',
                )}
              >
                <item.icon className={cn('h-[15px] w-[15px] shrink-0', locked && 'opacity-50')} />
                {!collapsed && (
                  <span className="flex-1 truncate">
                    {item.label}
                    {locked && (
                      <span className="text-ink-3/80 ml-1 text-[9px]">
                        {item.planRequired === 'starter' ? 'STARTER+' : 'PRO+'}
                      </span>
                    )}
                  </span>
                )}
                {!collapsed && isActive && (
                  <span className="font-display text-ink-3/70 tabular text-[10px]">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                )}
              </Link>
              {isExpandedSection && (
                <div className="border-ink/10 mb-1 ml-3 mt-0.5 space-y-0.5 border-l pl-2">
                  {categories!.data.map((cat) => {
                    const href = `/inventory?categoryId=${cat.id}`;
                    const active =
                      pathname === '/inventory' &&
                      typeof window !== 'undefined' &&
                      new URLSearchParams(window.location.search).get('categoryId') === cat.id;
                    return (
                      <Link
                        key={cat.id}
                        href={href}
                        onClick={onMobileClose}
                        className={cn(
                          'flex items-center gap-2 px-2 py-1.5 text-[12px] tracking-[0.005em] transition-colors duration-150',
                          active
                            ? 'bg-receipt text-ink'
                            : 'text-ink-3 hover:bg-receipt/70 hover:text-ink-2',
                        )}
                      >
                        <span
                          className="ring-ink/10 h-2 w-2 shrink-0 rounded-full ring-1"
                          style={{ backgroundColor: cat.color ?? '#9ca3af' }}
                        />
                        <span className="truncate">{cat.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
              {showSubRoutes && (
                <div className="border-ink/10 mb-1 ml-3 mt-0.5 space-y-0.5 border-l pl-2">
                  {item
                    .subRoutes!.filter((sub) => !sub.ownerOnly || isOwner)
                    .map((sub) => {
                      const active = pathname === sub.href;
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          onClick={onMobileClose}
                          className={cn(
                            'flex items-center gap-2 px-2 py-1.5 text-[12px] tracking-[0.005em] transition-colors duration-150',
                            active
                              ? 'bg-receipt text-ink'
                              : 'text-ink-3 hover:bg-receipt/70 hover:text-ink-2',
                          )}
                        >
                          <span className="truncate">{sub.label}</span>
                        </Link>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-ink/14 space-y-0.5 border-t p-2">
        {visibleBottomItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                'flex items-center gap-3 rounded-[1px] px-3 py-2 text-[13px] font-medium transition-colors duration-150',
                collapsed && 'justify-center px-2',
                isActive ? 'bg-receipt text-ink' : 'text-ink-2 hover:bg-receipt/70 hover:text-ink',
              )}
            >
              <item.icon className="h-[15px] w-[15px] shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
        <button
          onClick={onToggleCollapse}
          className={cn(
            'text-ink-3 hover:bg-receipt hover:text-ink flex w-full items-center gap-3 px-3 py-2 text-[12px] transition-colors duration-150',
            collapsed && 'justify-center px-2',
          )}
        >
          {collapsed ? (
            <PanelRightOpen className="h-[15px] w-[15px]" />
          ) : (
            <ChevronLeft className="h-[15px] w-[15px]" />
          )}
          {!collapsed && <span className="text-[10px] uppercase tracking-[0.18em]">Colapsar</span>}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden h-full shrink-0 md:flex">{sidebarContent}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="bg-ink/50 fixed inset-0 backdrop-blur-[1px]" onClick={onMobileClose} />
          <div className="fixed inset-y-0 left-0 z-50 shadow-2xl">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
