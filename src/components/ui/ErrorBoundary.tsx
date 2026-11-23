import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';
import { AlertCircle, Home, RefreshCcw } from 'lucide-react';
import { Button } from './Button';

export function ErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();
  const baseUrl = import.meta.env.BASE_URL;

  console.error('Routing Error:', error);

  let title = 'Unexpected Error';
  let message = 'Something went wrong while navigating.';

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = 'Page Not Found';
      message = "The page you're looking for doesn't exist or has moved.";
    } else {
      title = `${error.status} ${error.statusText}`;
      message = error.data?.message || message;
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-page p-6 text-center">
      <div className="mb-6 rounded-full bg-red-500/10 p-4 text-red-500 shadow-lg shadow-red-500/20">
        <AlertCircle size={48}/>
      </div>
      
      <h1 className="mb-2 text-2xl font-bold text-content">{title}</h1>
      <p className="mb-8 max-w-xs text-muted leading-relaxed">
        {message}
      </p>

      {/* Diagnostics for Debugging */}
      <div className="mb-8 w-full max-w-sm rounded-2xl bg-surface border border-content/5 p-4 text-left font-mono text-[10px] text-muted opacity-60">
        <p className="font-bold border-b border-content/5 pb-1 mb-2">DEBUG DIAGNOSTICS</p>
        <p>URL: {window.location.pathname}</p>
        <p>BASE: {baseUrl}</p>
        <p>ERROR: {isRouteErrorResponse(error) ? '404 Response' : 'Runtime Error'}</p>
      </div>

      <div className="flex flex-col w-full max-w-xs gap-3">
        <Button 
          variant="primary" 
          className="w-full py-4 rounded-2xl"
          onClick={() => navigate('/')}
        >
          <Home size={20}className="mr-2" />
          Back to Home
        </Button>
        <Button 
          variant="secondary" 
          className="w-full py-4 rounded-2xl bg-surface border border-content/10"
          onClick={() => window.location.reload()}
        >
          <RefreshCcw size={20}className="mr-2" />
          Retry Loading
        </Button>
      </div>
    </div>
  );
}
