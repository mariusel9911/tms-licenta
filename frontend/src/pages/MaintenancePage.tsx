import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import { useMaintenanceStatus } from '@/hooks/useSettings';

export default function MaintenancePage() {
  const navigate = useNavigate();
  const { data } = useMaintenanceStatus();

  // Auto-redirect to login when maintenance ends
  useEffect(() => {
    if (data && !data.enabled) {
      navigate('/login', { replace: true });
    }
  }, [data, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="animate-in fade-in-0 duration-500 max-w-md w-full text-center">
        <div className="bg-white rounded-2xl shadow-lg p-10">
          {/* Icon */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <Wrench className="h-8 w-8 text-amber-600" />
          </div>

          {/* Heading */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Under Maintenance
          </h1>

          {/* Custom message from server */}
          {data?.message ? (
            <p className="text-gray-600 mb-4">{data.message}</p>
          ) : (
            <p className="text-gray-600 mb-4">
              We're performing scheduled maintenance to improve the system.
            </p>
          )}

          {/* Secondary text */}
          <p className="text-sm text-gray-400">
            We'll be back shortly. This page will automatically redirect when maintenance is complete.
          </p>

          {/* Polling indicator */}
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            Checking status...
          </div>
        </div>
      </div>
    </div>
  );
}
