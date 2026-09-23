import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m } from 'framer-motion';

const stack: symbol[] = [];
let locks = 0;

function lockScroll() {
  if (locks++ === 0) document.documentElement.classList.add('scroll-locked');
}
function unlockScroll() {
  if (--locks <= 0) {
    locks = 0;
    document.documentElement.classList.remove('scroll-locked');
  }
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

type Variant = 'sheet' | 'page' | 'full' | 'center';

interface Props {
  open: boolean;
  onClose: () => void;
  label: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}

function Panel({ onClose, label, variant = 'sheet', className = '', children }: Omit<Props, 'open'>) {
  const ref = useRef<HTMLDivElement>(null);
  const token = useRef(Symbol('dialog'));
  const labelId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const me = token.current;
    stack.push(me);
    lockScroll();
    const prev = document.activeElement as HTMLElement | null;
    const node = ref.current;
    requestAnimationFrame(() => {
      const target = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node;
      target?.focus({ preventScroll: true });
    });
    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== me) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
      } else if (e.key === 'Tab' && node) {
        const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === node)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const i = stack.indexOf(me);
      if (i >= 0) stack.splice(i, 1);
      unlockScroll();
      if (prev && document.contains(prev)) prev.focus({ preventScroll: true });
    };
  }, []);

  const motionProps =
    variant === 'center'
      ? { initial: { opacity: 0, scale: 0.96, y: 12 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.97, y: 8 } }
      : variant === 'full'
        ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
        : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } };

  return (
    <div className={`dlg dlg--${variant}`} role="presentation">
      {variant !== 'full' && (
        <m.div className="dlg__scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} />
      )}
      <m.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={undefined}
        id={labelId}
        tabIndex={-1}
        className={`dlg__panel ${className}`}
        {...motionProps}
        transition={{ type: 'spring', damping: 34, stiffness: 340, mass: 0.9 }}
      >
        {children}
      </m.div>
    </div>
  );
}

/** Accessible modal: portal, focus trap, Esc closes the top-most dialog only, scroll lock, focus restore. */
export function Dialog(props: Props) {
  return createPortal(<AnimatePresence>{props.open && <Panel key="p" {...props} />}</AnimatePresence>, document.body);
}
