'use client';

import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CommandPalette } from '@/components/command-palette/command-palette';
import { LogOut, User, Settings, Menu, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { NotificationBell } from '@/components/notifications/notification-bell';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const initials = user ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}` : 'NN';

  return (
    <header className="border-ink/14 bg-receipt/95 flex h-[58px] items-center justify-between gap-2 border-b px-4 backdrop-blur-[8px] md:px-7">
      <div className="flex min-w-0 items-center gap-2 md:gap-4">
        <Button variant="ghost" size="icon" className="shrink-0 md:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>
        <div className="min-w-0 max-w-md flex-1">
          <CommandPalette />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 md:gap-3">
        <span className="eyebrow hidden max-w-[160px] truncate text-[10px] sm:inline-flex">
          {user?.organizationName}
        </span>

        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Cambiar tema"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        )}
        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-7 w-7 rounded-[1px] p-0">
              <Avatar className="h-7 w-7">
                <AvatarImage src={user?.avatarUrl || ''} />
                <AvatarFallback className="bg-ink text-paper font-display text-[10px]">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {user?.firstName} {user?.lastName}
                </span>
                <span className="text-muted-foreground text-xs">{user?.email}</span>
              </div>
            </div>
            <DropdownMenuSeparator />
            <Link href="/profile">
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                Perfil
              </DropdownMenuItem>
            </Link>
            <Link href="/settings">
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Configuración
              </DropdownMenuItem>
            </Link>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-alizarin">
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
