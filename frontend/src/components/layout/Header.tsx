import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button';
import { useAuthStore } from '@/store/auth.store';

export function Header() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  function handleLogout() {
    logout();
    // Clear React Query cache — prevents stale data from leaking to the next
    // user who logs in on the same browser tab (e.g. passkeys, MFA status).
    queryClient.clear();
    navigate('/login');
  }

  return (
    <header className="flex h-14 items-center justify-end border-b border-gray-200 bg-white px-6 flex-shrink-0">
      <div className="flex items-center gap-4">
        {user && (
          <span className="text-sm text-gray-600">
            {user.name}
          </span>
        )}
        <InteractiveHoverButton
          text="Logout"
          onClick={handleLogout}
          className="w-28 text-sm h-9 border-gray-300 text-gray-600"
        />
      </div>
    </header>
  );
}
