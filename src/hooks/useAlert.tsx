import { useState, useCallback } from 'react';
import { AlertModal } from '../components/AlertModal';

type AlertType = 'info' | 'success' | 'error' | 'warning';

type AlertOptions = {
  title?: string;
  type?: AlertType;
  confirmText?: string;
  link?: string;
  onClose?: () => void;
  onConfirm?: () => void;
  cancelText?: string;
};

export function useAlert() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [options, setOptions] = useState<AlertOptions>({});

  const showAlert = useCallback((msg: string, opts: AlertOptions = {}) => {
    setMessage(msg);
    setOptions(opts);
    setIsOpen(true);
  }, []);

  const closeAlert = useCallback(() => {
    setIsOpen(false);
    if (options.onClose) {
      options.onClose();
    }
  }, [options]);

  const AlertComponent = useCallback(() => (
    <AlertModal
      isOpen={isOpen}
      onClose={closeAlert}
      message={message}
      title={options.title}
      type={options.type}
      confirmText={options.confirmText}
      link={options.link}
      onConfirm={options.onConfirm}
      cancelText={options.cancelText}
    />
  ), [isOpen, closeAlert, message, options]);

  return {
    showAlert,
    closeAlert,
    AlertComponent
  };
}
