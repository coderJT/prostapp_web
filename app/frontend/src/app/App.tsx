import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from './components/ui/sonner';
import { ThemeProvider } from './components/ThemeProvider';
import { TranslationProvider } from './components/TranslationProvider';

function App() {
  return (
    <ThemeProvider>
      <TranslationProvider>
        <RouterProvider router={router} />
        <Toaster />
      </TranslationProvider>
    </ThemeProvider>
  );
}

export default App;
