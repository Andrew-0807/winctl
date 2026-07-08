import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useServiceStore } from '../stores/services';
import { useThemeStore } from '../stores/themes';
import { useUIStore } from '../stores/ui';
import { disconnectSocket, isTauri } from '../stores/socket';

import Header from './Header';
import Sidebar from './Sidebar';
import SystemStats from './SystemStats';
import Toolbar from './Toolbar';
import ServiceGrid from './ServiceGrid';
import ServiceModal from './ServiceModal';
import FolderModal from './FolderModal';
import SettingsModal from './SettingsModal';
import ThemeCreator from './ThemeCreator';
import SystemInfoModal from './SystemInfoModal';
import FAB from './FAB';
import ContextMenu from './ContextMenu';
import ToastContainer from './Toast';
import RunCommandPanel from './RunCommandPanel';
import ConfirmDialog from './ConfirmDialog';
import LoginScreen from './LoginScreen';
import OnboardingFlow from './OnboardingFlow';

const MainApp: React.FC = () => {
  const loadServices = useServiceStore((s) => s.loadServices);
  const loadSystem = useServiceStore((s) => s.loadSystem);
  const loadThemes = useThemeStore((s) => s.loadThemes);
  const settings = useServiceStore((s) => s.settings);
  const handleKeyDown = useUIStore((s) => s.handleKeyDown);
  const toast = useUIStore((s) => s.toast);
  const runPanelOpen = useUIStore((s) => s.runPanelOpen);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);

  const handleKeyDownRef = useRef(handleKeyDown);
  handleKeyDownRef.current = handleKeyDown;

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([loadServices(), loadSystem(), loadThemes()]);
        
        const currentSettings = useServiceStore.getState().settings;
        const currentTheme = useThemeStore.getState().currentTheme;
        if (currentSettings.theme && currentSettings.theme !== currentTheme) {
          useThemeStore.getState().selectTheme(currentSettings.theme);
        }
      } catch (error) {
        console.error('Failed to load initial data:', error);
        toast('Failed to load data. Please refresh the page.', 'error');
      }
    })();

    const keydownListener = (e: KeyboardEvent) => handleKeyDownRef.current(e);
    document.addEventListener('keydown', keydownListener);

    return () => {
      document.removeEventListener('keydown', keydownListener);
    };
  }, [loadServices, loadSystem, loadThemes, toast]);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
  }, [sidebarOpen]);

  const sidebarCollapsed = settings.sidebarCollapsed ?? false;

  return (
    <div className={`shell ${ sidebarCollapsed ? 'sidebar-collapsed' : '' }`}>
      <Header />
      <Sidebar />
      <main>
        <SystemStats />
        <Toolbar />
        <AnimatePresence>
          {runPanelOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <RunCommandPanel />
            </motion.div>
          )}
        </AnimatePresence>
        <ServiceGrid />
      </main>

      <ToastContainer />
      <FAB />
      <ContextMenu />
      <ServiceModal />
      <FolderModal />
      <SettingsModal />
      <ThemeCreator />
      <SystemInfoModal />
      <ConfirmDialog />
    </div>
  );
};

const Loader: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-screen bg-bg gap-4">
    <div className="w-10 h-10 border-[3px] border-border border-t-accent rounded-full animate-spin" />
    <div className="text-text2 text-[0.9rem]">Loading...</div>
  </div>
);

const App: React.FC = () => {
  const isLoggedIn = useServiceStore((s) => s.isLoggedIn);
  const setLoggedIn = useServiceStore((s) => s.setLoggedIn);
  const initializeSocket = useServiceStore((s) => s.initializeSocket);
  const checkSetupStatus = useServiceStore((s) => s.checkSetupStatus);
  const [setupStatus, setSetupStatus] = useState<boolean | null>(null);

  useEffect(() => {
    initializeSocket();
    useThemeStore.getState().loadThemes();
    checkSetupStatus().then((complete) => setSetupStatus(complete));
    return () => {
      disconnectSocket();
    };
  }, [initializeSocket, checkSetupStatus]);

  const screenVariants = {
    initial: { opacity: 0, scale: 0.98, filter: 'blur(3px)' },
    animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
    exit: { opacity: 0, scale: 1.01, filter: 'blur(3px)' }
  };

  const screenTransition = {
    type: 'spring',
    duration: 0.4,
    bounce: 0
  } as const;

  return (
    <AnimatePresence mode='wait'>
      {setupStatus === null ? (
        <motion.div key='loader'>
          <Loader />
        </motion.div>
      ) : setupStatus === false ? (
        <motion.div
          key='onboarding'
          variants={screenVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={screenTransition}
        >
          <OnboardingFlow onComplete={(openAccess) => {
            setSetupStatus(true);
            if (openAccess) setLoggedIn(true);
          }} />
        </motion.div>
      ) : isLoggedIn || isTauri() ? (
        <motion.div
          key='main'
          variants={screenVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={screenTransition}
        >
            <MainApp />
          </motion.div>
      ) : (
        <motion.div
          key='login'
          variants={screenVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={screenTransition}
        >
          <LoginScreen />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default App;
